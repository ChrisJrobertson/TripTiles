import { getTierConfig } from "@/lib/tiers";
import {
  readProfileRow,
  tierFromProfileRow,
} from "@/lib/supabase/profile-read";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { countActiveTripsForUser, getUserTier, maxActiveTripsForUser } from "@/lib/tier";
import type { UserTier } from "@/lib/types";

const AI_GENERATIONS_TOTAL_COLUMN = "ai_generations_life" + "time";

/** Loads `profiles.tier` for the signed-in user. Throws if the row is missing or invalid. */
export async function getCurrentTier(): Promise<UserTier> {
  const user = await getCurrentUser();
  if (!user) return "free";
  const supabase = await createClient();
  const r = await readProfileRow<{ tier: string }>(supabase, user.id, "tier");
  if (!r.ok) {
    throw new Error(`TIER_LOAD_FAILED: ${r.message}`);
  }
  return tierFromProfileRow(r.data) as UserTier;
}

export async function currentUserCanCreateTrip(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const cap = await maxActiveTripsForUser(user.id);
  if (cap === "unlimited") return true;
  const n = await countActiveTripsForUser(user.id);
  return n < cap;
}

export async function currentUserCanGenerateAI(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(AI_GENERATIONS_TOTAL_COLUMN)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const rt = await getUserTier(user.id);
  const cfg = getTierConfig(rt);
  const cap = cfg.features.maxSmartPlanRuns;
  if (cap === null) return true;
  const used = Number(
    (profile as Record<string, number | undefined> | null)?.[
      AI_GENERATIONS_TOTAL_COLUMN
    ] ?? 0,
  );
  return used < cap;
}

export async function currentUserCanUseAIDayPlanner(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const rt = await getUserTier(user.id);
  return getTierConfig(rt).features.ai_day_planner;
}

export async function currentUserCanCreateCustomTile(): Promise<boolean> {
  const tier = await getCurrentTier();
  const config = getTierConfig(tier);
  if (config.features.max_custom_tiles === null) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { count } = await supabase
    .from("custom_tiles")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (count ?? 0) < (config.features.max_custom_tiles ?? 0);
}

export async function currentUserCanCreatePayment(
  tripId: string,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const rt = await getUserTier(user.id);
  const lim = getTierConfig(rt).features.max_payments_per_trip;
  if (lim === null) return true;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("trip_payments")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);
  return (count ?? 0) < lim;
}

export async function currentUserCanCreateRidePriority(
  tripId: string,
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const rt = await getUserTier(user.id);
  const lim = getTierConfig(rt).features.max_ride_priorities_per_trip;
  if (lim === null) return true;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("trip_ride_priorities")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);
  return (count ?? 0) < lim;
}
