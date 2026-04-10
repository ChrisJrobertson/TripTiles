import { AchievementsClient } from "@/app/(app)/achievements/AchievementsClient";
import { AppNavHeader } from "@/components/app/AppNavHeader";
import {
  getAchievementDefinitions,
  getUserAchievements,
} from "@/lib/db/achievements";
import { getUserTripCount } from "@/lib/db/trips";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { UserTier } from "@/lib/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Trip Passport · TripTiles",
  description: "Your earned stamps and milestones from planning theme park trips.",
};

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add Supabase environment variables to{" "}
            <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/achievements");

  const supabase = await createClient();
  const [definitions, earned, profileRes, tripCount] = await Promise.all([
    getAchievementDefinitions(),
    getUserAchievements(user.id),
    supabase
      .from("profiles")
      .select("trips_planned_count, days_planned_count, tier")
      .eq("id", user.id)
      .maybeSingle(),
    getUserTripCount(user.id),
  ]);

  const raw = profileRes.data as
    | {
        trips_planned_count?: number;
        days_planned_count?: number;
        tier?: UserTier;
      }
    | null;
  const progress = {
    trips_planned_count: Number(raw?.trips_planned_count ?? 0),
    days_planned_count: Number(raw?.days_planned_count ?? 0),
  };

  return (
    <div className="min-h-screen bg-cream pb-16 pt-0">
      <AppNavHeader
        userEmail={user.email ?? ""}
        userTier={raw?.tier ?? null}
        tripCount={tripCount}
        freeTripLimit={1}
      />
      <AchievementsClient
        definitions={definitions}
        earned={earned}
        progress={progress}
      />
    </div>
  );
}
