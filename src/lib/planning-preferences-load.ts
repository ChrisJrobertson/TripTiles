import type {
  PlanningPace,
  PlanningPreferencesIssue,
  TripPlanningPreferences,
} from "@/lib/types";

export const PLANNING_PACES = ["relaxed", "balanced", "intense", "go_go_go"] as const;

const PACE_LABEL: Record<PlanningPace, string> = {
  relaxed: "Relaxed",
  balanced: "Balanced",
  intense: "Intense",
  go_go_go: "Full-on",
};

export function isPlanningPace(value: unknown): value is PlanningPace {
  return (
    typeof value === "string" &&
    (PLANNING_PACES as readonly string[]).includes(value)
  );
}

export function planningPaceLabel(pace: PlanningPace): string {
  return PACE_LABEL[pace];
}

export type PlanningPreferencesLoad = {
  preferences: TripPlanningPreferences | null;
  /** Set when a pace string is stored outside the supported set. */
  issue: PlanningPreferencesIssue | null;
};

/**
 * Hydrates saved planning preferences.
 * An unsupported pace is returned as an issue and is not rewritten to another pace.
 */
export function loadPlanningPreferences(raw: unknown): PlanningPreferencesLoad {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { preferences: null, issue: null };
  }
  const o = raw as Record<string, unknown>;
  const fields = parsePlanningPreferenceFields(o);
  if (isPlanningPace(o.pace)) {
    return { preferences: { pace: o.pace, ...fields }, issue: null };
  }
  if (typeof o.pace === "string" && o.pace.trim()) {
    return {
      preferences: null,
      issue: { unsupportedPace: o.pace.trim(), fields },
    };
  }
  return { preferences: null, issue: null };
}

