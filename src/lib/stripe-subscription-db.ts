import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { tierFromStripePriceId } from "@/lib/stripe-config";

function firstPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  const id =
    typeof item?.price === "string"
      ? item.price
      : item?.price?.id ?? null;
  return id;
}

export async function upsertUserSubscriptionFromStripe(
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
  const tier = tierFromStripePriceId(priceId);
  if (!tier) {
    console.warn("[stripe] unknown price on subscription", priceId);
    return;
  }
  const status = input.subscription.status;
  const cpe = input.subscription.current_period_end
    ? new Date(input.subscription.current_period_end * 1000).toISOString()
    : null;
  const row = {
    user_id: input.userId,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.subscription.id,
    status,
    tier,
    price_id: priceId,
    current_period_end: cpe,
    payment_status: input.subscription.status,
    grace_until:
      input.subscription.status === "past_due"
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("user_subscriptions").upsert(row, {
    onConflict: "stripe_subscription_id",
  });
  if (error) throw new Error(error.message);
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
