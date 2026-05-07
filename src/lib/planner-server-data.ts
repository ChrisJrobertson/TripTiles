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

/**
 * Option X (planner decomposition): assignments and preferences live on each `Trip`
 * row from {@link loadPlannerTripRowsCached}. Splitting those fields into separate DB
 * calls would duplicate reads with no UX benefit; callers slice in-memory as needed.
 */
export const loadPlannerTripRowsCached = cache((userId: string) =>
  getUserTrips(userId),
);

const loadPlannerCatalogGlobalsCached = cache(async () =>
  Promise.all([
    getAllParks(),
    getAllRegions(),
    getCataloguedParkIds(),
    getAchievementDefinitions(),
  ]),
);

/** User-scoped planner rows (tiles + tier cap inputs), without active-trip pointer fetch. */
const loadPlannerCustomDataCached = cache(async (userId: string) =>
  Promise.all([getUserCustomTiles(userId), getCustomTileLimit(userId)]),
);

const loadPlannerActiveTripPointerCached = cache((userId: string) =>
  getActiveTripForUser(userId),
);

/** Stable dedupe key for trip-id-derived loads within one request (sorted ids). */
function sortedTripIdsKey(tripIds: string[]): string {
  return [...tripIds].slice().sort().join("\n");
}

const loadPlannerAiGenerationCountsCached = cache(
  async (tripIdsKey: string, userId: string) => {
    const tripIds =
      tripIdsKey.length === 0 ? [] : tripIdsKey.split("\n").filter(Boolean);
    return getSuccessfulAiGenerationCountsForTrips(tripIds, userId);
  },
);

const loadPlannerRidePriorityCountsCached = cache((tripIdsKey: string) => {
  const tripIds =
    tripIdsKey.length === 0 ? [] : tripIdsKey.split("\n").filter(Boolean);
  return getRidePriorityCountsForTripIds(tripIds);
});

const loadPlannerRidePrioritiesFullCached = cache((preferredTripId: string) =>
  getRidePrioritiesForTrip(preferredTripId),
);

const loadPlannerPaymentsFlatCached = cache((tripIdsKey: string) => {
  const tripIds =
    tripIdsKey.length === 0 ? [] : tripIdsKey.split("\n").filter(Boolean);
  return getPaymentsForTripIds(tripIds);
});

const loadPlannerProductTierCapsCached = cache(async (userId: string) => {
  const productTier = await getUserTier(userId);
  const maxActiveTripCap = await maxActiveTripsForUser(userId);
  return { productTier, maxActiveTripCap };
});

async function resolvePlannerTierCapsSafe(
  userId: string,
): Promise<{ ok: true; productTier: Tier; maxActiveTripCap: number | "unlimited" } | { ok: false; message: string }> {
  try {
    const { productTier, maxActiveTripCap } =
      await loadPlannerProductTierCapsCached(userId);
    return { ok: true, productTier, maxActiveTripCap };
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        message: tierLoadFailureUserMessage(),
      };
    }
    throw e;
  }
}

type PlannerProfileReadRow = {
  tier: string;
  temperature_unit?: string | null;
  email_marketing_opt_out?: boolean | null;
  stripe_customer_id?: string | null;
};

async function loadPlannerProfileReadUncached(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; data: PlannerProfileReadRow } | { ok: false; message: string }> {
  const profileRead = await readProfileRow<PlannerProfileReadRow>(
    supabase,
    userId,
    "tier, temperature_unit, email_marketing_opt_out, stripe_customer_id",
  );
  if (!profileRead.ok) {
    return { ok: false, message: profileRead.message };
  }
  return { ok: true, data: profileRead.data };
}

function mapProfileRowToPlannerBundle(pr: PlannerProfileReadRow): PlannerProfileBundle {
  return {
    tier: tierFromProfileRow(pr),
    temperatureUnit: pr.temperature_unit === "f" ? "f" : "c",
    emailMarketingOptOut: pr.email_marketing_opt_out === true,
    stripeCustomerId: pr.stripe_customer_id?.trim() || null,
  };
}

/** @internal Exported for HYBRID RSC wrappers that share the planner trip read. */
export function partitionPlannerRidePriorities(
  tripIds: string[],
  preferredActiveForRides: string | null,
  activeFull: TripRidePriority[],
): Record<string, TripRidePriority[]> {
  return tripIds.reduce(
    (acc, id) => {
      acc[id] = id === preferredActiveForRides ? activeFull : [];
      return acc;
    },
    {} as Record<string, TripRidePriority[]>,
  );
}

