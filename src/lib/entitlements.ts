import { getEffectiveTier, getTierConfig, type PublicTier } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { UserTier } from "@/lib/types";
import { formatDateISO } from "@/lib/date-helpers";

/** Loads `profiles.tier` for the signed-in user. Throws if the row is missing or invalid. */
export async function getCurrentTier(): Promise<PublicTier> {
  const user = await getCurrentUser();
  if (!user) return "free";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("tier, tier_expires_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return "free";
  return getEffectiveTier({
    tier: String((data as { tier?: string }).tier ?? "free"),
    tier_expires_at:
      (data as { tier_expires_at?: string | null }).tier_expires_at ?? null,
  });
}

export async function currentUserCanCreateTrip(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const tier = await getCurrentTier();
  const cfg = getTierConfig(tier);
  if (cfg.limits.trips < 0) return true;
  const supabase = await createClient();
  const { count } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("is_archived", false);
  return (count ?? 0) < cfg.limits.trips;
}

export async function currentUserCanGenerateAI(
  tripId: string,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const tier = await getCurrentTier();
  const cfg = getTierConfig(tier);
  const limit = cfg.limits.ai_smart_plan_lifetime;
  if (limit < 0) return true;
  const supabase = await createClient();
  const { count } = await supabase
    .from("ai_generations")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("success", true);
  return (count ?? 0) < limit;
}

export async function currentUserCanCreateCustomTile(): Promise<boolean> {
  const tier = await getCurrentTier();
  const config = getTierConfig(tier);
  if (config.limits.custom_tiles < 0) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { count } = await supabase
    .from("custom_tiles")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (count ?? 0) < config.limits.custom_tiles;
}

export async function currentUserCanCreatePayment(
  tripId: string,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const tier = await getCurrentTier();
  const cfg = getTierConfig(tier);
  if (cfg.limits.trip_payments < 0) return true;
  const supabase = await createClient();
  const { count } = await supabase
    .from("trip_payments")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);
  return (count ?? 0) < cfg.limits.trip_payments;
}

export async function currentUserCanCreateRidePriority(
  tripId: string,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const tier = await getCurrentTier();
  const cfg = getTierConfig(tier);
  if (cfg.limits.ride_priorities_per_trip < 0) return true;
  const supabase = await createClient();
  const { count } = await supabase
    .from("trip_ride_priorities")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);
  return (count ?? 0) < cfg.limits.ride_priorities_per_trip;
}

export async function currentUserCanUseAIDayPlanner(): Promise<boolean> {
  const tier = await getCurrentTier();
  return getTierConfig(tier).limits.ai_day_planner_enabled;
}

export async function getCurrentTierWithExpiry(): Promise<{
  tier: PublicTier;
  tier_expires_at: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { tier: "free", tier_expires_at: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("tier, tier_expires_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return { tier: "free", tier_expires_at: null };
  const rawTier = String((data as { tier?: string }).tier ?? "free") as UserTier;
  const expires =
    (data as { tier_expires_at?: string | null }).tier_expires_at ?? null;
  return {
    tier: getEffectiveTier({ tier: rawTier, tier_expires_at: expires }),
    tier_expires_at: expires ? formatDateISO(new Date(expires)) : null,
  };
}
