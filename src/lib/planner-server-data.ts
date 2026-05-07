import { getPaymentsForTripIds } from "@/actions/payments";
import {
  getCataloguedParkIds,
  getRidePrioritiesForTrip,
  getRidePriorityCountsForTripIds,
} from "@/actions/ride-priorities";
import { getAchievementDefinitions } from "@/lib/db/achievements";
import { getSuccessfulAiGenerationCountsForTrips } from "@/lib/db/ai-generations";
import {
  getCustomTileLimit,
  getUserCustomTiles,
} from "@/lib/db/custom-tiles";
import { getAllParks } from "@/lib/db/parks";
import { getAllRegions } from "@/lib/db/regions";
import { getActiveTripForUser, getUserTrips } from "@/lib/db/trips";
import {
  readProfileRow,
  tierFromProfileRow,
} from "@/lib/supabase/profile-read";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import {
  formatProductTierName,
  getUserTier,
  maxActiveTripsForUser,
  type Tier,
} from "@/lib/tier";
import type { TemperatureUnit, UserTier } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import type { TripPayment } from "@/types/payments";
import { isTierLoadFailure, tierLoadFailureUserMessage } from "@/lib/supabase/tier-load-error";

export type PlannerProfileBundle = {
  tier: UserTier;
  temperatureUnit: TemperatureUnit;
  emailMarketingOptOut: boolean;
  stripeCustomerId: string | null;
};

export type PlannerServerData =
  | { ok: true; props: PlannerClientServerProps }
  | {
      ok: false;
      error: "profile" | "tier" | "trip_not_found";
      message: string;
    };

export type PlannerClientServerProps = {
  initialTrips: Awaited<ReturnType<typeof getUserTrips>>;
  parks: Awaited<ReturnType<typeof getAllParks>>;
  regions: Awaited<ReturnType<typeof getAllRegions>>;
  initialActiveTripId: string | null;
  userEmail: string;
  profileTier: UserTier;
  productTier: Tier;
  productPlanLabel: string;
  maxActiveTripCap: number | "unlimited";
  stripeCustomerId: string | null;
  achievementDefs: Awaited<ReturnType<typeof getAchievementDefinitions>>;
  aiGenerationCountsByTrip: Record<string, number>;
  siteUrl: string;
  initialTileScrubNotice: number | null;
  initialCustomTiles: Awaited<ReturnType<typeof getUserCustomTiles>>;
  customTileLimit: number;
  plannerTab: "planner" | "planning";
  initialPlanningSection: "todo" | "payments" | "budget" | null;
  initialTemperatureUnit: TemperatureUnit;
  emailMarketingOptOut: boolean;
  initialRidePrioritiesByTripId: Record<string, TripRidePriority[]>;
  /** Per-day ride counts without loading full `trip_ride_priorities` rows (overview). */
  ridePriorityCountByTripAndDay: Record<
    string,
    Record<string, { total: number; mustDo: number }>
  >;
  initialPaymentsByTripId: Record<string, TripPayment[]>;
  initialOpenSmartPlan: boolean;
  initialAutoGenerate: boolean;
  /** Park ids with at least one `attractions` row — client builds a Set once. */
  cataloguedParkIds: string[];
};

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

const getCachedUserTripsForPlanner = cache((userId: string) =>
  getUserTrips(userId),
);

function normalisePlannerTab(
  raw: string | undefined,
): "planner" | "planning" {
  if (raw === "planning") return "planning";
  if (raw === "budget" || raw === "payments" || raw === "checklist") {
    return "planning";
  }
  return "planner";
}

function initialPlanningSectionFromLegacyTab(
  raw: string | undefined,
): "todo" | "payments" | "budget" | null {
  if (raw === "checklist") return "todo";
  if (raw === "payments") return "payments";
  if (raw === "budget") return "budget";
  return null;
}

