import type { DayPlanningIntent } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PARK_ACTIONS = new Set([
  "keep_existing",
  "change_park",
  "add_park",
  "rest_day",
  "suggest",
]);
const DAY_TYPES = new Set([
  "thrill_heavy",
  "balanced_family",
  "lower_thrill",
  "shows_food_exploring",
  "shorter_easier",
  "suggest",
]);
const RIDE_LEVELS = new Set([
  "big_thrills",
  "some_thrills",
  "gentle",
  "shows_lands_food",
]);
const MEAL_PREFERENCES = new Set([
  "do_not_plan",
  "quick_service",
  "table_service",
  "mixed",
  "snacks",
  "existing_only",
  "suggest",
]);
const PACES = new Set(["packed", "balanced", "relaxed", "half_day"]);
const START_PREFERENCES = new Set([
  "rope_drop",
  "normal_morning",
  "slow_start",
  "afternoon",
]);
const FINISH_PREFERENCES = new Set([
  "after_lunch",
  "mid_afternoon",
  "early_evening",
  "night_atmosphere",
  "close",
]);
const PAID_ACCESS_VALUES = new Set(["yes", "no", "not_sure", "decide_later"]);
const CHANGE_PERMISSIONS = new Set([
  "fill_gaps_only",
  "add_around_existing",
  "reorder_unlocked",
  "replace_ai_only",
  "start_again",
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string")) return null;
  return value;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidDateYmd(date: string): boolean {
  return DATE_RE.test(date);
}

export function isDayPlanningIntent(value: unknown): value is DayPlanningIntent {
  if (!isObjectRecord(value)) return false;

  const selectedParkIds = asStringArray(value.selectedParkIds);
  const avoid = asStringArray(value.avoid);
  if (!selectedParkIds || !avoid) return false;

  return (
    typeof value.parkAction === "string" &&
    PARK_ACTIONS.has(value.parkAction) &&
    typeof value.dayType === "string" &&
    DAY_TYPES.has(value.dayType) &&
    typeof value.rideLevel === "string" &&
    RIDE_LEVELS.has(value.rideLevel) &&
    typeof value.mealPreference === "string" &&
    MEAL_PREFERENCES.has(value.mealPreference) &&
    typeof value.pace === "string" &&
    PACES.has(value.pace) &&
    typeof value.startPreference === "string" &&
    START_PREFERENCES.has(value.startPreference) &&
    typeof value.finishPreference === "string" &&
    FINISH_PREFERENCES.has(value.finishPreference) &&
    typeof value.paidAccess === "string" &&
    PAID_ACCESS_VALUES.has(value.paidAccess) &&
    typeof value.changePermission === "string" &&
    CHANGE_PERMISSIONS.has(value.changePermission) &&
    typeof value.mustInclude === "string" &&
    typeof value.mustAvoid === "string" &&
    (value.completedAt === undefined || typeof value.completedAt === "string")
  );
}

export function readDayPlanningIntent(
  preferences: unknown,
  date: string,
): DayPlanningIntent | null {
  if (!isValidDateYmd(date) || !isObjectRecord(preferences)) return null;
  const dayIntentMap = preferences.ai_day_intent;
  if (!isObjectRecord(dayIntentMap)) return null;
  const value = dayIntentMap[date];
  return isDayPlanningIntent(value) ? value : null;
}

export function writeDayPlanningIntent(
  preferences: unknown,
  date: string,
  intent: DayPlanningIntent,
): Record<string, unknown> {
  const base = isObjectRecord(preferences) ? { ...preferences } : {};
  const dayIntentMap = isObjectRecord(base.ai_day_intent)
    ? { ...base.ai_day_intent }
    : {};
  dayIntentMap[date] = intent;
  return { ...base, ai_day_intent: dayIntentMap };
}

export function getDefaultDayPlanningIntent(args: {
  date: string;
  dominantParkId?: string | null;
  existingIntent?: DayPlanningIntent | null;
}): DayPlanningIntent {
  const defaults: DayPlanningIntent = {
    parkAction: args.dominantParkId ? "keep_existing" : "suggest",
    selectedParkIds: args.dominantParkId ? [args.dominantParkId] : [],
    dayType: "balanced_family",
    rideLevel: "some_thrills",
    avoid: [],
    mealPreference: "suggest",
    pace: "balanced",
    startPreference: "normal_morning",
    finishPreference: "early_evening",
    paidAccess: "not_sure",
    mustInclude: "",
    mustAvoid: "",
    changePermission: "add_around_existing",
  };

  if (!args.existingIntent) return defaults;
  return { ...defaults, ...args.existingIntent };
}

export function hasRequiredDayPlanningIntent(intent: DayPlanningIntent): boolean {
  const hasBaseRequired = Boolean(
    intent.parkAction &&
      intent.dayType &&
      intent.rideLevel &&
      intent.mealPreference &&
      intent.pace &&
      intent.startPreference &&
      intent.finishPreference &&
      intent.paidAccess &&
      intent.changePermission,
  );
  if (!hasBaseRequired) return false;

  const mustHaveParkSelection =
    intent.parkAction === "keep_existing" ||
    intent.parkAction === "change_park" ||
    intent.parkAction === "add_park";

  if (!mustHaveParkSelection) return true;
  return Array.isArray(intent.selectedParkIds) && intent.selectedParkIds.length > 0;
}

function joinOrDefault(items: string[] | undefined, fallback: string): string {
  if (!items || items.length === 0) return fallback;
  return items.join(", ");
}

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDayPlanningIntentForPrompt(
  intent: DayPlanningIntent,
  context: {
    date: string;
    existingParkName?: string | null;
    selectedParkNames?: string[];
    existingMeals?: string[];
    currentAssignments?: Record<string, unknown>;
  },
): string {
  const selectedParks =
    context.selectedParkNames && context.selectedParkNames.length > 0
      ? context.selectedParkNames
      : intent.selectedParkIds;
  const assignmentCount = context.currentAssignments
    ? Object.keys(context.currentAssignments).length
    : 0;

  return [
    "DAY PLANNING INTENT — HARD RULES:",
    `- Selected date: ${context.date}`,
    `- Existing park: ${context.existingParkName ?? "None"}`,
    `- Park action: ${label(intent.parkAction)}`,
    `- Selected parks: ${joinOrDefault(selectedParks, "None selected")}`,
    `- Day type: ${label(intent.dayType)}`,
    `- Ride level: ${label(intent.rideLevel)}`,
    `- Avoid: ${joinOrDefault(intent.avoid, "None")}`,
    `- Meals: ${label(intent.mealPreference)}`,
    `- Existing meals: ${joinOrDefault(context.existingMeals, "None")}`,
    `- Pace: ${label(intent.pace)}`,
    `- Start: ${label(intent.startPreference)}`,
    `- Finish: ${label(intent.finishPreference)}`,
    `- Paid access: ${label(intent.paidAccess)}`,
    `- Must include: ${cleanString(intent.mustInclude) || "None"}`,
    `- Must avoid: ${cleanString(intent.mustAvoid) || "None"}`,
    `- Change permission: ${label(intent.changePermission)}`,
    "",
    "PRIORITY ORDER:",
    "1. Change permissions beat everything.",
    "2. Day intent beats trip defaults.",
    "3. Trip defaults beat generic theme park assumptions.",
    '4. Generic assumptions are only allowed when the user selected "suggest".',
    "",
    "HARD AI RULES:",
    "- Do not assume quick-service meals unless selected.",
    "- Do not assume table-service meals unless selected.",
    "- If meals are existing-only, use only the existing meal slots and do not add more.",
    "- Do not assume paid queue access unless selected as yes.",
    "- Do not assume rope drop unless selected.",
    "- Do not assume a thrill-heavy day unless selected.",
    "- Do not recommend avoided ride types.",
    "- Do not create an open-to-close plan unless finishPreference is close.",
    "- Do not overwrite existing user-created tiles unless changePermission allows it.",
    assignmentCount > 0
      ? `- Existing assignment slots already on this day: ${assignmentCount}.`
      : "- Existing assignment slots already on this day: none.",
  ].join("\n");
}