function parsePlanningPreferenceFields(
  o: Record<string, unknown>,
): Omit<TripPlanningPreferences, "pace"> {
  const mustRaw = o.mustDoParks;
  const mustDoParks = Array.isArray(mustRaw)
    ? mustRaw.filter((x): x is string => typeof x === "string")
    : [];
  const priRaw = o.priorities;
  const priorities = Array.isArray(priRaw)
    ? priRaw.filter((x): x is string => typeof x === "string")
    : [];
  const additionalNotes =
    o.additionalNotes === null
      ? null
      : typeof o.additionalNotes === "string"
        ? o.additionalNotes
        : null;
  const adultsRaw = Number(o.adults);
  const childrenRaw = Number(o.children);
  const agesRaw = o.childAges;
  const childAges = Array.isArray(agesRaw)
    ? agesRaw
        .map((n) => Number(n))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 17)
    : [];
  const adults =
    Number.isFinite(adultsRaw) && adultsRaw >= 1 && adultsRaw <= 10
      ? Math.floor(adultsRaw)
      : 2;
  const children =
    Number.isFinite(childrenRaw) && childrenRaw >= 0 && childrenRaw <= 10
      ? Math.floor(childrenRaw)
      : 0;
  const includeDisneySkipTips =
    typeof o.includeDisneySkipTips === "boolean"
      ? o.includeDisneySkipTips
      : undefined;
  const includeUniversalSkipTips =
    typeof o.includeUniversalSkipTips === "boolean"
      ? o.includeUniversalSkipTips
      : undefined;

  const mobilityVals = [
    "none",
    "stroller",
    "wheelchair",
    "prefer_shorter_walks",
  ] as const;
  const mobility = mobilityVals.includes(o.mobility as (typeof mobilityVals)[number])
    ? (o.mobility as TripPlanningPreferences["mobility"])
    : undefined;

  const tripTypeVals = [
    "first_timer",
    "repeat_visitor",
    "milestone",
    "honeymoon",
    "multi_generational",
    "unsure",
  ] as const;
  const tripType = tripTypeVals.includes(o.tripType as (typeof tripTypeVals)[number])
    ? (o.tripType as TripPlanningPreferences["tripType"])
    : undefined;

  const expVals = [
    "character_meals",
    "fireworks",
    "parades",
    "dessert_party",
    "rope_drop",
    "evening_extra",
  ] as const;
  const mustDoExperiencesRaw = o.mustDoExperiences;
  const mustDoExperiences = Array.isArray(mustDoExperiencesRaw)
    ? mustDoExperiencesRaw.filter((x): x is (typeof expVals)[number] =>
        expVals.includes(x as (typeof expVals)[number]),
      )
    : undefined;

  const childHeightsRaw = o.childHeights;
  const childHeights = Array.isArray(childHeightsRaw)
    ? childHeightsRaw
        .map((row) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) return null;
          const r2 = row as Record<string, unknown>;
          const ageOrIndex = Number(r2.ageOrIndex);
          const heightCm = Number(r2.heightCm);
          if (Number.isNaN(ageOrIndex) || Number.isNaN(heightCm)) return null;
          return { ageOrIndex, heightCm };
        })
        .filter((x): x is { ageOrIndex: number; heightCm: number } => x != null)
    : undefined;

  const dlp = o.disneyLightningLane;
  let disneyLightningLane: TripPlanningPreferences["disneyLightningLane"];
  if (dlp && typeof dlp === "object" && !Array.isArray(dlp)) {
    const d = dlp as Record<string, unknown>;
    const multiPassStatus =
      d.multiPassStatus === "all_park_days" ||
      d.multiPassStatus === "some_park_days" ||
      d.multiPassStatus === "none" ||
      d.multiPassStatus === "not_sure"
        ? d.multiPassStatus
        : "not_sure";
    const singlePassWillingToPay =
      d.singlePassWillingToPay === "yes" ||
      d.singlePassWillingToPay === "no" ||
      d.singlePassWillingToPay === "not_sure"
        ? d.singlePassWillingToPay
        : "not_sure";
    const memoryMaker =
      d.memoryMaker === "yes" ||
      d.memoryMaker === "no" ||
      d.memoryMaker === "not_sure"
        ? d.memoryMaker
        : "not_sure";
    disneyLightningLane = {
      multiPassStatus,
      singlePassWillingToPay,
      memoryMaker,
    };
  }

  const uxp = o.universalExpress;
  let universalExpress: TripPlanningPreferences["universalExpress"];
  if (uxp && typeof uxp === "object" && !Array.isArray(uxp)) {
    const u = uxp as Record<string, unknown>;
    const status =
      u.status === "included_with_hotel" ||
      u.status === "paid" ||
      u.status === "no" ||
      u.status === "not_sure"
        ? u.status
        : "not_sure";
    const singleRiderOk =
      u.singleRiderOk === "yes" ||
      u.singleRiderOk === "no" ||
      u.singleRiderOk === "sometimes"
        ? u.singleRiderOk
        : "sometimes";
    universalExpress = { status, singleRiderOk };
  }

  const parkHoppingVals = ["yes", "no", "undecided"] as const;
  const parkHopping = parkHoppingVals.includes(
    o.parkHopping as (typeof parkHoppingVals)[number],
  )
    ? (o.parkHopping as TripPlanningPreferences["parkHopping"])
    : undefined;

  const efpd = Number(o.expectedFullParkDays);
  const expectedFullParkDays =
    Number.isFinite(efpd) && efpd >= 1 && efpd <= 366 ? Math.floor(efpd) : undefined;

  const bufferRestAtTripStart =
    typeof o.bufferRestAtTripStart === "boolean"
      ? o.bufferRestAtTripStart
      : undefined;
  const bufferRestAtTripEnd =
    typeof o.bufferRestAtTripEnd === "boolean" ? o.bufferRestAtTripEnd : undefined;

  return {
    mustDoParks,
    priorities: priorities.slice(0, 12),
    additionalNotes,
    adults,
    children,
    childAges,
    ...(includeDisneySkipTips !== undefined ? { includeDisneySkipTips } : {}),
    ...(includeUniversalSkipTips !== undefined ? { includeUniversalSkipTips } : {}),
    ...(mobility ? { mobility } : {}),
    ...(tripType ? { tripType } : {}),
    ...(mustDoExperiences && mustDoExperiences.length > 0
      ? { mustDoExperiences }
      : {}),
    ...(childHeights && childHeights.length > 0 ? { childHeights } : {}),
    ...(disneyLightningLane ? { disneyLightningLane } : {}),
    ...(universalExpress ? { universalExpress } : {}),
    ...(parkHopping ? { parkHopping } : {}),
    ...(expectedFullParkDays != null ? { expectedFullParkDays } : {}),
    ...(bufferRestAtTripStart !== undefined ? { bufferRestAtTripStart } : {}),
    ...(bufferRestAtTripEnd !== undefined ? { bufferRestAtTripEnd } : {}),
  };
}
