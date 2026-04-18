import { PlannerClient } from "@/app/(app)/planner/PlannerClient";
import { getPaymentsForTripIds } from "@/actions/payments";
import { getRidePrioritiesForTripIds } from "@/actions/ride-priorities";
import { getAchievementDefinitions } from "@/lib/db/achievements";
import { getSuccessfulAiGenerationCountsForTrips } from "@/lib/db/ai-generations";
import {
  getCustomTileLimit,
  getUserCustomTiles,
} from "@/lib/db/custom-tiles";
import { getAllParks } from "@/lib/db/parks";
import { getAllRegions } from "@/lib/db/regions";
import { getActiveTripForUser, getUserTrips } from "@/lib/db/trips";
import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { getPublicSiteUrl } from "@/lib/site";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import {
  readProfileRow,
  tierFromProfileRow,
} from "@/lib/supabase/profile-read";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { TemperatureUnit, UserTier } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import type { TripPayment } from "@/types/payments";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
/** Smart Plan server action can run up to Vercel Pro limit while generating. */
export const maxDuration = 60;

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalisePlannerTab(
  raw: string | undefined,
): "planner" | "budget" | "payments" | "checklist" {
  if (raw === "budget" || raw === "payments" || raw === "checklist") return raw;
  return "planner";
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

  const initialOpenSmartPlan = firstParam(sp.openSmartPlan) === "true";
  const initialAutoGenerate = firstParam(sp.autoGenerate) === "true";
  const plannerTab = normalisePlannerTab(firstParam(sp.tab));

  const tileScrubRaw = firstParam(sp.tile_scrubbed);
  const initialTileScrubNotice =
    tileScrubRaw !== undefined &&
    tileScrubRaw !== "" &&
    !Number.isNaN(Number(tileScrubRaw))
      ? Math.max(0, Math.floor(Number(tileScrubRaw)))
      : null;

  const supabase = await createClient();
  type PlannerProfileRow = {
    tier: string;
    temperature_unit?: string | null;
    email_marketing_opt_out?: boolean | null;
  };
  const profileRead = await readProfileRow<PlannerProfileRow>(
    supabase,
    user.id,
    "tier, temperature_unit, email_marketing_opt_out",
  );
  if (!profileRead.ok) {
    return (
      <ProfileLoadErrorPanel detail={profileRead.message} />
    );
  }
  const pr = profileRead.data;
  const profileBundle: {
    tier: UserTier;
    temperatureUnit: TemperatureUnit;
    emailMarketingOptOut: boolean;
  } = {
    tier: tierFromProfileRow(pr),
    temperatureUnit: pr.temperature_unit === "f" ? "f" : "c",
    emailMarketingOptOut: pr.email_marketing_opt_out === true,
  };

  const [
    parks,
    regions,
    activeTrip,
    achievementDefs,
    customTiles,
    customTileLimit,
  ] = await Promise.all([
      getAllParks(),
      getAllRegions(),
      getActiveTripForUser(user.id),
      getAchievementDefinitions(),
      getUserCustomTiles(user.id),
      getCustomTileLimit(user.id),
    ]);

  const tripIds = trips.map((t) => t.id);
  const aiGenerationCountsByTrip =
    await getSuccessfulAiGenerationCountsForTrips(tripIds, user.id);

  const ridePrioritiesFlat = await getRidePrioritiesForTripIds(tripIds);
  const initialRidePrioritiesByTripId = ridePrioritiesFlat.reduce<
    Record<string, TripRidePriority[]>
  >((acc, row) => {
    if (!acc[row.trip_id]) acc[row.trip_id] = [];
    acc[row.trip_id]!.push(row);
    return acc;
  }, {});

  const paymentsFlat = await getPaymentsForTripIds(tripIds);
  const initialPaymentsByTripId = paymentsFlat.reduce<
    Record<string, TripPayment[]>
  >((acc, row) => {
    if (!acc[row.trip_id]) acc[row.trip_id] = [];
    acc[row.trip_id]!.push(row);
    return acc;
  }, {});
  for (const id of tripIds) {
    if (!initialPaymentsByTripId[id]) initialPaymentsByTripId[id] = [];
  }
  for (const id of tripIds) {
    initialPaymentsByTripId[id]!.sort((a, b) => {
      const da = a.due_date;
      const db = b.due_date;
      if (da == null && db == null) return a.sort_order - b.sort_order;
      if (da == null) return 1;
      if (db == null) return -1;
      if (da < db) return -1;
      if (da > db) return 1;
      return a.sort_order - b.sort_order;
    });
  }

  const siteUrl = getPublicSiteUrl() || "http://localhost:3001";
  const profileTier = profileBundle.tier;
  const initialTemperatureUnit = profileBundle.temperatureUnit;
  const emailMarketingOptOut = profileBundle.emailMarketingOptOut;

  return (
    <PlannerClient
      initialTrips={trips}
      parks={parks}
      regions={regions}
      initialOpenSmartPlan={initialOpenSmartPlan}
      initialAutoGenerate={initialAutoGenerate}
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
      plannerTab={plannerTab}
      temperatureUnit={initialTemperatureUnit}
      emailMarketingOptOut={emailMarketingOptOut}
      initialRidePrioritiesByTripId={initialRidePrioritiesByTripId}
      initialPaymentsByTripId={initialPaymentsByTripId}
    />
  );
}
