import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { logTierChange } from "@/lib/stripe/tier-change-log";
import { priceIdToTier } from "@/lib/stripe/products";
import type { UserTier } from "@/lib/types";

function firstPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  const id =
    typeof item?.price === "string" ? item.price : item?.price?.id ?? null;
  return id;
}

function billingIntervalFromSub(
  sub: Stripe.Subscription,
): "month" | "year" | null {
  const id = firstPriceId(sub);
  if (!id) return null;
  return priceIdToTier(id)?.interval ?? null;
}

function userTierFromPaid(tier: "pro" | "family"): UserTier {
  return tier;
}

export async function downgradeProfileToFree(
  admin: SupabaseClient,
  userId: string,
  source: string,
): Promise<void> {
  logTierChange({
    action: "downgrade_to_free",
    user_id: userId,
    source,
  });
  const { error: pErr } = await admin
    .from("profiles")
    .update({
      tier: "free",
      tier_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (pErr) throw new Error(pErr.message);
  await archiveExcessTripsAfterDowngrade(admin, userId);
}

export async function upsertPurchaseFromStripeSubscription(
  admin: SupabaseClient,
  input: {
    userId: string;
    stripeCustomerId: string;
    subscription: Stripe.Subscription;
  },
): Promise<void> {
  const priceId = firstPriceId(input.subscription);
  if (!priceId) {
    console.warn("[stripe] subscription missing price id", input.subscription.id);
    return;
  }
  const mapped = priceIdToTier(priceId);
  if (!mapped) {
    console.warn("[stripe] unknown price on subscription", priceId);
    return;
  }
  const sub = input.subscription;
  const cpe = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const interval = billingIntervalFromSub(sub);
  const row = {
    user_id: input.userId,
    product: mapped.tier,
    amount_gbp_pence: 0,
    currency: "GBP",
    provider: "stripe",
    provider_order_id: sub.id,
    provider_customer_id: input.stripeCustomerId,
    status: sub.status,
    subscription_status: sub.status,
    subscription_period_end: cpe,
    billing_interval: interval,
    stripe_price_id: priceId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("purchases").upsert(row, {
    onConflict: "provider,provider_order_id",
  });
  if (error) throw new Error(error.message);

  console.log("[stripe webhook] purchase recorded", {
    userId: input.userId,
    product: mapped.tier,
    amount_gbp_pence: row.amount_gbp_pence,
  });

  if (
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due"
  ) {
    const atPeriodEnd = Boolean(sub.cancel_at_period_end) && cpe;
    const { data: beforeRow, error: beforeErr } = await admin
      .from("profiles")
      .select("tier")
      .eq("id", input.userId)
      .maybeSingle();
    if (beforeErr) throw new Error(beforeErr.message);
    const newTier = userTierFromPaid(mapped.tier);
    const { error: pErr } = await admin
      .from("profiles")
      .update({
        tier: newTier,
        tier_expires_at: atPeriodEnd ? cpe : null,
        stripe_customer_id: input.stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.userId);
    if (pErr) throw new Error(pErr.message);
    console.log("[stripe webhook] tier updated", {
      userId: input.userId,
      oldTier: beforeRow?.tier ?? null,
      newTier,
    });
  } else if (sub.status === "canceled") {
    const end = cpe ?? new Date().toISOString();
    const endMs = new Date(end).getTime();
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      await downgradeProfileToFree(
        admin,
        input.userId,
        "stripe_subscription_canceled",
      );
    } else {
      const { error: pErr } = await admin
        .from("profiles")
        .update({
          tier_expires_at: end,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.userId);
      if (pErr) throw new Error(pErr.message);
    }
  } else if (sub.status === "unpaid" || sub.status === "incomplete_expired") {
    await downgradeProfileToFree(
      admin,
      input.userId,
      `stripe_subscription_${sub.status}`,
    );
  }
}

export async function archiveExcessTripsAfterDowngrade(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: trips, error } = await admin
    .from("trips")
    .select("id, updated_at")
    .eq("owner_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!trips || trips.length <= 1) return;
  const [, ...rest] = trips;
  const ids = rest.map((t) => t.id as string);
  if (ids.length === 0) return;
  const { error: upErr } = await admin
    .from("trips")
    .update({
      is_archived: true,
      archived_reason: "tier_downgrade",
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (upErr) throw new Error(upErr.message);
}
