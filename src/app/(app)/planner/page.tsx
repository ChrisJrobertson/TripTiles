import { PlannerClient } from "@/app/(app)/planner/PlannerClient";
import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { getActiveTripForUser } from "@/lib/db/trips";
import { loadPlannerClientServerData } from "@/lib/planner-server-data";
import { getPublicSiteUrl } from "@/lib/site";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
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
      <main className="min-h-screen bg-transparent px-6 py-12">
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

  const sp = await searchParams;
  const supabase = await createClient();
  const siteUrl = getPublicSiteUrl() || "https://www.triptiles.app";
  const loaded = await loadPlannerClientServerData({
    supabase,
    userId: user.id,
    userEmail: user.email ?? "",
    siteUrl,
    searchParams: sp,
    forcedTripId: null,
  });

  if (!loaded.ok) {
    if (loaded.error === "tier") {
      return <ProfileLoadErrorPanel detail={loaded.message} />;
    }
    if (loaded.error === "profile") {
      return <ProfileLoadErrorPanel detail={loaded.message} />;
    }
    return <ProfileLoadErrorPanel detail={loaded.message} />;
  }

  const trips = loaded.props.initialTrips;
  if (trips.length > 0) {
    const active = await getActiveTripForUser(user.id);
    const tripId = active?.id ?? trips[0]!.id;

    const qs = new URLSearchParams();
    for (const [k, raw] of Object.entries(sp)) {
      const v = firstParam(raw);
      if (v != null && v !== "") qs.set(k, v);
    }
    const q = qs.toString();
    redirect(q ? `/trip/${tripId}?${q}` : `/trip/${tripId}`);
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
      cataloguedParkIds={p.cataloguedParkIds}
    />
  );
}
