import { getTierConfig, type Tier } from "@/lib/tiers";
import {
  readProfileRow,
  tierFromProfileRow,
} from "@/lib/supabase/profile-read";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  TIER_LIMITS,
  countActiveTripsForUser,
  getUserTier,
  maxActiveTripsForUser,
} from "@/lib/tier";

/** Loads `profiles.tier` for the signed-in user. Throws if the row is missing or invalid. */
export async function getCurrentTier(): Promise<Tier> {
  const user = await getCurrentUser();
  if (!user) return "free";
  const supabase = await createClient();
  const r = await readProfileRow<{ tier: string }>(supabase, user.id, "tier");
  if (!r.ok) {
    throw new Error(`TIER_LOAD_FAILED: ${r.message}`);
  }
  return tierFromProfileRow(r.data) as Tier;
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

  const ut = await getUserTier(user.id);
  return TIER_LIMITS[ut].aiEnabled;
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
