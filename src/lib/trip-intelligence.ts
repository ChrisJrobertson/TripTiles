import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { eachDateKeyInRange } from "@/lib/date-helpers";
import { isDayPlanningIntent, isValidDateYmd } from "@/lib/day-planning-intent";
import { isThemePark } from "@/lib/park-categories";
import {
  regionHasDisneyQueueParks,
  regionHasUniversalQueueParks,
} from "@/lib/wizard-queue-step-region";
import type {
  Assignment,
  BehaviourSignal,
  BehaviourSignalSource,
  BehaviourSignalType,
  DayPlanFeedback,
  DayPlanFeedbackReason,
  DayPlanningChangePermission,
  DayPlanningDayType,
  DayPlanningIntent,
  DayPlanningMealPreference,
  DayPlanningPaidAccess,
  DayPlanningPace,
  DayPlanningRideLevel,
  DayPlanningStartPreference,
  DayPlanningFinishPreference,
  Park,
  Trip,
  TripIntelligenceMealPreference,
  TripIntelligencePacePreference,
  TripIntelligenceQueuePreference,
  TripIntelligenceWalkingPreference,
  TripPlanningPartyType,
  TripPlanningPreferences,
  TripPlanningProfile,
  TripRideTolerance,
} from "@/lib/types";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const PARTY_TYPES: TripPlanningPartyType[] = [
  "solo",
  "couple",
  "family",
  "friends",
  "multi_generational",
  "unknown",
];

const RIDE_TOLERANCE: TripRideTolerance[] = [
  "thrill_seeker",
  "moderate_thrills",
  "mostly_gentle",
  "minimal_motion",
  "unknown",
];

const WALKING: TripIntelligenceWalkingPreference[] = [
  "prefer_less_walking",
  "balanced",
  "happy_to_walk",
  "unknown",
];

const PACE: TripIntelligencePacePreference[] = [
  "relaxed",
  "balanced",
  "intense",
  "go_go_go",
  "unknown",
];

const MEAL: TripIntelligenceMealPreference[] = [
  "do_not_plan",
  "quick_service",
  "table_service",
  "mixed",
  "snacks",
  "existing_only",
  "unknown",
];

const QUEUE: TripIntelligenceQueuePreference[] = [
  "avoid_long_queues",
  "balanced",
  "willing_to_wait",
  "unknown",
];

const FEEDBACK_REASONS: DayPlanFeedbackReason[] = [
  "too_packed",
  "too_relaxed",
  "wrong_park_mix",
  "missed_priorities",
  "not_accurate",
  "other",
  "unspecified",
];

const SIGNAL_TYPES: BehaviourSignalType[] = [
  "planner_opened",
  "planner_submitted",
  "day_plan_viewed",
  "day_plan_regenerated",
  "day_plan_exported",
  "feedback_submitted",
  "attraction_excluded",
  "attraction_priority_set",
  "other",
];

const SIGNAL_SOURCES: BehaviourSignalSource[] = ["ui", "server", "ai", "system"];

function isTripPlanningPartyType(v: unknown): v is TripPlanningPartyType {
  return typeof v === "string" && (PARTY_TYPES as string[]).includes(v);
}

function isTripRideTolerance(v: unknown): v is TripRideTolerance {
  return typeof v === "string" && (RIDE_TOLERANCE as string[]).includes(v);
}

function isWalkingPref(v: unknown): v is TripIntelligenceWalkingPreference {
  return typeof v === "string" && (WALKING as string[]).includes(v);
}

function isPacePref(v: unknown): v is TripIntelligencePacePreference {
  return typeof v === "string" && (PACE as string[]).includes(v);
}

function isMealPref(v: unknown): v is TripIntelligenceMealPreference {
  return typeof v === "string" && (MEAL as string[]).includes(v);
}

function isQueuePref(v: unknown): v is TripIntelligenceQueuePreference {
  return typeof v === "string" && (QUEUE as string[]).includes(v);
}

