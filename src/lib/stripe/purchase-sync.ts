import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  mapStripeIdsToProductSku,
  priceIdToTier,
  productSkuToProfileTier,
} from "@/lib/stripe/products";
import { logTierChange } from "@/lib/stripe/tier-change-log";
import type { UserTier } from "@/lib/types";

function firstPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  if (!item?.price) return null;
  return typeof item.price === "string" ? item.price : item.price.id;
}

function firstProductId(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  if (!item?.price || typeof item.price === "string") return null;
  const p = item.price.product;
  if (typeof p === "string") return p;
  return p?.id ?? null;
}

function billingIntervalFromSub(
  sub: Stripe.Subscription,
): "month" | "year" | null {
  const id = firstPriceId(sub);
  if (!id) return null;
  return priceIdToTier(id)?.interval ?? null;
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

const purchaseRowFields = (input: {
  userId: string;
  product: string;
  stripeCustomerId: string;
  sub: Stripe.Subscription;
  priceId: string;
  cpe: string | null;
  interval: "month" | "year" | null;
}) => ({
  user_id: input.userId,
  product: input.product,
  amount_gbp_pence: 0,
  currency: "GBP",
  provider: "stripe" as const,
  provider_order_id: input.sub.id,
  provider_customer_id: input.stripeCustomerId,
  status: input.sub.status,
  subscription_status: input.sub.status,
  subscription_period_end: input.cpe,
  billing_interval: input.interval,
  stripe_price_id: input.priceId,
  updated_at: new Date().toISOString(),
});

export async function upsertPurchaseFromStripeSubscription(
  admin: SupabaseClient,
  input: {
    userId: string;
    stripeCustomerId: string;
    subscription: Stripe.Subscription;
  },
): Promise<void> {
  const sub = input.subscription;
  const priceId = firstPriceId(sub);
  const productId = firstProductId(sub);
  if (!priceId) {
    console.warn(
      "[stripe] subscription missing price id",
      input.subscription.id,
    );
    return;
  }
  const productSku = mapStripeIdsToProductSku(productId, priceId);
  if (!productSku) {
    console.warn(
      "[stripe] unknown product/price on subscription",
      productId,
      priceId,
    );
    return;
  }
  const cpe = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const interval = billingIntervalFromSub(sub);
  const baseRow = purchaseRowFields({
    userId: input.userId,
    product: productSku,
    stripeCustomerId: input.stripeCustomerId,
    sub,
    priceId,
    cpe,
    interval,
  });

  const { data: existing, error: selErr } = await admin
    .from("purchases")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_order_id", sub.id)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existing?.id) {
    const { error: upErr } = await admin
      .from("purchases")
      .update(baseRow)
      .eq("id", existing.id);
    if (upErr) throw new Error(upErr.message);
  } else {
    const { error: inErr } = await admin.from("purchases").insert(baseRow);
    if (inErr) throw new Error(inErr.message);
  }

  console.log("[stripe webhook] purchase recorded", {
    userId: input.userId,
    product: productSku,
    amount_gbp_pence: baseRow.amount_gbp_pence,
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
    const newTier: UserTier = productSkuToProfileTier(productSku);
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

/** Marks the Stripe subscription purchase as past_due. Does not change profile tier. */
export async function setPurchasePastDueBySubscriptionId(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<void> {
  if (!subscriptionId?.trim()) return;
  const { data: row, error: selErr } = await admin
    .from("purchases")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_order_id", subscriptionId.trim())
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (!row?.id) {
    console.warn("[stripe webhook] no purchase for subscription (past_due)", {
      subscriptionId,
    });
    return;
  }
  const { error: upErr } = await admin
    .from("purchases")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (upErr) throw new Error(upErr.message);
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