export async function loadPlannerClientServerData(input: {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string;
  siteUrl: string;
  searchParams: Record<string, string | string[] | undefined>;
  /** When set, this trip must appear in the user's trip list (otherwise invalid). */
  forcedTripId: string | null;
}): Promise<PlannerServerData> {
  const { supabase, userId, userEmail, siteUrl, searchParams: sp, forcedTripId } =
    input;

  const trips = await getCachedUserTripsForPlanner(userId);
  if (trips.length === 0) {
    type PlannerProfileRow = {
      tier: string;
      temperature_unit?: string | null;
      email_marketing_opt_out?: boolean | null;
      stripe_customer_id?: string | null;
    };
    const profileRead = await readProfileRow<PlannerProfileRow>(
      supabase,
      userId,
      "tier, temperature_unit, email_marketing_opt_out, stripe_customer_id",
    );
    if (!profileRead.ok) {
      return { ok: false, error: "profile", message: profileRead.message };
    }
    const pr = profileRead.data;
    const profileBundle: PlannerProfileBundle = {
      tier: tierFromProfileRow(pr),
      temperatureUnit: pr.temperature_unit === "f" ? "f" : "c",
      emailMarketingOptOut: pr.email_marketing_opt_out === true,
      stripeCustomerId: pr.stripe_customer_id?.trim() || null,
    };

    const [parks, regions, cataloguedParkIds, achievementDefs, customTiles, customTileLimit] =
      await Promise.all([
        getAllParks(),
        getAllRegions(),
        getCataloguedParkIds(),
        getAchievementDefinitions(),
        getUserCustomTiles(userId),
        getCustomTileLimit(userId),
      ]);

    let productTier: Tier = "free";
    let maxActiveTripCap: number | "unlimited" = 1;
    try {
      productTier = await getUserTier(userId);
      maxActiveTripCap = await maxActiveTripsForUser(userId);
    } catch (e) {
      if (isTierLoadFailure(e)) {
        return {
          ok: false,
          error: "tier",
          message: tierLoadFailureUserMessage(),
        };
      }
      throw e;
    }

    return {
      ok: true,
      props: {
        initialTrips: [],
        parks,
        regions,
        initialActiveTripId: null,
        userEmail,
        profileTier: profileBundle.tier,
        productTier,
        productPlanLabel: formatProductTierName(productTier),
        maxActiveTripCap,
        stripeCustomerId: profileBundle.stripeCustomerId,
        achievementDefs,
        aiGenerationCountsByTrip: {},
        siteUrl,
        initialTileScrubNotice: null,
        initialCustomTiles: customTiles,
        customTileLimit,
        plannerTab: "planner",
        initialPlanningSection: null,
        initialTemperatureUnit: profileBundle.temperatureUnit,
        emailMarketingOptOut: profileBundle.emailMarketingOptOut,
        initialRidePrioritiesByTripId: {},
        ridePriorityCountByTripAndDay: {},
        initialPaymentsByTripId: {},
        initialOpenSmartPlan: false,
        initialAutoGenerate: false,
        cataloguedParkIds,
      },
    };
  }

  if (forcedTripId && !trips.some((t) => t.id === forcedTripId)) {
    return {
      ok: false,
      error: "trip_not_found",
      message: "Trip not found.",
    };
  }

  const initialOpenSmartPlan = firstParam(sp.openSmartPlan) === "true";
  const initialAutoGenerate = firstParam(sp.autoGenerate) === "true";
  const tabParam = firstParam(sp.tab);
  const plannerTab = normalisePlannerTab(tabParam);
  const initialPlanningSection = initialPlanningSectionFromLegacyTab(tabParam);

  const tileScrubRaw = firstParam(sp.tile_scrubbed);
  const initialTileScrubNotice =
    tileScrubRaw !== undefined &&
    tileScrubRaw !== "" &&
    !Number.isNaN(Number(tileScrubRaw))
      ? Math.max(0, Math.floor(Number(tileScrubRaw)))
      : null;

  type PlannerProfileRow = {
    tier: string;
    temperature_unit?: string | null;
    email_marketing_opt_out?: boolean | null;
    stripe_customer_id?: string | null;
  };
  const profileRead = await readProfileRow<PlannerProfileRow>(
    supabase,
    userId,
    "tier, temperature_unit, email_marketing_opt_out, stripe_customer_id",
  );
  if (!profileRead.ok) {
    return { ok: false, error: "profile", message: profileRead.message };
  }
  const pr = profileRead.data;
  const profileBundle: PlannerProfileBundle = {
    tier: tierFromProfileRow(pr),
    temperatureUnit: pr.temperature_unit === "f" ? "f" : "c",
    emailMarketingOptOut: pr.email_marketing_opt_out === true,
    stripeCustomerId: pr.stripe_customer_id?.trim() || null,
  };

  const [
    parks,
    regions,
    activeTrip,
    achievementDefs,
    customTiles,
    customTileLimit,
    cataloguedParkIds,
  ] = await Promise.all([
    getAllParks(),
    getAllRegions(),
    getActiveTripForUser(userId),
    getAchievementDefinitions(),
    getUserCustomTiles(userId),
    getCustomTileLimit(userId),
    getCataloguedParkIds(),
  ]);

  const tripIds = trips.map((t) => t.id);
  const aiGenerationCountsByTrip =
    await getSuccessfulAiGenerationCountsForTrips(tripIds, userId);

  const ridePriorityCountByTripAndDay =
    await getRidePriorityCountsForTripIds(tripIds);

  const preferredActiveForRides =
    forcedTripId ?? activeTrip?.id ?? trips[0]?.id ?? null;

  const activeFull =
    preferredActiveForRides != null
      ? await getRidePrioritiesForTrip(preferredActiveForRides)
      : [];

  const initialRidePrioritiesByTripId: Record<string, TripRidePriority[]> =
    tripIds.reduce(
      (acc, id) => {
        acc[id] = id === preferredActiveForRides ? activeFull : [];
        return acc;
      },
      {} as Record<string, TripRidePriority[]>,
    );

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

  let productTier: Tier = "free";
  let maxActiveTripCap: number | "unlimited" = 1;
  try {
    productTier = await getUserTier(userId);
    maxActiveTripCap = await maxActiveTripsForUser(userId);
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        error: "tier",
        message: tierLoadFailureUserMessage(),
      };
    }
    throw e;
  }

  const preferredActive = preferredActiveForRides;

  return {
    ok: true,
    props: {
      initialTrips: trips,
      parks,
      regions,
      initialActiveTripId: preferredActive,
      userEmail,
      profileTier: profileBundle.tier,
      productTier,
      productPlanLabel: formatProductTierName(productTier),
      maxActiveTripCap,
      stripeCustomerId: profileBundle.stripeCustomerId,
      achievementDefs,
      aiGenerationCountsByTrip,
      siteUrl,
      initialTileScrubNotice,
      initialCustomTiles: customTiles,
      customTileLimit,
      plannerTab,
      initialPlanningSection,
      initialTemperatureUnit: profileBundle.temperatureUnit,
      emailMarketingOptOut: profileBundle.emailMarketingOptOut,
      initialRidePrioritiesByTripId,
      ridePriorityCountByTripAndDay,
      initialPaymentsByTripId,
      initialOpenSmartPlan,
      initialAutoGenerate,
      cataloguedParkIds,
    },
  };
}
