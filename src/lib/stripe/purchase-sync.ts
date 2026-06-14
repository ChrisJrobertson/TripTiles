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

function periodEndFromSubscription(sub: Stripe.Subscription): string | null {
  return sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
}

function purchaseStatusFromStripe(subStatus: string): string {
  if (
    subStatus === "active" ||
    subStatus === "trialing" ||
    subStatus === "past_due"
  ) {
    return "active";
  }
  if (subStatus === "canceled") return "canceled";
  return subStatus;
}

export function periodEndFromInvoice(inv: Stripe.Invoice): string | null {
  const line = inv.lines?.data?.[0];
  if (!line?.period?.end) return null;
  return new Date(line.period.end * 1000).toISOString();
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
      stripe_subscription_id: null,
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
  status: purchaseStatusFromStripe(input.sub.status),
  subscription_status: input.sub.status,
  subscription_period_end: input.cpe,
  billing_interval: input.interval,
  stripe_price_id: input.priceId,
  updated_at: new Date().toISOString(),
});

async function upsertPurchaseRow(
  admin: SupabaseClient,
  baseRow: ReturnType<typeof purchaseRowFields>,
  subscriptionId: string,
): Promise<void> {
  const { data: existing, error: selErr } = await admin
    .from("purchases")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_order_id", subscriptionId)
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
}

export async function upsertPurchaseFromStripeSubscription(
  admin: SupabaseClient,
  input: {
    userId: string;
    stripeCustomerId: string;
    subscription: Stripe.Subscription;
    /** When true, profile tier is not changed (e.g. past_due / unpaid grace). */
    profileGracePeriod?: boolean;
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
  const cpe = periodEndFromSubscription(sub);
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

  await upsertPurchaseRow(admin, baseRow, sub.id);

  console.log("[stripe webhook] purchase recorded", {
    userId: input.userId,
    product: productSku,
    amount_gbp_pence: baseRow.amount_gbp_pence,
  });

  if (input.profileGracePeriod) {
    console.info(
      "[stripe webhook] subscription in grace period — profile tier unchanged",
      { userId: input.userId, status: sub.status },
    );
    return;
  }

  if (sub.status === "canceled") {
    // customer.subscription.deleted handles profile cleanup; only mirror purchase row.
    return;
  }

  if (
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired" ||
    sub.status === "incomplete"
  ) {
    console.info(
      "[stripe webhook] subscription not entitled — profile tier unchanged (grace)",
      { userId: input.userId, status: sub.status },
    );
    return;
  }

  if (
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due"
  ) {
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
        tier_expires_at: cpe,
        stripe_customer_id: input.stripeCustomerId,
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.userId);
    if (pErr) throw new Error(pErr.message);
    console.log("[stripe webhook] tier updated", {
      userId: input.userId,
      oldTier: beforeRow?.tier ?? null,
      newTier,
      tier_expires_at: cpe,
    });
  }
}

/** Immediate cleanup when Stripe deletes a subscription. */
export async function handleSubscriptionDeleted(
  admin: SupabaseClient,
  input: {
    userId: string;
    subscriptionId: string;
  },
): Promise<void> {
  const { subscriptionId, userId } = input;
  const { data: row, error: selErr } = await admin
    .from("purchases")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_order_id", subscriptionId)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (row?.id) {
    const { error: upErr } = await admin
      .from("purchases")
      .update({
        status: "canceled",
        subscription_status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
  }
  await downgradeProfileToFree(admin, userId, "stripe_subscription_deleted");
}

export async function updatePeriodEndFromInvoice(
  admin: SupabaseClient,
  input: {
    userId: string;
    subscriptionId: string;
    periodEnd: string;
  },
): Promise<void> {
  const { userId, subscriptionId, periodEnd } = input;
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      tier_expires_at: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileErr) throw new Error(profileErr.message);

  const { data: row, error: selErr } = await admin
    .from("purchases")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_order_id", subscriptionId)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (!row?.id) {
    console.warn("[stripe webhook] no purchase row for invoice renewal", {
      subscriptionId,
      userId,
    });
    return;
  }
  const { error: upErr } = await admin
    .from("purchases")
    .update({
      subscription_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (upErr) throw new Error(upErr.message);
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
