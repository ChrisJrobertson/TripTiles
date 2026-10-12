import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { eachDateKeyInRange } from "@/lib/date-helpers";
import { isRestParkId, isTravelParkId } from "@/lib/planner-am-pm-display";
import { classifyPlannerDay } from "@/lib/trip-workspace-status";
import type { Assignment, Assignments, Park, SmartPlanScopeChoice, Trip } from "@/lib/types";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type SmartPlanCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type SmartPlanDayFate = "stays" | "may_fill" | "may_replace";

export type SmartPlanDayLine = {
  dateKey: string;
  label: string;
  fate: SmartPlanDayFate;
  detail: string;
};

export type SmartPlanReadiness = {
  /** False only when a required item is missing. Helpful gaps do not block. */
  ready: boolean;
  headline: string;
  required: SmartPlanCheck[];
  helpful: SmartPlanCheck[];
  /** Short lines for choices Smart Plan will leave alone. */
  fixed: string[];
  /** Short lines for what this scope may still change. */
  mayChange: string[];
  scopeNote: string;
  days: SmartPlanDayLine[];
  organisePreferencesHref: string;
};

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const mon = MONTHS_SHORT[month - 1] ?? "";
  return `${day} ${mon}`.trim();
}

function parkByIdMap(parks: readonly Park[]): Map<string, Park> {
  return new Map(parks.map((park) => [park.id, park]));
}

function dayTitle(
  assignment: Assignment | undefined,
  parkById: ReadonlyMap<string, Park>,
): string {
  const kind = classifyPlannerDay(assignment, parkById);
  if (kind === "rest") return "Rest";
  if (kind === "travel") return "Travel";
  if (kind === "unplanned") return "Open";
  const id =
    getParkIdFromSlotValue(assignment?.am) ??
    getParkIdFromSlotValue(assignment?.pm);
  return (id && parkById.get(id)?.name) || "Planned";
}

function slotIsProtected(id: string | undefined): boolean {
  if (!id) return false;
  return isRestParkId(id) || isTravelParkId(id);
}

/** A day the guest already marked as rest or travel. Smart Plan must not replace it. */
export function assignmentDayIsProtected(day: Assignment | undefined): boolean {
  if (!day) return false;
  const slots = ["am", "pm", "lunch", "dinner"] as const;
  return slots.some((slot) => slotIsProtected(getParkIdFromSlotValue(day[slot])));
}

/**
 * Put guest rest and travel days back after a merge.
 * Park days are left as the merge decided them, so "fill empty days" can
 * keep them and "improve the whole trip" can still replace them.
 */
export function restoreProtectedAssignmentDays(
  base: Assignments,
  merged: Assignments,
): Assignments {
  const out: Assignments = { ...merged };
  for (const [day, slots] of Object.entries(base)) {
    if (!assignmentDayIsProtected(slots)) continue;
    out[day] = { ...slots };
  }
  return out;
}

function fateForDay(params: {
  kind: ReturnType<typeof classifyPlannerDay>;
  protectedDay: boolean;
  scope: SmartPlanScopeChoice | null;
  dateKey: string;
  focusDateKey: string | null;
}): SmartPlanDayFate {
  if (params.protectedDay || params.kind === "rest" || params.kind === "travel") {
    return "stays";
  }
  if (params.scope === "plan_this_day_only" && params.focusDateKey) {
    if (params.dateKey !== params.focusDateKey) return "stays";
    return params.kind === "unplanned" ? "may_fill" : "may_replace";
  }
  if (params.kind === "unplanned") return "may_fill";
  if (params.scope === "improve_whole_trip") return "may_replace";
  return "stays";
}

function scopeNoteFor(scope: SmartPlanScopeChoice | null): string {
  switch (scope) {
    case "improve_whole_trip":
      return "Smart Plan may replace park days you already assigned. Rest days, travel days, and saved ride priorities stay as they are.";
    case "plan_this_day_only":
      return "Smart Plan only looks at the day you have open. Other days stay as they are.";
    case "suggest_changes_first":
    case "fill_empty_days_only":
      return "Smart Plan fills open days and leaves every day you have already chosen.";
    default:
      return "Until you choose otherwise, Smart Plan fills open days and leaves rest days, park days, and ride priorities as they are.";
  }
}

