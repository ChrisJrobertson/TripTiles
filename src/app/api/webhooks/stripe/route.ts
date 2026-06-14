import { enqueueSubscriptionPaymentFailedEmail } from "@/lib/stripe/enqueue-payment-failed-email";
import { getStripeClient } from "@/lib/stripe/client";
import {
  handleSubscriptionDeleted,
  periodEndFromInvoice,
  setPurchasePastDueBySubscriptionId,
  updatePeriodEndFromInvoice,
  upsertPurchaseFromStripeSubscription,
} from "@/lib/stripe/purchase-sync";
import {
  resolveUserIdByStripeCustomerId,
  resolveUserIdByStripeSubscriptionId,
  resolveUserIdForCheckoutSession,
  resolveUserIdForSubscription,
} from "@/lib/stripe/resolve-stripe-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

type HandledEvent =
  | (Stripe.Event & {
      type: "checkout.session.completed";
      data: Stripe.Event.Data & { object: Stripe.Checkout.Session };
    })
  | (Stripe.Event & {
      type:
        | "customer.subscription.created"
        | "customer.subscription.updated"
        | "customer.subscription.deleted";
      data: Stripe.Event.Data & { object: Stripe.Subscription };
    })
  | (Stripe.Event & {
      type:
        | "invoice.paid"
        | "invoice.payment_succeeded"
        | "invoice.payment_failed";
      data: Stripe.Event.Data & { object: Stripe.Invoice };
    });

function isHandledEvent(event: Stripe.Event): event is HandledEvent {
  return (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded" ||
    event.type === "invoice.payment_failed"
  );
}

function subscriptionIdFromInvoice(inv: Stripe.Invoice): string | null {
  const invoiceWithSubscription = inv as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subRaw = invoiceWithSubscription.subscription;
  return typeof subRaw === "string" ? subRaw : subRaw?.id ?? null;
}

async function handleInvoiceRenewal(
  admin: ReturnType<typeof createServiceRoleClient>,
  stripe: Stripe,
  inv: Stripe.Invoice,
  ctx: { eventId: string; eventType: string },
): Promise<void> {
  const subId = subscriptionIdFromInvoice(inv);
  const periodEnd = periodEndFromInvoice(inv);
  if (!subId || !periodEnd) return;

  const custRaw = inv.customer;
  const custId =
    typeof custRaw === "string" ? custRaw : custRaw?.id ?? null;

  let userId = await resolveUserIdByStripeSubscriptionId(admin, subId);
  if (!userId) {
    userId = await resolveUserIdByStripeCustomerId(admin, stripe, custId, ctx);
  }
  if (!userId) return;

  await updatePeriodEndFromInvoice(admin, {
    userId,
    subscriptionId: subId,
    periodEnd,
  });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const supabaseAdmin = createServiceRoleClient();
  const { error: dedupErr } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({ id: event.id });

  if (dedupErr) {
    if (dedupErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe webhook] dedup insert failed", dedupErr);
    return NextResponse.json({ error: "dedup failed" }, { status: 500 });
  }

  const stripe = getStripeClient();
  const ctx = { eventId: event.id, eventType: event.type };

  try {
    console.info("[stripe webhook] handling", {
      eventId: event.id,
      type: event.type,
    });
    if (!isHandledEvent(event)) {
      return NextResponse.json({ received: true });
    }
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object;
        if (sess.mode !== "subscription") break;
        const subId =
          typeof sess.subscription === "string"
            ? sess.subscription
            : sess.subscription?.id;
        if (!subId) break;

        const userId = await resolveUserIdForCheckoutSession(
          supabaseAdmin,
          stripe,
          sess,
          ctx,
        );
        if (!userId) {
          return NextResponse.json({ received: true });
        }

        const sub = await stripe.subscriptions.retrieve(subId);
        const custRaw = sess.customer;
        const cust =
          typeof custRaw === "string" ? custRaw : custRaw?.id ?? null;
        if (!cust) {
          console.error(
            "[stripe webhook] checkout session missing customer id",
            ctx,
          );
          break;
        }
        await upsertPurchaseFromStripeSubscription(supabaseAdmin, {
          userId,
          stripeCustomerId: cust,
          subscription: sub,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = await resolveUserIdForSubscription(
          supabaseAdmin,
          stripe,
          sub,
          ctx,
        );
        if (!userId) {
          return NextResponse.json({ received: true });
        }
        const cust =
          typeof sub.customer === "string"
            ? sub.customer
            : sub.customer?.id ?? "";
        if (!cust) break;

        const gracePeriod =
          sub.status === "past_due" || sub.status === "unpaid";
        if (gracePeriod) {
          console.info(
            "[stripe webhook] subscription payment issue — grace period, tier unchanged",
            { userId, status: sub.status, ...ctx },
          );
        }

        await upsertPurchaseFromStripeSubscription(supabaseAdmin, {
          userId,
          stripeCustomerId: cust,
          subscription: sub,
          profileGracePeriod: gracePeriod,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = await resolveUserIdForSubscription(
          supabaseAdmin,
          stripe,
          sub,
          ctx,
        );
        if (!userId) {
          return NextResponse.json({ received: true });
        }
        await handleSubscriptionDeleted(supabaseAdmin, {
          userId,
          subscriptionId: sub.id,
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object;
        await handleInvoiceRenewal(supabaseAdmin, stripe, inv, ctx);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const subId = subscriptionIdFromInvoice(inv);
        if (subId) {
          await setPurchasePastDueBySubscriptionId(supabaseAdmin, subId);
        }
        const custRaw = inv.customer;
        const custId =
          typeof custRaw === "string" ? custRaw : custRaw?.id ?? null;
        const userId = await resolveUserIdByStripeCustomerId(
          supabaseAdmin,
          stripe,
          custId,
          ctx,
        );
        if (userId) {
          await enqueueSubscriptionPaymentFailedEmail(
            supabaseAdmin,
            userId,
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[stripe webhook] failed", {
      eventId: event.id,
      type: event.type,
      error: err.message,
    });
    return NextResponse.json(
      { error: "handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
