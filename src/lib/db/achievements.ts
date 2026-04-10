import { createClient } from "@/lib/supabase/server";
import type { Achievement, AchievementDefinition } from "@/lib/types";

export async function getUserAchievements(
  userId: string,
): Promise<Achievement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Achievement[];
}

export async function getAchievementDefinitions(): Promise<
  AchievementDefinition[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("achievement_definitions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AchievementDefinition[];
}
