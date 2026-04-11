"use server";

import {
  getAchievementDefinitions,
  getUserAchievements,
} from "@/lib/db/achievements";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function awardAchievementAction(
  achievementKey: string,
): Promise<
  { ok: true; justEarned: boolean } | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("achievements")
      .select("id")
      .eq("user_id", user.id)
      .eq("achievement_key", achievementKey)
      .maybeSingle();

    if (existing) {
      return { ok: true, justEarned: false };
    }

    const { error } = await supabase.from("achievements").insert({
      user_id: user.id,
      achievement_key: achievementKey,
      earned_at: new Date().toISOString(),
      metadata: {},
    });

    if (error) {
      if (error.code === "23505") {
        return { ok: true, justEarned: false };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/planner");
    revalidatePath("/achievements");
    return { ok: true, justEarned: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Server-only: award another user (e.g. original plan owner on clone milestones). */
export async function tryAwardAchievementForUserId(
  userId: string,
  achievementKey: string,
): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const { data: existing } = await admin
      .from("achievements")
      .select("id")
      .eq("user_id", userId)
      .eq("achievement_key", achievementKey)
      .maybeSingle();
    if (existing) return;
    const { error } = await admin.from("achievements").insert({
      user_id: userId,
      achievement_key: achievementKey,
      earned_at: new Date().toISOString(),
      metadata: {},
    });
    if (error && error.code !== "23505") {
      console.warn("[achievements] tryAwardAchievementForUserId:", error.message);
    }
  } catch (e) {
    console.warn("[achievements] tryAwardAchievementForUserId:", e);
  }
}

export async function checkAndAwardMilestonesAction(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("trips_planned_count, days_planned_count")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !profile) return [];

  const tripsCount = Number(
    (profile as { trips_planned_count?: number }).trips_planned_count ?? 0,
  );
  const daysCount = Number(
    (profile as { days_planned_count?: number }).days_planned_count ?? 0,
  );

  const defs = await getAchievementDefinitions();
  const earned = await getUserAchievements(user.id);
  const have = new Set(earned.map((a) => a.achievement_key));

  const newly: string[] = [];

  for (const def of defs) {
    if (def.category !== "trips" && def.category !== "days") continue;
    if (def.threshold == null) continue;
    if (have.has(def.key)) continue;

    const stat =
      def.category === "trips" ? tripsCount : daysCount;
    if (stat >= def.threshold) {
      const r = await awardAchievementAction(def.key);
      if (r.ok && r.justEarned) {
        newly.push(def.key);
        have.add(def.key);
      }
    }
  }

  return newly;
}
