import { enqueueSubscriptionPaymentFailedEmail } from "@/lib/stripe/enqueue-payment-failed-email";
import { getStripeClient } from "@/lib/stripe/client";
import {
  setPurchasePastDueBySubscriptionId,
  upsertPurchaseFromStripeSubscription,
} from "@/lib/stripe/purchase-sync";
import {
  resolveUserIdByStripeCustomerId,
  resolveUserIdForCheckoutSession,
  resolveUserIdForSubscription,
} from "@/lib/stripe/resolve-stripe-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

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
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;
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
        if (cust) {
          const { error: pErr } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: cust,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
          if (pErr) throw new Error(pErr.message);
        }
        if (cust) {
          await upsertPurchaseFromStripeSubscription(supabaseAdmin, {
            userId,
            stripeCustomerId: cust,
            subscription: sub,
          });
        } else {
          console.error(
            "[stripe webhook] checkout session missing customer id",
            ctx,
          );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
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
        await upsertPurchaseFromStripeSubscription(supabaseAdmin, {
          userId,
          stripeCustomerId: cust,
          subscription: sub,
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subRaw = inv.subscription;
        const subId =
          typeof subRaw === "string" ? subRaw : subRaw?.id ?? null;
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