export function buildSmartPlanReadiness(params: {
  trip: Pick<
    Trip,
    | "id"
    | "start_date"
    | "end_date"
    | "assignments"
    | "planning_preferences"
    | "planning_preferences_issue"
  >;
  parks: readonly Park[];
  scope?: SmartPlanScopeChoice | null;
  focusDateKey?: string | null;
}): SmartPlanReadiness {
  const scope = params.scope ?? null;
  const focusDateKey = params.focusDateKey ?? null;
  const parkById = parkByIdMap(params.parks);
  const start = params.trip.start_date?.slice(0, 10) ?? "";
  const end = params.trip.end_date?.slice(0, 10) ?? "";
  const datesOk = Boolean(start && end && start <= end);
  const unsupported = params.trip.planning_preferences_issue?.unsupportedPace ?? null;
  const prefs = params.trip.planning_preferences;
  const paceOk = !unsupported && Boolean(prefs?.pace);
  const mustDoCount =
    prefs?.mustDoParks?.length ??
    params.trip.planning_preferences_issue?.fields.mustDoParks?.length ??
    0;

  const required: SmartPlanCheck[] = [
    {
      id: "dates",
      label: "Dates",
      ok: datesOk,
      detail: datesOk ? "Trip dates are set." : "Add a start and end date first.",
    },
    {
      id: "pace",
      label: "Planning style",
      ok: !unsupported,
      detail: unsupported
        ? `Saved pace “${unsupported}” needs confirming.`
        : paceOk
          ? "A supported pace is saved."
          : "Pace is not saved yet. You can still build a plan.",
    },
  ];

  const helpful: SmartPlanCheck[] = [];
  if (!unsupported && !paceOk) {
    helpful.push({
      id: "pace_missing",
      label: "Choose a pace",
      ok: false,
      detail: "A saved pace makes the plan match how you like to travel.",
    });
  }
  if (mustDoCount === 0) {
    helpful.push({
      id: "must_do",
      label: "Must-do parks",
      ok: false,
      detail: "Choose must-do parks if some parks matter more than others.",
    });
  } else {
    required.push({
      id: "must_do",
      label: "Must-do parks",
      ok: true,
      detail:
        mustDoCount === 1
          ? "1 must-do park is saved."
          : `${mustDoCount} must-do parks are saved.`,
    });
  }

  const days: SmartPlanDayLine[] = datesOk
    ? eachDateKeyInRange(start, end).map((dateKey) => {
        const assignment = params.trip.assignments?.[dateKey];
        const kind = classifyPlannerDay(assignment, parkById);
        const protectedDay = assignmentDayIsProtected(assignment);
        const title = dayTitle(assignment, parkById);
        const fate = fateForDay({
          kind,
          protectedDay,
          scope,
          dateKey,
          focusDateKey,
        });
        const label = `${formatDayLabel(dateKey)} · ${title}`;
        const detail =
          fate === "stays"
            ? `${label} stays as it is.`
            : fate === "may_fill"
              ? `${label} — Smart Plan may assign this day.`
              : `${label} may be replaced.`;
        return { dateKey, label, fate, detail };
      })
    : [];

  const fixed = [
    ...days.filter((day) => day.fate === "stays").map((day) => day.detail),
    "Saved ride priorities stay on their days.",
  ];
  const mayChange = days
    .filter((day) => day.fate !== "stays")
    .map((day) => day.detail);

  if (days.length > 0 && mayChange.length === 0) {
    helpful.push({
      id: "no_open_days",
      label: "Open days",
      ok: false,
      detail: "Every day already has a choice, so this plan will not move them.",
    });
  }

  const ready = required.every((check) => check.ok);
  const helpfulCount = helpful.length;
  const headline = !datesOk
    ? "Add trip dates first"
    : unsupported
      ? "Confirm your pace before building a plan"
      : helpfulCount > 0
        ? "Ready to build your plan"
        : "Ready to build your plan";

  return {
    ready,
    headline,
    required,
    helpful,
    fixed,
    mayChange,
    scopeNote: scopeNoteFor(scope),
    days,
    organisePreferencesHref: `/trip/${params.trip.id}?tab=planning#organise-preferences`,
  };
}