function isRating(v: unknown): v is DayPlanFeedback["rating"] {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

function isFeedbackReason(v: unknown): v is DayPlanFeedbackReason {
  return typeof v === "string" && (FEEDBACK_REASONS as string[]).includes(v);
}

function isBehaviourSignalType(v: unknown): v is BehaviourSignalType {
  return typeof v === "string" && (SIGNAL_TYPES as string[]).includes(v);
}

function isBehaviourSignalSource(v: unknown): v is BehaviourSignalSource {
  return typeof v === "string" && (SIGNAL_SOURCES as string[]).includes(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isMetadataObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function isTripPlanningProfile(v: unknown): v is TripPlanningProfile {
  if (!isMetadataObject(v)) return false;
  const o = v;
  return (
    isTripPlanningPartyType(o.partyType) &&
    isTripRideTolerance(o.rideTolerance) &&
    isStringArray(o.avoidances) &&
    isWalkingPref(o.walkingPreference) &&
    isPacePref(o.pacePreference) &&
    isMealPref(o.mealPreference) &&
    isQueuePref(o.queuePreference) &&
    isStringArray(o.learnedSignals) &&
    typeof o.updatedAt === "string" &&
    Boolean(Date.parse(o.updatedAt))
  );
}

export function isDayPlanFeedback(v: unknown): v is DayPlanFeedback {
  if (!isMetadataObject(v)) return false;
  const o = v;
  if (!isRating(o.rating)) return false;
  if (!isFeedbackReason(o.feedbackReason)) return false;
  if (typeof o.freeText !== "string") return false;
  if (!isNonEmptyString(o.tripId)) return false;
  if (typeof o.date !== "string" || !isValidDateYmd(o.date)) return false;
  if (
    typeof o.generatedAt !== "string" ||
    !isNonEmptyString(o.generatedAt) ||
    Number.isNaN(Date.parse(o.generatedAt))
  ) {
    return false;
  }
  if (
    typeof o.createdAt !== "string" ||
    !isNonEmptyString(o.createdAt) ||
    Number.isNaN(Date.parse(o.createdAt))
  ) {
    return false;
  }
  return true;
}

export function isBehaviourSignal(v: unknown): v is BehaviourSignal {
  if (!isMetadataObject(v)) return false;
  const o = v;
  if (!isNonEmptyString(o.tripId)) return false;
  if (o.date != null && typeof o.date !== "string") return false;
  if (!isBehaviourSignalType(o.signalType)) return false;
  if (!isBehaviourSignalSource(o.source)) return false;
  if (!isMetadataObject(o.metadata)) return false;
  if (
    typeof o.createdAt !== "string" ||
    !isNonEmptyString(o.createdAt) ||
    Number.isNaN(Date.parse(o.createdAt))
  ) {
    return false;
  }
  return true;
}

export function readTripPlanningProfile(
  preferences: unknown,
): TripPlanningProfile | null {
  if (!isMetadataObject(preferences)) return null;
  const raw = preferences.trip_planning_profile;
  return isTripPlanningProfile(raw) ? raw : null;
}

export function writeTripPlanningProfile(
  preferences: Record<string, unknown>,
  profile: TripPlanningProfile,
): void {
  preferences.trip_planning_profile = profile;
}

export type DefaultTripPlanningProfileArgs = {
  partyType?: TripPlanningPartyType;
  rideTolerance?: TripRideTolerance;
};

export function getDefaultTripPlanningProfile(
  args: DefaultTripPlanningProfileArgs = {},
): TripPlanningProfile {
  const now = new Date().toISOString();
  return {
    partyType: args.partyType ?? "unknown",
    rideTolerance: args.rideTolerance ?? "unknown",
    avoidances: [],
    walkingPreference: "unknown",
    pacePreference: "unknown",
    mealPreference: "unknown",
    queuePreference: "unknown",
    learnedSignals: [],
    updatedAt: now,
  };
}

export function readDayPlanFeedback(
  preferences: unknown,
  date: string,
): DayPlanFeedback | null {
  if (!isMetadataObject(preferences)) return null;
  const map = preferences.day_plan_feedback;
  if (!isMetadataObject(map)) return null;
  const raw = map[date];
  return isDayPlanFeedback(raw) ? raw : null;
}

export function writeDayPlanFeedback(
  preferences: Record<string, unknown>,
  date: string,
  feedback: DayPlanFeedback,
): void {
  const existing = isMetadataObject(preferences.day_plan_feedback)
    ? { ...preferences.day_plan_feedback }
    : {};
  existing[date] = feedback;
  preferences.day_plan_feedback = existing;
}

export function appendBehaviourSignal(
  preferences: Record<string, unknown>,
  signal: BehaviourSignal,
): void {
  const raw = preferences.behaviour_signals;
  const list: BehaviourSignal[] = Array.isArray(raw)
    ? raw.filter((x): x is BehaviourSignal => isBehaviourSignal(x))
    : [];
  preferences.behaviour_signals = [...list, signal];
}

export function summariseTripIntelligenceForPrompt(preferences: unknown): string {
  const profile = readTripPlanningProfile(preferences);
  let feedbackDates = 0;
  let signalCount = 0;

  if (isMetadataObject(preferences)) {
    const fb = preferences.day_plan_feedback;
    if (isMetadataObject(fb)) {
      feedbackDates = Object.keys(fb).length;
    }
    const signals = preferences.behaviour_signals;
    if (Array.isArray(signals)) {
      signalCount = signals.filter((s) => isBehaviourSignal(s)).length;
    }
  }

  if (!profile && feedbackDates === 0 && signalCount === 0) {
    return "Trip intelligence: no planner profile or feedback recorded yet.";
  }

  const parts: string[] = ["Trip intelligence summary:"];

  if (profile) {
    parts.push(
      [
        `- Party: ${profile.partyType}`,
        `ride tolerance: ${profile.rideTolerance}`,
        `walking: ${profile.walkingPreference}`,
        `pace: ${profile.pacePreference}`,
        `meals: ${profile.mealPreference}`,
        `queues: ${profile.queuePreference}`,
        profile.avoidances.length ? `avoid: ${profile.avoidances.join(", ")}` : "avoid: (none)",
        profile.learnedSignals.length ? `learned: ${profile.learnedSignals.join(", ")}` : "learned: (none)",
      ].join("; "),
    );
  }

  if (feedbackDates > 0) {
    parts.push(`- Recorded feedback for ${feedbackDates} calendar day(s).`);
  }

  if (signalCount > 0) {
    parts.push(`- Behaviour signals stored: ${signalCount}.`);
  }

  return parts.join("\n");
}

const ASSIGNMENT_SLOTS = ["am", "pm", "lunch", "dinner"] as const;

/**
 * Theme-park tile ids actually placed on a calendar day (AM/PM/lunch/dinner),
 * in slot order, de-duplicated.
 */
export function collectThemeParkSlotIdsFromAssignment(
  dayAssignment: Assignment | undefined,
  parksById: Map<string, Park>,
): string[] {
  if (!dayAssignment || typeof dayAssignment !== "object") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const slot of ASSIGNMENT_SLOTS) {
    const raw = dayAssignment[slot];
    const pid = getParkIdFromSlotValue(raw);
    if (!pid) continue;
    const p = parksById.get(pid);
    if (!p || !isThemePark(p.park_group)) continue;
    if (seen.has(pid)) continue;
    seen.add(pid);
    out.push(pid);
  }
  return out;
}

/**
 * Default `paidAccess` for Smart Plan–authored day intents: only `yes` when the
 * trip wizard records a clear paid skip-line commitment for this region.
 */
export function inferPaidAccessDefaultForSmartPlanIntent(
  regionId: string | null | undefined,
  parksForInference: Park[],
  wizard: TripPlanningPreferences | null,
  tripProfile: TripPlanningProfile | null | undefined = null,
): DayPlanningPaidAccess {
  const dpa = tripProfile?.defaultPaidQueueAccess;
  if (dpa === "yes" || dpa === "no" || dpa === "not_sure" || dpa === "decide_later") {
    return dpa;
  }

  if (!regionId || !wizard) return "not_sure";

  const hasDisney = regionHasDisneyQueueParks(parksForInference, regionId);
  const hasUniversal = regionHasUniversalQueueParks(parksForInference, regionId);

  if (hasDisney) {
    const d = wizard.disneyLightningLane;
    if (d?.multiPassStatus === "all_park_days") return "yes";
    if (
      d?.multiPassStatus === "none" &&
      d.singlePassWillingToPay === "no"
    ) {
      return "no";
    }
  }

  if (hasUniversal) {
    const u = wizard.universalExpress?.status;
    if (u === "included_with_hotel" || u === "paid") return "yes";
    if (u === "no") return "no";
  }

  return "not_sure";
}

/** When false, Smart Plan must not place generic/named dining tile IDs in lunch/dinner. */
export function tripProfileAllowsStructuralMealSlots(
  pref: TripIntelligenceMealPreference | null | undefined,
): boolean {
  if (
    pref == null ||
    pref === "unknown" ||
    pref === "do_not_plan" ||
    pref === "existing_only"
  ) {
    return false;
  }
  return true;
}

function mapIntelligenceMealToDayMeal(
  p: TripIntelligenceMealPreference,
): DayPlanningMealPreference {
  switch (p) {
    case "do_not_plan":
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
    case "unknown":
      return "do_not_plan";
    default:
      return "suggest";
  }
}

function mapIntelligencePaceToDayPace(
  p: TripIntelligencePacePreference,
): DayPlanningPace {
  switch (p) {
    case "relaxed":
      return "relaxed";
    case "intense":
    case "go_go_go":
      return "packed";
    default:
      return "balanced";
  }
}

function rideLevelFromTolerance(tol: TripRideTolerance): DayPlanningRideLevel {
  switch (tol) {
    case "thrill_seeker":
      return "big_thrills";
    case "moderate_thrills":
      return "some_thrills";
    case "mostly_gentle":
      return "gentle";
    case "minimal_motion":
      return "shows_lands_food";
    default:
      return "some_thrills";
  }
}

function dayTypeFromProfile(
  profile: TripPlanningProfile | null,
): DayPlanningDayType {
  if (!profile) return "balanced_family";
  if (profile.rideTolerance === "thrill_seeker") return "thrill_heavy";
  if (profile.rideTolerance === "mostly_gentle") {
    return "lower_thrill";
  }
  if (profile.rideTolerance === "minimal_motion") {
    return "shows_food_exploring";
  }
  if (profile.partyType === "couple" && profile.rideTolerance === "moderate_thrills") {
    return "balanced_family";
  }
  return "balanced_family";
}

function startPreferenceFromWizard(
  wizard: TripPlanningPreferences | null,
): DayPlanningStartPreference {
  const exp = wizard?.mustDoExperiences;
  if (Array.isArray(exp) && exp.includes("rope_drop")) return "rope_drop";
  return "normal_morning";
}

function finishPreferenceFromProfile(
  profile: TripPlanningProfile | null,
): DayPlanningFinishPreference {
  if (profile?.pacePreference === "go_go_go" || profile?.pacePreference === "intense") {
    return "night_atmosphere";
  }
  return "early_evening";
}

export type BuildDefaultDayIntentForSmartPlanArgs = {
  completedAtISO: string;
  /** Canonical theme-park ids for this calendar day (see {@link collectThemeParkSlotIdsFromAssignment}). */
  selectedParkIds: string[];
  tripPlanningProfile: TripPlanningProfile | null;
  tripPlanningWizard: TripPlanningPreferences | null;
  regionId: string | null;
  /** Region parks list (built-in + custom-as-park) used only for Disney/Universal paid-access inference. */
  parksForRegionalQueueInference: Park[];
  /** Matches Smart Plan "keep existing tiles" — tighter downstream edit scope. */
  smartPlanPreserveExistingTiles: boolean;
};

/**
 * Produces a valid {@link DayPlanningIntent} for a park day assigned by Smart Plan.
 * Does not persist; callers merge into `trips.preferences.ai_day_intent` when appropriate.
 */
export function buildDefaultDayIntentForSmartPlan(
  args: BuildDefaultDayIntentForSmartPlanArgs,
): DayPlanningIntent {
  const profile = args.tripPlanningProfile;
  const wizard = args.tripPlanningWizard;
  const paidAccess = inferPaidAccessDefaultForSmartPlanIntent(
    args.regionId,
    args.parksForRegionalQueueInference,
    wizard,
    profile,
  );

  const mealPreference = profile
    ? mapIntelligenceMealToDayMeal(profile.mealPreference)
    : "suggest";

  const pace = profile
    ? mapIntelligencePaceToDayPace(profile.pacePreference)
    : "balanced";

  const rideLevel = profile
    ? rideLevelFromTolerance(profile.rideTolerance)
    : "some_thrills";

  const dayType = dayTypeFromProfile(profile);
  const avoid = profile?.avoidances?.length ? [...profile.avoidances] : [];

  const changePermission: DayPlanningChangePermission =
    args.smartPlanPreserveExistingTiles ? "add_around_existing" : "reorder_unlocked";

  const selected = [...args.selectedParkIds];
  const parkAction = selected.length > 0 ? "keep_existing" : "suggest";

  return {
    parkAction,
    selectedParkIds: selected,
    dayType,
    rideLevel,
    avoid,
    mealPreference,
    pace,
    startPreference: startPreferenceFromWizard(wizard),
    finishPreference: finishPreferenceFromProfile(profile),
    paidAccess,
    mustInclude: "",
    mustAvoid: "",
    changePermission,
    completedAt: args.completedAtISO,
  };
}

export type TripPlanningContextForAIArgs = {
  /** When set, assignment lines use park display names. */
  parksById?: Map<string, Park>;
  /** Trip date keys in order; defaults to each day from `trip.start_date`–`trip.end_date`. */
  sortedDateKeys?: string[];
  maxBehaviourSignals?: number;
};

/**
 * Read-only briefing for whole-trip / Smart Plan models (assignments + saved intelligence).
 * Safe with empty or partial `trip.preferences`.
 */
export function buildTripPlanningContextForAI(
  trip: Trip,
  args?: TripPlanningContextForAIArgs,
): string {
  const prefs = trip.preferences;
  const profile = readTripPlanningProfile(prefs);
  const wizard = trip.planning_preferences;

  const dateKeys =
    args?.sortedDateKeys?.length
      ? args.sortedDateKeys
      : eachDateKeyInRange(trip.start_date, trip.end_date);

  const lines: string[] = [
    "TRIP PLANNING CONTEXT (read-only — follow Smart Plan structural rules in the system prompt):",
  ];

  lines.push(
    profile
      ? `- trip_planning_profile: party ${profile.partyType}; ride_tolerance ${profile.rideTolerance}; walking ${profile.walkingPreference}; pace ${profile.pacePreference}; meal ${profile.mealPreference}; queue ${profile.queuePreference}; avoidances: ${profile.avoidances.length ? profile.avoidances.join(", ") : "(none)"}; learnedSignals: ${profile.learnedSignals.length ? profile.learnedSignals.join(", ") : "(none)"}`
      : "- trip_planning_profile: (none saved)",
  );

  if (wizard) {
    lines.push(
      `- planning_wizard: pace ${wizard.pace}; park_hopping ${wizard.parkHopping ?? "—"}; expected_full_park_days ${wizard.expectedFullParkDays ?? "—"}; include_disney_skip_tips ${String(wizard.includeDisneySkipTips !== false)}; include_universal_skip_tips ${String(wizard.includeUniversalSkipTips !== false)}`,
    );
  } else {
    lines.push("- planning_wizard: (none)");
  }

  if (isMetadataObject(prefs)) {
    const intentMap = prefs.ai_day_intent;
    if (isMetadataObject(intentMap)) {
      const keys = Object.keys(intentMap).filter((k) => isValidDateYmd(k));
      const sample = keys.slice(0, 8).map((k) => {
        const v = intentMap[k];
        if (!isDayPlanningIntent(v)) return `${k}: (invalid shape)`;
        return `${k}: parks=${v.selectedParkIds.join("|")} paidAccess=${v.paidAccess} change=${v.changePermission}`;
      });
      lines.push(
        keys.length
          ? `- ai_day_intent: ${keys.length} day(s)${sample.length ? ` — sample: ${sample.join("; ")}` : ""}`
          : "- ai_day_intent: (none)",
      );
    } else {
      lines.push("- ai_day_intent: (none)");
    }

    const fb = prefs.day_plan_feedback;
    if (isMetadataObject(fb)) {
      const fk = Object.keys(fb).filter((k) => isValidDateYmd(k));
      lines.push(
        fk.length
          ? `- day_plan_feedback: ${fk.length} day(s) with notes`
          : "- day_plan_feedback: (none)",
      );
    } else {
      lines.push("- day_plan_feedback: (none)");
    }

    const rawSignals = prefs.behaviour_signals;
    const maxSig = args?.maxBehaviourSignals ?? 8;
    if (Array.isArray(rawSignals)) {
      const signals = rawSignals.filter((s): s is BehaviourSignal =>
        isBehaviourSignal(s),
      );
      const tail = signals.slice(-maxSig);
      if (tail.length === 0) {
        lines.push("- behaviour_signals: (none)");
      } else {
        const brief = tail
          .map(
            (s) =>
              `${s.createdAt.slice(0, 10)} ${s.signalType}${s.date ? ` @${s.date}` : ""}`,
          )
          .join("; ");
        lines.push(`- behaviour_signals (last ${tail.length}): ${brief}`);
      }
    } else {
      lines.push("- behaviour_signals: (none)");
    }

    const mustDos = prefs.must_dos;
    const hasMust =
      mustDos &&
      typeof mustDos === "object" &&
      !Array.isArray(mustDos) &&
      Object.keys(mustDos as object).length > 0;
    lines.push(hasMust ? "- must_dos: present on trip preferences" : "- must_dos: (none)");

    const strategies = prefs.ai_day_strategy;
    if (isMetadataObject(strategies)) {
      const sk = Object.keys(strategies).filter((k) => isValidDateYmd(k));
      lines.push(
        sk.length
          ? `- ai_day_strategy: saved for ${sk.length} day(s) (do not replace from Smart Plan)`
          : "- ai_day_strategy: (none)",
      );
    }
  }

  let parkDays = 0;
  let restHeavyDays = 0;
  for (const d of dateKeys) {
    const slots = trip.assignments[d];
    if (!slots || typeof slots !== "object") continue;
    const pMap = args?.parksById;
    const themeIds = pMap
      ? collectThemeParkSlotIdsFromAssignment(slots, pMap)
      : [];
    if (themeIds.length > 0) parkDays += 1;
    const rawAm = slots.am;
    const rawPm = slots.pm;
    const amId = getParkIdFromSlotValue(rawAm);
    const pmId = getParkIdFromSlotValue(rawPm);
    if (amId === "rest" && pmId === "rest") restHeavyDays += 1;
  }
  lines.push(
    `- trip rhythm (approx from current calendar): theme-park days ${parkDays}, full rest AM+PM days ${restHeavyDays}, trip length ${dateKeys.length} night(s)`,
  );

  const parkIdToName = args?.parksById;
  lines.push("- existing assignments (do not contradict explicit guest tiles when preserve mode is on):");
  for (const d of dateKeys) {
    const slots = trip.assignments[d];
    if (!slots || typeof slots !== "object" || Object.keys(slots).length === 0) {
      continue;
    }
    const parts: string[] = [];
    for (const slot of ASSIGNMENT_SLOTS) {
      const v = slots[slot];
      const pid = getParkIdFromSlotValue(v);
      if (!pid) continue;
      const label =
        parkIdToName?.get(pid)?.name ??
        pid;
      parts.push(`${slot}=${label}`);
    }
    if (parts.length > 0) lines.push(`  • ${d}: ${parts.join(", ")}`);
  }

  lines.push(
    "- Locked / user-created tiles: when the guest keeps existing tiles, only fill empty AM/PM/lunch/dinner slots; never overwrite filled park or dining picks in JSON assignments.",
  );
  lines.push(
    "- Paid queue defaults: do not assume Lightning Lane, Genie+, Express Pass, Virtual Queue entitlement, or Single Rider shortcuts unless the wizard profile above clearly confirms paid/included skip-line products for this region.",
  );

  return lines.join("\n");
}
