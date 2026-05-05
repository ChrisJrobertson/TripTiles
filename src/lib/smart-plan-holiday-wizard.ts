import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { eachDateKeyInRange } from "@/lib/date-helpers";
import type {
  Park,
  PlanningPace,
  PlanningTripType,
  Trip,
  TripIntelligenceMealPreference,
  TripPlanningPreferences,
  TripPlanningProfile,
  TripPlanningPartyType,
  TripRideTolerance,
  TripIntelligenceWalkingPreference,
  SmartPlanScopeChoice,
  SmartPlanHolidayStyle,
  SmartPlanWizardParty,
  SmartPlanPaceStyle,
  SmartPlanRestRhythm,
  DayPlanningPaidAccess,
} from "@/lib/types";

export type {
  SmartPlanScopeChoice,
  SmartPlanHolidayStyle,
  SmartPlanWizardParty,
  SmartPlanPaceStyle,
  SmartPlanRestRhythm,
} from "@/lib/types";

/** Ride comfort tier (wizard step 4). */
export type SmartPlanRideComfort =
  | "big_thrills"
  | "some_thrills"
  | "gentle"
  | "shows_lands_food"
  | "unknown";

export type SmartPlanAvoidanceKey =
  | "big_drops"
  | "spinning"
  | "water_rides"
  | "scary_rides"
  | "simulators"
  | "long_walking_days"
  | "early_starts"
  | "late_nights";

export type SmartPlanMealChoice =
  | "do_not_assume"
  | "quick_service"
  | "table_service"
  | "mixed"
  | "snacks"
  | "existing_only"
  | "unknown";

export type SmartParkPriorityToken =
  | "mk"
  | "ep"
  | "hs"
  | "ak"
  | "uf"
  | "ia"
  | "eu"
  | "water_parks"
  | "shopping_downtime";

export type HolidaySmartWizardState = {
  scope: SmartPlanScopeChoice | null;
  holidayStyle: SmartPlanHolidayStyle;
  wizardParty: SmartPlanWizardParty;
  paceStyle: SmartPlanPaceStyle;
  rideComfort: SmartPlanRideComfort;
  avoidances: SmartPlanAvoidanceKey[];
  mealChoice: SmartPlanMealChoice;
  paidAccessDefault: DayPlanningPaidAccess | null;
  restRhythm: SmartPlanRestRhythm;
  parkPriorities: SmartParkPriorityToken[];
  freeText: string;
};

export const holidayWizardDefaults = (): HolidaySmartWizardState => ({
  scope: null,
  holidayStyle: "balanced_family_holiday",
  wizardParty: "unknown",
  paceStyle: "balanced",
  rideComfort: "some_thrills",
  avoidances: [],
  mealChoice: "unknown",
  paidAccessDefault: "not_sure",
  restRhythm: "rest_every_3_to_4_days",
  parkPriorities: [],
  freeText: "",
});

const ORLANDO_PRIORITY_TO_PARK_IDS: Partial<Record<SmartParkPriorityToken, string>> = {
  mk: "mk",
  ep: "ep",
  hs: "hs",
  ak: "ak",
  uf: "usf",
  eu: "eu",
};

function inferPartyTypeFromTripDemographics(trip: Trip): TripPlanningPartyType {
  if (trip.adults <= 0 && trip.children <= 0) return "unknown";
  if (trip.adults === 1 && trip.children === 0) return "solo";
  if (trip.children > 0) return "family";
  return "couple";
}

function resolveWizardPartyType(params: {
  wizardParty: SmartPlanWizardParty;
  trip: Trip;
}): TripPlanningPartyType {
  if (params.wizardParty !== "unknown") {
    return mapWizardPartyToPartyType(params.wizardParty);
  }
  return inferPartyTypeFromTripDemographics(params.trip);
}

function mapWizardPartyToPartyType(w: SmartPlanWizardParty): TripPlanningPartyType {
  switch (w) {
    case "adults_only":
      return "couple";
    case "family_with_small_children":
    case "family_with_teens":
    case "accessibility_sensitive":
      return "family";
    case "mixed_family":
      return "multi_generational";
    default:
      return "unknown";
  }
}

