import { isValidDateYmd } from "@/lib/day-planning-intent";
import type {
  BehaviourSignal,
  BehaviourSignalSource,
  BehaviourSignalType,
  DayPlanFeedback,
  DayPlanFeedbackReason,
  TripIntelligenceMealPreference,
  TripIntelligencePacePreference,
  TripIntelligenceQueuePreference,
  TripIntelligenceWalkingPreference,
  TripPlanningPartyType,
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
