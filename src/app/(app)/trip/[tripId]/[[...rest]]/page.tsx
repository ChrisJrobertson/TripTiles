import { PlannerClient } from "@/app/(app)/planner/PlannerClient";
import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { getPublicSiteUrl } from "@/lib/site";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { loadPlannerClientServerData } from "@/lib/planner-server-data";
import { isDateKeyInTripRange } from "@/lib/trip-date-range";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TripPlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string; rest?: string[] }>;
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
            Add Supabase environment variables to{" "}
            <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/planner");

  const { tripId, rest } = await params;
  const sp = await searchParams;

  const dayDate =
    Array.isArray(rest) &&
    rest.length === 2 &&
    rest[0] === "day" &&
    /^\d{4}-\d{2}-\d{2}$/.test(rest[1] ?? "")
      ? rest[1]!
      : null;

  if (Array.isArray(rest) && rest.length > 0 && !dayDate) {
    notFound();
  }

  const supabase = await createClient();
  const siteUrl = getPublicSiteUrl() || "http://localhost:3001";
  const loaded = await loadPlannerClientServerData({
    supabase,
    userId: user.id,
    userEmail: user.email ?? "",
    siteUrl,
    searchParams: sp,
    forcedTripId: tripId,
  });

  if (!loaded.ok) {
    if (loaded.error === "tier") {
      return <ProfileLoadErrorPanel detail={loaded.message} />;
    }
    if (loaded.error === "trip_not_found") notFound();
    return <ProfileLoadErrorPanel detail={loaded.message} />;
  }

  const trip = loaded.props.initialTrips.find((t) => t.id === tripId);
  if (!trip) notFound();

  if (dayDate && !isDateKeyInTripRange(trip, dayDate)) {
    notFound();
  }

  const p = loaded.props;

  return (
    <PlannerClient
      initialTrips={p.initialTrips}
      parks={p.parks}
      regions={p.regions}
      initialOpenSmartPlan={p.initialOpenSmartPlan}
      initialAutoGenerate={p.initialAutoGenerate}
      initialActiveTripId={p.initialActiveTripId}
      userEmail={p.userEmail}
      userTier={p.profileTier}
      productTier={p.productTier}
      productPlanLabel={p.productPlanLabel}
      maxActiveTripCap={p.maxActiveTripCap}
      stripeCustomerId={p.stripeCustomerId}
      achievementDefs={p.achievementDefs}
      aiGenerationCountsByTrip={p.aiGenerationCountsByTrip}
      siteUrl={p.siteUrl}
      initialTileScrubNotice={p.initialTileScrubNotice}
      initialCustomTiles={p.initialCustomTiles}
      customTileLimit={p.customTileLimit}
      plannerTab={p.plannerTab}
      initialPlanningSection={p.initialPlanningSection}
      temperatureUnit={p.initialTemperatureUnit}
      emailMarketingOptOut={p.emailMarketingOptOut}
      initialRidePrioritiesByTripId={p.initialRidePrioritiesByTripId}
      ridePriorityCountByTripAndDay={p.ridePriorityCountByTripAndDay}
      initialPaymentsByTripId={p.initialPaymentsByTripId}
      tripRouteBase={`/trip/${tripId}`}
    />
  );
}
