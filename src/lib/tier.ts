import { createClient } from "@/lib/supabase/server";
import { readProfileRow } from "@/lib/supabase/profile-read";
import { TierError, type TierErrorCode } from "@/lib/tier-errors";
import {
  canRetailTierPublishPublic,
  getEffectiveRetailTier,
  normalizeToRetailTier,
  type RetailTier,
} from "@/lib/tiers";

/** Product tier for planner gating (Free / Pro / Family). */
export type Tier = RetailTier;

export type ProductTier = RetailTier;

export type TierFeature = "trips" | "ai" | "public_share";

export { formatProductTierName } from "./product-tier-labels";

export const TIER_LIMITS: Record<
  RetailTier,
  { activeTrips: number | "unlimited"; aiEnabled: boolean }
> = {
  free: {
    activeTrips: 1,
    aiEnabled: true,
  },
  pro: {
    activeTrips: "unlimited",
    aiEnabled: true,
  },
  family: {
    activeTrips: "unlimited",
    aiEnabled: true,
  },
};

type PurchaseRow = {
  subscription_status: string | null;
  product: string | null;
};

async function activeStripeRetailTier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<RetailTier | null> {
  const { data, error } = await supabase
    .from("purchases")
    .select("subscription_status, product, created_at")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .in("subscription_status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = (data?.[0] ?? null) as PurchaseRow | null;
  if (!row?.subscription_status) return null;
  const st = row.subscription_status;
  if (st === "active" || st === "trialing") {
    return normalizeToRetailTier(row.product ?? "pro");
  }
  if (st === "past_due") {
    return normalizeToRetailTier(row.product ?? "pro");
  }
  return null;
}

/**
 * Effective retail tier for the user (Stripe purchase row wins when active;
 * otherwise profile tier + expiry).
 */
export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = await createClient();
  const fromStripe = await activeStripeRetailTier(supabase, userId);
  if (fromStripe === "pro" || fromStripe === "family") {
    return fromStripe;
  }

  const pr = await readProfileRow<{
    tier: string;
    tier_expires_at?: string | null;
  }>(supabase, userId, "tier, tier_expires_at");
  if (!pr.ok) {
    throw new Error(`TIER_LOAD_FAILED: ${pr.message}`);
  }
  return getEffectiveRetailTier({
    tier: pr.data.tier,
    tier_expires_at: pr.data.tier_expires_at ?? null,
  });
}

/** Active (non-archived) trips for caps. */
export async function countActiveTripsForUser(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("is_archived", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function maxActiveTripsForUser(
  userId: string,
): Promise<number | "unlimited"> {
  const tier = await getUserTier(userId);
  const lim = TIER_LIMITS[tier].activeTrips;
  return lim === "unlimited" ? "unlimited" : lim;
}

export async function assertTierAllows(
  userId: string,
  feature: TierFeature,
): Promise<void> {
  const tier = await getUserTier(userId);
  if (feature === "ai") {
    if (!TIER_LIMITS[tier].aiEnabled) {
      throw new TierError("TIER_AI_DISABLED");
    }
    return;
  }
  if (feature === "trips") {
    const cap = await maxActiveTripsForUser(userId);
    if (cap === "unlimited") return;
    const n = await countActiveTripsForUser(userId);
    if (n >= cap) {
      throw new TierError("TIER_LIMIT_TRIPS");
    }
    return;
  }
  if (feature === "public_share") {
    if (!canRetailTierPublishPublic(tier)) {
      throw new TierError(
        "TIER_PUBLIC_SHARE_DISABLED",
        "Public sharing is included with Pro and Family plans.",
      );
    }
  }
}

export function tierErrorToClientPayload(err: unknown): {
  ok: false;
  code: TierErrorCode;
  error: string;
} | null {
  if (err instanceof TierError) {
    return {
      ok: false,
      code: err.code,
      error: err.message,
    };
  }
  return null;
}
