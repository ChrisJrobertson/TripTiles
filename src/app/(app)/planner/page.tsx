import { PlannerClient } from "@/app/(app)/planner/PlannerClient";
import { getAchievementDefinitions } from "@/lib/db/achievements";
import { getSuccessfulAiGenerationCountsForTrips } from "@/lib/db/ai-generations";
import {
  getCustomTileLimit,
  getUserCustomTiles,
} from "@/lib/db/custom-tiles";
import { getAllParks } from "@/lib/db/parks";
import { getAllRegions } from "@/lib/db/regions";
import { getActiveTripForUser, getUserTrips } from "@/lib/db/trips";
import { getPublicSiteUrl } from "@/lib/site";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { UserTier } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add{" "}
            <code className="rounded bg-cream px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and either{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            or{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </code>{" "}
            to <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/planner");

  const trips = await getUserTrips(user.id);
  if (trips.length === 0) {
    redirect("/onboarding");
  }

  const sp = await searchParams;
  const purchaseHighlight =
    firstParam(sp.purchase) === "pending" ||
    firstParam(sp.checkout) === "success" ||
    firstParam(sp.upgraded) === "pending";

  const tileScrubRaw = firstParam(sp.tile_scrubbed);
  const initialTileScrubNotice =
    tileScrubRaw !== undefined &&
    tileScrubRaw !== "" &&
    !Number.isNaN(Number(tileScrubRaw))
      ? Math.max(0, Math.floor(Number(tileScrubRaw)))
      : null;

  const [
    parks,
    regions,
    activeTrip,
    profileTier,
    achievementDefs,
    customTiles,
    customTileLimit,
  ] = await Promise.all([
      getAllParks(),
      getAllRegions(),
      getActiveTripForUser(user.id),
      (async (): Promise<UserTier | null> => {
        const supabase = await createClient();
        const { data } = await supabase
          .from("profiles")
          .select("tier")
          .eq("id", user.id)
          .maybeSingle();
        if (!data || typeof data !== "object" || !("tier" in data)) return null;
        return data.tier as UserTier;
      })(),
      getAchievementDefinitions(),
      getUserCustomTiles(user.id),
      getCustomTileLimit(user.id),
    ]);

  const tripIds = trips.map((t) => t.id);
  const aiGenerationCountsByTrip =
    await getSuccessfulAiGenerationCountsForTrips(tripIds, user.id);

  const siteUrl = getPublicSiteUrl() || "http://localhost:3001";

  return (
    <PlannerClient
      initialTrips={trips}
      parks={parks}
      regions={regions}
      initialActiveTripId={activeTrip?.id ?? null}
      userEmail={user.email ?? ""}
      userTier={profileTier}
      achievementDefs={achievementDefs}
      aiGenerationCountsByTrip={aiGenerationCountsByTrip}
      siteUrl={siteUrl}
      purchaseHighlight={purchaseHighlight}
      initialTileScrubNotice={initialTileScrubNotice}
      initialCustomTiles={customTiles}
      customTileLimit={customTileLimit}
    />
  );
}