export function foldPlannerPaymentsSorted(
  paymentsFlat: TripPayment[],
  tripIds: string[],
): Record<string, TripPayment[]> {
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
  return initialPaymentsByTripId;
}

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

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

export async function loadPlannerClientServerFromTrips(input: {
  supabase: SupabaseClient;
  userId: string;
  siteUrl: string;
  searchParams: Record<string, string | string[] | undefined>;
  forcedTripId: string | null;
  trips: Awaited<ReturnType<typeof getUserTrips>>;
}): Promise<PlannerServerData> {
  const { supabase, userId, siteUrl, searchParams: sp, forcedTripId, trips } =
    input;

  if (trips.length === 0) {
    const profileRead = await loadPlannerProfileReadUncached(supabase, userId);
    if (!profileRead.ok) {
      return { ok: false, error: "profile", message: profileRead.message };
    }
    const pr = profileRead.data;
    const profileBundle = mapProfileRowToPlannerBundle(pr);

    const [catalogBundle, customPair] = await Promise.all([
      loadPlannerCatalogGlobalsCached(),
      loadPlannerCustomDataCached(userId),
    ]);
    const [parks, regions, cataloguedParkIds, achievementDefs] = catalogBundle;
    const [customTiles, customTileLimit] = customPair;

    const tierOut = await resolvePlannerTierCapsSafe(userId);
    if (!tierOut.ok) {
      return {
        ok: false,
        error: "tier",
        message: tierOut.message,
      };
    }
    const { productTier, maxActiveTripCap } = tierOut;

    return {
      ok: true,
      props: {
        initialTrips: [],
        parks,
        regions,
        initialActiveTripId: null,
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

  const profileRead = await loadPlannerProfileReadUncached(supabase, userId);
  if (!profileRead.ok) {
    return { ok: false, error: "profile", message: profileRead.message };
  }
  const pr = profileRead.data;
  const profileBundle = mapProfileRowToPlannerBundle(pr);

  const tripIds = trips.map((t) => t.id);
  const tripIdsKey = sortedTripIdsKey(tripIds);

  const [catalogBundle, customPair, activeTrip] = await Promise.all([
    loadPlannerCatalogGlobalsCached(),
    loadPlannerCustomDataCached(userId),
    loadPlannerActiveTripPointerCached(userId),
  ]);
  const [parks, regions, cataloguedParkIds, achievementDefs] = catalogBundle;
  const [customTiles, customTileLimit] = customPair;

  const [aiGenerationCountsByTrip, ridePriorityCountByTripAndDay] =
    await Promise.all([
      loadPlannerAiGenerationCountsCached(tripIdsKey, userId),
      loadPlannerRidePriorityCountsCached(tripIdsKey),
    ]);

  const preferredActiveForRides =
    forcedTripId ?? activeTrip?.id ?? trips[0]?.id ?? null;

  const activeFull =
    preferredActiveForRides != null
      ? await loadPlannerRidePrioritiesFullCached(preferredActiveForRides)
      : [];

  const initialRidePrioritiesByTripId = partitionPlannerRidePriorities(
    tripIds,
    preferredActiveForRides,
    activeFull,
  );

  const paymentsFlat =
    tripIds.length === 0
      ? []
      : await loadPlannerPaymentsFlatCached(tripIdsKey);
  const initialPaymentsByTripId = foldPlannerPaymentsSorted(
    paymentsFlat,
    tripIds,
  );

  const tierOut = await resolvePlannerTierCapsSafe(userId);
  if (!tierOut.ok) {
    return {
      ok: false,
      error: "tier",
      message: tierOut.message,
    };
  }
  const { productTier, maxActiveTripCap } = tierOut;

  const preferredActive = preferredActiveForRides;

  return {
    ok: true,
    props: {
      initialTrips: trips,
      parks,
      regions,
      initialActiveTripId: preferredActive,
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

export async function loadPlannerClientServerData(input: {
  supabase: SupabaseClient;
  userId: string;
  siteUrl: string;
  searchParams: Record<string, string | string[] | undefined>;
  /** When set, this trip must appear in the user's trip list (otherwise invalid). */
  forcedTripId: string | null;
}): Promise<PlannerServerData> {
  const trips = await loadPlannerTripRowsCached(input.userId);
  return loadPlannerClientServerFromTrips({ ...input, trips });
}