function mapRideComfortToTolerance(r: SmartPlanRideComfort): TripRideTolerance {
  switch (r) {
    case "big_thrills":
      return "thrill_seeker";
    case "some_thrills":
      return "moderate_thrills";
    case "gentle":
      return "mostly_gentle";
    case "shows_lands_food":
      return "minimal_motion";
    default:
      return "unknown";
  }
}

function mealChoiceToTripIntelligence(m: SmartPlanMealChoice): TripIntelligenceMealPreference {
  switch (m) {
    case "do_not_assume":
      return "do_not_plan";
    case "quick_service":
      return "quick_service";
    case "table_service":
      return "table_service";
    case "mixed":
      return "mixed";
    case "snacks":
      return "snacks";
    case "existing_only":
      return "existing_only";
    default:
      return "unknown";
  }
}

function paceStyleToTripPacePreference(
  p: SmartPlanPaceStyle,
): TripPlanningProfile["pacePreference"] {
  switch (p) {
    case "relaxed":
      return "relaxed";
    case "balanced":
    case "half_day":
      return "balanced";
    case "packed":
      return "go_go_go";
    default:
      return "unknown";
  }
}

export function paceStyleToPlanningPace(style: SmartPlanPaceStyle): PlanningPace {
  switch (style) {
    case "relaxed":
      return "relaxed";
    case "packed":
      return "go_go_go";
    case "balanced":
    case "half_day":
      return "balanced";
    default:
      return "balanced";
  }
}

function walkingFromAvoidances(
  keys: SmartPlanAvoidanceKey[],
): TripIntelligenceWalkingPreference {
  if (keys.includes("long_walking_days")) return "prefer_less_walking";
  return "balanced";
}

function holidayStyleToTripType(style: SmartPlanHolidayStyle): PlanningTripType | undefined {
  switch (style) {
    case "first_time_theme_park_trip":
      return "first_timer";
    case "special_occasion":
      return "milestone";
    default:
      return undefined;
  }
}

function derivePrioritiesFromWizard(
  holidayStyle: SmartPlanHolidayStyle,
): string[] {
  switch (holidayStyle) {
    case "food_shows_and_atmosphere":
      return ["shows", "fine_dining", "characters"];
    case "big_rides_and_headlines":
      return ["thrill rides", "headliners", "efficiency"];
    case "balanced_family_holiday":
      return ["family favourites", "pace", "rest days"];
    case "first_time_theme_park_trip":
      return ["iconic classics", "pace", "not overwhelming"];
    case "relaxed_with_some_parks":
      return ["relaxed pacing", "pools / downtime"];
    default:
      return ["balanced pacing"];
  }
}

/**
 * Resolved canonical park IDs for this trip from wizard tokens (Florida defaults where known).
 */
export function resolveParkPriorityIds(
  priorities: SmartParkPriorityToken[],
  tripParks: Park[],
): string[] {
  const idSet = new Set(tripParks.map((p) => p.id));
  const out: string[] = [];
  for (const t of priorities) {
    const mapped = ORLANDO_PRIORITY_TO_PARK_IDS[t];
    if (mapped && idSet.has(mapped)) {
      out.push(mapped);
      continue;
    }
    const labelMatch = tripParks.find((p) =>
      priorityTokenMatchesPark(t, p),
    );
    if (labelMatch) out.push(labelMatch.id);
  }
  return [...new Set(out)];
}

function priorityTokenMatchesPark(
  token: SmartParkPriorityToken,
  park: Park,
): boolean {
  const name = park.name.toLowerCase();
  switch (token) {
    case "water_parks":
      return (
        /\b(typhoon|blizzard|volcano|water\s*park|aquatica)\b/i.test(name) ||
        park.park_group === "seaworld"
      );
    case "shopping_downtime":
      return /\b(disney\s*springs|city\s*walk|shopping)\b/i.test(name);
    case "eu":
      return /\bepic\b/i.test(name);
    default:
      return false;
  }
}

