import {
  archiveExcessTripsAfterDowngrade,
  upsertPurchaseFromStripeSubscription,
} from "@/lib/stripe/purchase-sync";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

async function resolveUserIdFromSubscription(
  admin: ReturnType<typeof createServiceRoleClient>,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const meta =
    sub.metadata?.user_id?.trim() ||
    sub.metadata?.supabase_user_id?.trim() ||
    "";
  if (meta) return meta;
  const cust =
    typeof sub.customer === "string"
      ? sub.customer
      : sub.customer?.id ?? null;
  if (!cust) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", cust)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
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

  const admin = createServiceRoleClient();
  const { error: insErr } = await admin
    .from("stripe_webhook_events")
    .insert({ id: event.id });
  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe webhook] idempotency insert", insErr);
    return NextResponse.json({ error: "Dedupe failed." }, { status: 500 });
  }

  const stripe = getStripeClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;
        if (sess.mode !== "subscription") break;
        const subId =
          typeof sess.subscription === "string"
            ? sess.subscription
            : sess.subscription?.id;
        const userId =
          sess.client_reference_id?.trim() ||
          sess.metadata?.user_id?.trim() ||
          "";
        if (!subId || !userId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const custRaw = sess.customer;
        const cust =
          typeof custRaw === "string" ? custRaw : custRaw?.id ?? null;
        if (cust) {
          await admin
            .from("profiles")
            .update({
              stripe_customer_id: cust,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        if (cust) {
          await upsertPurchaseFromStripeSubscription(admin, {
            userId,
            stripeCustomerId: cust,
            subscription: sub,
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(admin, sub);
        if (!userId) break;
        const cust =
          typeof sub.customer === "string"
            ? sub.customer
            : sub.customer?.id ?? "";
        if (!cust) break;
        await upsertPurchaseFromStripeSubscription(admin, {
          userId,
          stripeCustomerId: cust,
          subscription: sub,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(admin, sub);
        const cust =
          typeof sub.customer === "string"
            ? sub.customer
            : sub.customer?.id ?? "";
        if (userId && cust) {
          await upsertPurchaseFromStripeSubscription(admin, {
            userId,
            stripeCustomerId: cust,
            subscription: sub,
          });
        }
        const cpe = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : new Date().toISOString();
        const endMs = new Date(cpe).getTime();
        if (userId && !Number.isNaN(endMs) && endMs <= Date.now()) {
          await admin
            .from("profiles")
            .update({
              tier: "free",
              tier_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
          await archiveExcessTripsAfterDowngrade(admin, userId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        console.error("[stripe webhook] invoice.payment_failed", inv.id);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook] handler error", e);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
