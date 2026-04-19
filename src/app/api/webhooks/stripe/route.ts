import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripeClient } from "@/lib/stripe/client";
import {
  arePriceIdsConfigured,
  priceIdToTier,
  type BillingInterval,
} from "@/lib/stripe/products";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function unixSecondsToIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function deriveSubscriptionPeriodEnd(
  sub: Stripe.Subscription,
): string | null {
  // Stripe typings expose current period end at subscription level.
  const fromTop = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  return unixSecondsToIso(fromTop);
}

function deriveBillingInterval(sub: Stripe.Subscription): BillingInterval | null {
  const interval = sub.items.data[0]?.price?.recurring?.interval;
  if (interval === "month" || interval === "year") return interval;
  return null;
}

async function resolveUserIdFromSubscription(
  admin: ReturnType<typeof createServiceRoleClient>,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = sub.metadata?.user_id?.trim();
  if (fromMeta) return fromMeta;
  const cust =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  if (!cust) return null;
  const { data } = await admin
    .from("purchases")
    .select("user_id")
    .eq("provider", "stripe")
    .eq("provider_customer_id", cust)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.user_id) return null;
  return String(data.user_id);
}

async function upsertPurchaseFromSubscription(input: {
  admin: ReturnType<typeof createServiceRoleClient>;
  userId: string;
  subscription: Stripe.Subscription;
  amountGbpPence: number;
  status: string;
}): Promise<void> {
  const { admin, userId, subscription, amountGbpPence, status } = input;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? "";
  const mapping = priceIdToTier(priceId);
  if (!mapping) {
    throw new Error(`Unknown Stripe price id: ${priceId}`);
  }
  const productLabel = `${mapping.tier === "pro" ? "Pro" : "Family"} ${
    mapping.interval === "month" ? "Monthly" : "Annual"
  }`;
  const periodEndIso = deriveSubscriptionPeriodEnd(subscription);
  const interval = deriveBillingInterval(subscription);

  const { error } = await admin.from("purchases").upsert(
    {
      user_id: userId,
      product: productLabel,
      amount_gbp_pence: amountGbpPence,
      currency: "GBP",
      provider: "stripe",
      provider_order_id: subscription.id,
      provider_customer_id: customerId,
      status,
      subscription_status: subscription.status,
      subscription_period_end: periodEndIso,
      billing_interval: interval,
      metadata: {
        stripe_price_id: priceId,
      },
    },
    { onConflict: "provider,provider_order_id" },
  );
  if (error) throw new Error(error.message);
}

async function setProfileTier(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  tier: "pro" | "family",
  tierExpiresAt: string | null,
) {
  const { error } = await admin
    .from("profiles")
    .update({
      tier,
      tier_expires_at: tierExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  if (!arePriceIdsConfigured()) {
    return NextResponse.json(
      { error: "Stripe price IDs are not configured." },
      { status: 500 },
    );
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid signature." },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const dedupe = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
    })
    .select("event_id")
    .maybeSingle();

  if (dedupe.error && dedupe.error.code !== "23505") {
    return NextResponse.json({ error: dedupe.error.message }, { status: 500 });
  }
  if (!dedupe.data) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id?.trim();
        if (!userId) break;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) break;
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const mapping = priceIdToTier(priceId);
        if (!mapping) throw new Error(`Unknown Stripe price id: ${priceId}`);
        await upsertPurchaseFromSubscription({
          admin,
          userId,
          subscription,
          amountGbpPence: Number(session.amount_total ?? 0),
          status: "completed",
        });
        await setProfileTier(admin, userId, mapping.tier, null);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(admin, subscription);
        if (!userId) break;
        const existingPurchase = await admin
          .from("purchases")
          .select("amount_gbp_pence")
          .eq("provider", "stripe")
          .eq("provider_order_id", subscription.id)
          .maybeSingle();
        await upsertPurchaseFromSubscription({
          admin,
          userId,
          subscription,
          amountGbpPence: Number(existingPurchase.data?.amount_gbp_pence ?? 0),
          status: "completed",
        });
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const mapping = priceIdToTier(priceId);
        if (!mapping) break;
        if (subscription.status === "active" || subscription.status === "trialing") {
          await setProfileTier(admin, userId, mapping.tier, null);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserIdFromSubscription(admin, subscription);
        if (!userId) break;
        const periodEnd = deriveSubscriptionPeriodEnd(subscription);
        const { error: purchaseErr } = await admin
          .from("purchases")
          .update({
            subscription_status: "canceled",
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("provider", "stripe")
          .eq("provider_order_id", subscription.id);
        if (purchaseErr) throw new Error(purchaseErr.message);
        const { error: profileErr } = await admin
          .from("profiles")
          .update({
            tier_expires_at: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        if (profileErr) throw new Error(profileErr.message);
        break;
      }

      case "invoice.payment_failed": {
        console.warn("[stripe webhook] invoice.payment_failed", {
          eventId: event.id,
        });
        break;
      }

      default:
        break;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handling failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