/**
 * Trip Intelligence profile persisted from the holiday Smart Plan wizard (with optional tokens for non-park picks).
 */
export function buildTripPlanningProfileFromHolidayWizard(params: {
  wizard: HolidaySmartWizardState;
  tripParks: Park[];
  trip: Trip;
}): TripPlanningProfile {
  const { wizard, tripParks, trip } = params;
  const nowIso = new Date().toISOString();
  const parkIds = resolveParkPriorityIds(wizard.parkPriorities, tripParks);
  return {
    partyType: resolveWizardPartyType({
      wizardParty: wizard.wizardParty,
      trip,
    }),
    rideTolerance: mapRideComfortToTolerance(wizard.rideComfort),
    avoidances: [...wizard.avoidances],
    walkingPreference: walkingFromAvoidances(wizard.avoidances),
    pacePreference: paceStyleToTripPacePreference(wizard.paceStyle),
    mealPreference: mealChoiceToTripIntelligence(wizard.mealChoice),
    queuePreference:
      wizard.avoidances.includes("scary_rides") ||
      wizard.avoidances.includes("big_drops")
        ? "avoid_long_queues"
        : "balanced",
    learnedSignals: [
      ...(wizard.scope ? [`smart_plan_scope:${wizard.scope}`] : []),
      ...(wizard.holidayStyle !== "unknown"
        ? [`holiday_style:${wizard.holidayStyle}`]
        : []),
      ...(wizard.restRhythm !== "no_preference"
        ? [`rest_rhythm:${wizard.restRhythm}`]
        : []),
      ...(wizard.paceStyle !== "unknown" ? [`pace_style:${wizard.paceStyle}`] : []),
    ],
    updatedAt: nowIso,
    holidayStyle: wizard.holidayStyle,
    wizardParty: wizard.wizardParty,
    restRhythm: wizard.restRhythm,
    defaultPaidQueueAccess: wizard.paidAccessDefault ?? "not_sure",
    paceStyle: wizard.paceStyle,
    parkPriorityParkIds: parkIds,
    experiencePriorityTokens: [...wizard.parkPriorities],
  };
}

/** Synced `planning_preferences` row for Smart Plan + prompt context. */
export function mapWizardToPlanningPreferences(params: {
  trip: Trip;
  wizard: HolidaySmartWizardState;
  tripParks: Park[];
}): TripPlanningPreferences {
  const { trip, wizard, tripParks } = params;
  const paid = wizard.paidAccessDefault ?? "not_sure";
  const skipLineHints = paid === "yes";
  const mustDo = resolveParkPriorityIds(wizard.parkPriorities, tripParks);
  const base = trip.planning_preferences;
  const tripTypeGuess = holidayStyleToTripType(wizard.holidayStyle);
  const additional =
    wizard.freeText.trim() ||
    (base?.additionalNotes?.trim() ? base.additionalNotes : null);
  const next: TripPlanningPreferences = {
    pace: paceStyleToPlanningPace(wizard.paceStyle),
    mustDoParks: mustDo,
    priorities: derivePrioritiesFromWizard(wizard.holidayStyle),
    additionalNotes: additional,
    adults: trip.adults,
    children: trip.children,
    childAges: trip.child_ages ?? [],
    includeDisneySkipTips: skipLineHints,
    includeUniversalSkipTips: skipLineHints,
    tripType: tripTypeGuess ?? base?.tripType,
    disneyLightningLane:
      paid === "yes"
        ? {
            multiPassStatus: "all_park_days",
            singlePassWillingToPay: "yes",
            memoryMaker: base?.disneyLightningLane?.memoryMaker ?? "not_sure",
          }
        : paid === "no"
          ? {
              multiPassStatus: "none",
              singlePassWillingToPay: "no",
              memoryMaker: base?.disneyLightningLane?.memoryMaker ?? "not_sure",
            }
          : {
              multiPassStatus: "not_sure",
              singlePassWillingToPay: "not_sure",
              memoryMaker: base?.disneyLightningLane?.memoryMaker ?? "not_sure",
            },
    universalExpress:
      paid === "yes"
        ? {
            status: "paid",
            singleRiderOk: base?.universalExpress?.singleRiderOk ?? "sometimes",
          }
        : paid === "no"
          ? { status: "no", singleRiderOk: "no" }
          : {
              status: "not_sure",
              singleRiderOk: base?.universalExpress?.singleRiderOk ?? "sometimes",
            },
  };
  return next;
}

