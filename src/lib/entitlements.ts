import { getTierConfig, type Tier } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function getCurrentTier(): Promise<Tier> {
  const user = await getCurrentUser();
  if (!user) return "free";
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.tier as Tier) ?? "free";
}

export async function currentUserCanCreateTrip(): Promise<boolean> {
  const tier = await getCurrentTier();
  const config = getTierConfig(tier);
  if (config.features.max_trips === null) return true;

  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { count } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id);

  return (count ?? 0) < (config.features.max_trips ?? 0);
}

export async function currentUserCanGenerateAI(tripId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const tier = await getCurrentTier();
  const config = getTierConfig(tier);
  if (config.features.max_ai_per_trip === null) return true;

  const supabase = await createClient();
  const { count } = await supabase
    .from("ai_generations")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("success", true);

  return (count ?? 0) < (config.features.max_ai_per_trip ?? 0);
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
