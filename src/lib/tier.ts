import { createClient } from "@/lib/supabase/server";
import { readProfileRow, tierFromProfileRow } from "@/lib/supabase/profile-read";
import type { UserTier } from "@/lib/types";
import { TierError, type TierErrorCode } from "@/lib/tier-errors";

/** Product tiers used for Stripe + gating (legacy Payhip tiers map in `getUserTier`). */
export type Tier = "day_tripper" | "navigator" | "captain";

export type TierFeature = "trips" | "ai";
/** Alias for spec / readability. */
export type Feature = TierFeature;

export function formatProductTierName(tier: Tier): string {
  if (tier === "day_tripper") return "Day Tripper";
  if (tier === "navigator") return "Navigator";
  return "Captain";
}

export const TIER_LIMITS: Record<
  Tier,
  { activeTrips: number | "unlimited"; aiEnabled: boolean; aiModel: "haiku" | "sonnet" | null }
> = {
  day_tripper: {
    activeTrips: 1,
    aiEnabled: false,
    aiModel: null,
  },
  navigator: {
    activeTrips: 5,
    aiEnabled: true,
    aiModel: "haiku",
  },
  captain: {
    activeTrips: "unlimited",
    aiEnabled: true,
    aiModel: "sonnet",
  },
};

type UserSubRow = {
  status: string;
  tier: string;
  grace_until: string | null;
};

function legacyProfileTierToProductTier(tier: UserTier): Tier {
  if (tier === "free") return "day_tripper";
  if (tier === "premium" || tier === "concierge") return "captain";
  if (tier === "pro" || tier === "family") return "captain";
  if (tier === "agent_admin" || tier === "agent_staff") return "captain";
  return "day_tripper";
}

function stripeSubToProductTier(row: UserSubRow): Tier | null {
  const s = row.status;
  if (s === "active" || s === "trialing") {
    return row.tier === "captain" ? "captain" : "navigator";
  }
  if (s === "past_due") {
    const grace = row.grace_until;
    if (grace && new Date(grace).getTime() > Date.now()) {
      return row.tier === "captain" ? "captain" : "navigator";
    }
    return "day_tripper";
  }
  return null;
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

/**
 * Resolves the user's effective product tier.
 * Stripe `user_subscriptions` wins when present; otherwise Payhip-era `profiles.tier` maps to closest product tier.
 */
export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = await createClient();
  const { data: subRows, error: subErr } = await supabase
    .from("user_subscriptions")
    .select("status, tier, grace_until, updated_at")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (subErr) throw new Error(subErr.message);
  const sub = (subRows?.[0] ?? null) as UserSubRow | null;
  if (sub) {
    const mapped = stripeSubToProductTier(sub);
    if (mapped) return mapped;
  }

  const pr = await readProfileRow<{ tier: string }>(supabase, userId, "tier");
  if (!pr.ok) {
    throw new Error(`TIER_LOAD_FAILED: ${pr.message}`);
  }
  const profileTier = tierFromProfileRow(pr.data) as UserTier;
  return legacyProfileTierToProductTier(profileTier);
}

/** Stripe Navigator has a 5-trip cap; legacy paid users stay unlimited. */
export async function maxActiveTripsForUser(userId: string): Promise<number | "unlimited"> {
  const supabase = await createClient();
  const { data: subRows } = await supabase
    .from("user_subscriptions")
    .select("status, tier, grace_until, updated_at")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1);
  const sub = subRows?.[0] as UserSubRow | undefined;
  if (sub) {
    const mapped = stripeSubToProductTier(sub);
    if (mapped === "navigator") return 5;
    if (mapped === "captain") return "unlimited";
  }
  const tier = await getUserTier(userId);
  const lim = TIER_LIMITS[tier].activeTrips;
  if (tier === "captain") return "unlimited";
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