/** Extra structured instructions appended to Smart Plan AI context. */
export function buildHolidayWizardSupplementPrompt(
  wizard: HolidaySmartWizardState,
): string {
  const scopeSuffix =
    wizard.scope === "fill_empty_days_only"
      ? " Only fill empty calendar slots; preserve every slot the guest already set."
      : wizard.scope === "suggest_changes_first"
        ? " Prefer suggestions and gentle improvements; do not replace existing user tiles unless a slot is empty."
        : wizard.scope === "plan_this_day_only"
          ? " Apply to the focused day only; do not reshape other days."
          : wizard.scope === "improve_whole_trip"
            ? " Guest requested a whole-trip refresh where the model outputs replacements — still no ride-by-ride sequencing here."
            : "";
  const scopeLine = wizard.scope
    ? `SMART PLAN SCOPE CHOICE (honour strictly): ${wizard.scope.replace(/_/g, " ")}.${scopeSuffix} `
    : "";
  const paidLabel = wizard.paidAccessDefault ?? "not_sure";
  let paidSentence = "";
  if (paidLabel === "yes") {
    paidSentence =
      "Guest confirmed paid skip-line products may be referenced where relevant.";
  } else if (paidLabel === "no") {
    paidSentence =
      "Guest chose NO paid queue reliance — standby-first wording only.";
  } else {
    paidSentence =
      'Guest chose not sure / decide later for paid queues — standby assumptions; mention paid queues only as optional future decisions, never as booked products.';
  }
  const ry = wizard.restRhythm.replace(/_/g, " ");
  const half =
    wizard.paceStyle === "half_day"
      ? "Prefer half-day style park rhythm where possible."
      : "";
  return [
    `${scopeLine}Holiday style (trip personality): ${wizard.holidayStyle.replace(/_/g, " ")}.`,
    `Travel group: ${wizard.wizardParty.replace(/_/g, " ")}; ride comfort goal: ${wizard.rideComfort.replace(/_/g, " ")}.`,
    `Pace rhythm: ${wizard.paceStyle.replace(/_/g, " ")}. ${half}`,
    `Meal posture: ${wizard.mealChoice.replace(/_/g, " ")}.`,
    `${paidSentence}`,
    `Balance / rest inclination: ${ry}.`,
    wizard.avoidances.length
      ? `Avoidances to respect in shaping days: ${wizard.avoidances.join(", ").replace(/_/g, " ")}.`
      : "",
    "Do not invent detailed ride-by-ride sequences — day structure only; AI Day Strategy handles sequencing later.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type HolidaySmartPreview = {
  totalTripNights: number;
  calendarDays: number;
  daysWithFilledSlots: number;
  fullyEmptyDays: number;
};

export function computeHolidayAssignmentsPreview(trip: Trip): HolidaySmartPreview {
  const keys = eachDateKeyInRange(trip.start_date, trip.end_date);
  let daysWithFilled = 0;
  let fullyEmpty = 0;
  for (const d of keys) {
    const a = trip.assignments[d];
    const hasSlot = Boolean(
      a &&
      (getParkIdFromSlotValue(a.am) ||
        getParkIdFromSlotValue(a.pm) ||
        getParkIdFromSlotValue(a.lunch) ||
        getParkIdFromSlotValue(a.dinner)),
    );
    if (hasSlot) daysWithFilled += 1;
    else fullyEmpty += 1;
  }
  return {
    totalTripNights: Math.max(0, keys.length - 1),
    calendarDays: keys.length,
    daysWithFilledSlots: daysWithFilled,
    fullyEmptyDays: fullyEmpty,
  };
}

export function smartPlanOverwriteFromScope(scope: SmartPlanScopeChoice): boolean {
  return scope === "improve_whole_trip";
}

