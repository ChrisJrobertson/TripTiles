import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { getAiDayTimelineForDate } from "@/lib/ai-day-timeline";
import { eachDateKeyInRange, MONTHS_SHORT, parseDate } from "@/lib/date-helpers";
import { planningPaceLabel } from "@/lib/planning-preferences-load";
import {
  buildAmPmPresentation,
  isRestParkId,
  isTravelParkId,
} from "@/lib/planner-am-pm-display";
import { isThemePark } from "@/lib/park-categories";
import type { Park, Trip, TripBudgetItem } from "@/lib/types";
import type { TripPayment } from "@/types/payments";

export type PlanningStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "needs_attention";

export type PlannerDayKind = "park" | "rest" | "travel" | "unplanned" | "planned";

export type WorkspaceAreaId =
  | "park_days"
  | "accommodation"
  | "checklist"
  | "budget"
  | "preferences"
  | "smart_plan";

export type WorkspaceArea = {
  id: WorkspaceAreaId;
  label: string;
  status: PlanningStatus;
  detail: string;
};

export type WorkspaceActionKind = "focus_day" | "open_day" | "smart_plan" | "href";

export type WorkspaceAction = {
  id: string;
  label: string;
  detail: string;
  kind: WorkspaceActionKind;
  dateKey?: string;
  href?: string;
};

export type ChecklistSnapshot = {
  total: number;
  checked: number;
};

export type TripWorkspaceModel = {
  areas: WorkspaceArea[];
  actions: WorkspaceAction[];
  dayKinds: Record<string, PlannerDayKind>;
};

const STATUS_LABEL: Record<PlanningStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  needs_attention: "Needs attention",
};

const DAY_KIND_LABEL: Record<PlannerDayKind, string> = {
  park: "Park",
  rest: "Rest",
  travel: "Travel",
  unplanned: "Open",
  planned: "Planned",
};

export function planningStatusLabel(status: PlanningStatus): string {
  return STATUS_LABEL[status];
}

export type OrganiseTone =
  | "complete"
  | "in_progress"
  | "needs_attention"
  | "optional";

const ORGANISE_TONE_LABEL: Record<OrganiseTone, string> = {
  complete: "Complete",
  in_progress: "In progress",
  needs_attention: "Needs attention",
  optional: "Optional",
};

/** Organise labels share PlanningStatus. Not-started is either required or optional. */
export function organiseTone(
  status: PlanningStatus,
  whenNotStarted: "needs_attention" | "optional",
): OrganiseTone {
  if (status === "ready") return "complete";
  if (status === "in_progress") return "in_progress";
  if (status === "needs_attention") return "needs_attention";
  return whenNotStarted;
}

export function organiseToneLabel(tone: OrganiseTone): string {
  return ORGANISE_TONE_LABEL[tone];
}

export function tripSetupStatus(
  trip: Pick<
    Trip,
    | "start_date"
    | "end_date"
    | "destination"
    | "has_cruise"
    | "cruise_embark"
    | "cruise_disembark"
  >,
): { status: PlanningStatus; detail: string } {
  const start = trip.start_date.slice(0, 10);
  const end = trip.end_date.slice(0, 10);
  if (!start || !end || !trip.destination) {
    return {
      status: "needs_attention",
      detail: "Dates or destination are missing",
    };
  }
  if (trip.has_cruise && (!trip.cruise_embark || !trip.cruise_disembark)) {
    return { status: "in_progress", detail: "Cruise dates still need adding" };
  }
  return { status: "ready", detail: "Dates and destination are saved" };
}

export function plannerDayKindLabel(kind: PlannerDayKind): string {
  return DAY_KIND_LABEL[kind];
}

/** What a person should read on a day, derived from the calendar — not stored. */
export type PlannerDayReadiness =
  | "open"
  | "needs_planning"
  | "ready"
  | "rest"
  | "travel"
  | "planned";

export function plannerDayReadiness(input: {
  kind: PlannerDayKind;
  hasRidePriorities: boolean;
  hasDayPlan: boolean;
}): PlannerDayReadiness {
  if (input.kind === "unplanned") return "open";
  if (input.kind === "rest") return "rest";
  if (input.kind === "travel") return "travel";
  if (input.kind === "planned") return "planned";
  if (input.hasRidePriorities || input.hasDayPlan) return "ready";
  return "needs_planning";
}

export function plannerDayReadinessLabel(status: PlannerDayReadiness): string {
  switch (status) {
    case "open":
      return "Open";
    case "needs_planning":
      return "Needs planning";
    case "ready":
      return "Ready";
    case "rest":
      return "Rest day";
    case "travel":
      return "Travel";
    case "planned":
      return "Planned";
  }
}

/** Short chip label. The full label stays in the day summary. */
export function plannerDayReadinessShortLabel(status: PlannerDayReadiness): string {
  switch (status) {
    case "open":
      return "Open";
    case "needs_planning":
      return "To plan";
    case "ready":
      return "Ready";
    case "rest":
      return "Rest";
    case "travel":
      return "Travel";
    case "planned":
      return "Planned";
  }
}

export function plannerDayNextStep(status: PlannerDayReadiness): string {
  switch (status) {
    case "open":
      return "Choose a park, or leave this day free.";
    case "needs_planning":
      return "The park is set. Add ride priorities, or plan the day.";
    case "ready":
      return "This day already has a plan. You can still change it.";
    case "rest":
      return "You left this day free on purpose.";
    case "travel":
      return "This is a travel day.";
    case "planned":
      return "Something is already on this day.";
  }
}

function filledHalfIsRest(park: Park): boolean {
  if (isRestParkId(park.id)) return true;
  const name = park.name.toLowerCase();
  return /\brest\b|\bpool\b|lazy|hotel day/.test(name);
}

/** How a calendar day should read: park, rest, travel, open, or another planned day. */
export function classifyPlannerDay(
  assignment: Trip["assignments"][string] | undefined,
  parkById: ReadonlyMap<string, Park>,
): PlannerDayKind {
  const ass = assignment ?? {};
  const presentation = buildAmPmPresentation(ass, parkById);

  if (presentation.mode === "unified_rest_day") return "rest";
  if (presentation.mode === "unified_travel_day") return "travel";
  if (presentation.mode === "unified_full_day") {
    return isThemePark(presentation.park.park_group) ? "park" : "planned";
  }

  const halves = [presentation.morning, presentation.afternoon].flatMap((half) =>
    half.state === "park" ? [half.park] : [],
  );
  if (halves.length === 0) {
    const lunch = getParkIdFromSlotValue(ass.lunch);
    const dinner = getParkIdFromSlotValue(ass.dinner);
    return lunch || dinner ? "planned" : "unplanned";
  }
  if (halves.some((park) => isThemePark(park.park_group))) return "park";
  if (halves.every((park) => isTravelParkId(park.id))) return "travel";
  if (halves.every((park) => filledHalfIsRest(park))) return "rest";
  return "planned";
}

function formatDayLabel(dateKey: string): string {
  const d = parseDate(dateKey);
  const mon = MONTHS_SHORT[d.getMonth()] ?? "";
  return `${d.getDate()} ${mon}`.trim();
}

function daysUntil(todayKey: string, dateKey: string): number {
  const a = parseDate(todayKey).getTime();
  const b = parseDate(dateKey).getTime();
  return Math.round((b - a) / 86400000);
}

function tripPhase(
  trip: Pick<Trip, "start_date" | "end_date">,
  todayKey: string,
): "upcoming" | "underway" | "past" {
  if (todayKey < trip.start_date.slice(0, 10)) return "upcoming";
  if (todayKey > trip.end_date.slice(0, 10)) return "past";
  return "underway";
}

function countSavedDayPlans(
  preferences: Trip["preferences"],
  dateKeys: string[],
): number {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return 0;
  }
  let n = 0;
  for (const key of dateKeys) {
    if (getAiDayTimelineForDate(preferences, key)) n += 1;
  }
  return n;
}

function joinCounts(parts: Array<[number, string]>): string {
  const bits = parts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  return bits.length ? bits.join(" · ") : "No days in this trip";
}

export function buildTripWorkspaceModel(input: {
  trip: Trip;
  parkById: ReadonlyMap<string, Park>;
  payments: TripPayment[];
  todayKey: string;
  /** Null until the checklist has loaded. Failed loads stay omitted. */
  checklist: ChecklistSnapshot | null;
  /** Null until budget lines have loaded. */
  budgetItems: TripBudgetItem[] | null;
  tripHrefBase: string;
}): TripWorkspaceModel {
  const { trip, parkById, payments, todayKey, checklist, budgetItems, tripHrefBase } =
    input;
  const dateKeys = eachDateKeyInRange(trip.start_date, trip.end_date);
  const dayKinds: Record<string, PlannerDayKind> = {};
  for (const key of dateKeys) {
    dayKinds[key] = classifyPlannerDay(trip.assignments[key], parkById);
  }

  const counts = {
    park: 0,
    rest: 0,
    travel: 0,
    unplanned: 0,
    planned: 0,
  };
  for (const kind of Object.values(dayKinds)) counts[kind] += 1;
  const assignedDays = dateKeys.length - counts.unplanned;
  const phase = tripPhase(trip, todayKey);
  const untilStart = daysUntil(todayKey, trip.start_date.slice(0, 10));
  const firstUnplanned = dateKeys.find((key) => dayKinds[key] === "unplanned") ?? null;

  let parkStatus: PlanningStatus;
  if (assignedDays === 0) parkStatus = "not_started";
  else if (counts.unplanned === 0) parkStatus = "ready";
  else if (phase !== "past" && untilStart <= 14) parkStatus = "needs_attention";
  else parkStatus = "in_progress";

  const areas: WorkspaceArea[] = [
    {
      id: "park_days",
      label: "Park days",
      status: parkStatus,
      detail: joinCounts([
        [counts.park, counts.park === 1 ? "park day" : "park days"],
        [counts.rest, "rest"],
        [counts.travel, "travel"],
        [counts.planned, "other"],
        [counts.unplanned, "open"],
      ]),
    },
  ];

  const prefs = trip.planning_preferences;
  const unsupportedPace = trip.planning_preferences_issue?.unsupportedPace;
  if (unsupportedPace) {
    areas.push({
      id: "preferences",
      label: "Planning preferences",
      status: "needs_attention",
      detail: "Saved pace needs choosing",
    });
  } else if (!prefs) {
    areas.push({
      id: "preferences",
      label: "Planning preferences",
      status: "not_started",
      detail: "Pace and must-dos are not set",
    });
  } else {
    const pace = planningPaceLabel(prefs.pace);
    const musts = prefs.mustDoParks?.length ?? 0;
    areas.push({
      id: "preferences",
      label: "Planning preferences",
      status: "ready",
      detail:
        musts > 0
          ? `${pace} pace · ${musts} must-do park${musts === 1 ? "" : "s"}`
          : `${pace} pace`,
    });
  }

  const savedPlans = countSavedDayPlans(trip.preferences, dateKeys);
  const hasSnapshot = Boolean(trip.previous_assignments_snapshot_at);
  let smartStatus: PlanningStatus = "not_started";
  let smartDetail = "Not built yet";
  if (hasSnapshot && assignedDays === 0) {
    smartStatus = "needs_attention";
    smartDetail = "A Smart Plan was applied, but the calendar is empty";
  } else if (hasSnapshot) {
    smartStatus = "ready";
    smartDetail = "Smart Plan applied";
  } else if (savedPlans > 0 && counts.park > 0 && savedPlans < counts.park) {
    smartStatus = "in_progress";
    smartDetail = `${savedPlans} of ${counts.park} park days have a day plan`;
  } else if (savedPlans > 0) {
    smartStatus = "ready";
    smartDetail =
      savedPlans === 1 ? "1 day plan saved" : `${savedPlans} day plans saved`;
  }
  areas.push({
    id: "smart_plan",
    label: "Smart Plan",
    status: smartStatus,
    detail: smartDetail,
  });

  const stayPayments = payments.filter(
    (p) => p.category === "hotel" || p.category === "villa",
  );
  const stayBudget = (budgetItems ?? []).filter((item) => item.category === "accommodation");
  const stayKnown = budgetItems !== null || stayPayments.length > 0;
  if (stayKnown) {
    const unpaidStayPayments = stayPayments.filter((p) => !p.paid_at);
    const unpaidStayBudget = stayBudget.filter((item) => !item.is_paid);
    const soonStay = unpaidStayPayments.find((p) => {
      if (!p.due_date) return false;
      return daysUntil(todayKey, p.due_date.slice(0, 10)) <= 14;
    });
    let stayStatus: PlanningStatus = "not_started";
    let stayDetail = "No stay recorded";
    if (stayPayments.length === 0 && stayBudget.length === 0) {
      stayStatus = "not_started";
      stayDetail = "No stay recorded";
    } else if (soonStay) {
      stayStatus = "needs_attention";
      stayDetail = `${soonStay.label} due ${formatDayLabel(soonStay.due_date!.slice(0, 10))}`;
    } else if (unpaidStayPayments.length > 0 || unpaidStayBudget.length > 0) {
      stayStatus = "in_progress";
      stayDetail = "Stay recorded, still to pay";
    } else {
      stayStatus = "ready";
      stayDetail = "Stay recorded";
    }
    areas.push({
      id: "accommodation",
      label: "Accommodation",
      status: stayStatus,
      detail: stayDetail,
    });
  }

  if (checklist) {
    let status: PlanningStatus = "not_started";
    let detail = "No items yet";
    if (checklist.total === 0) {
      status = "not_started";
      detail = "No items yet";
    } else if (checklist.checked >= checklist.total) {
      status = "ready";
      detail =
        checklist.total === 1 ? "1 item done" : `All ${checklist.total} items done`;
    } else if (checklist.checked === 0) {
      status = "not_started";
      detail =
        checklist.total === 1 ? "1 item still open" : `${checklist.total} items still open`;
    } else {
      status = "in_progress";
      detail = `${checklist.checked} of ${checklist.total} done`;
    }
    areas.push({
      id: "checklist",
      label: "Checklist",
      status,
      detail,
    });
  }

  const budgetKnown =
    budgetItems !== null ||
    payments.length > 0 ||
    (trip.budget_target != null && trip.budget_target > 0);
  if (budgetKnown) {
    const unpaid = payments.filter((p) => !p.paid_at);
    const soon = unpaid
      .filter((p) => p.due_date)
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
      .find((p) => daysUntil(todayKey, p.due_date!.slice(0, 10)) <= 21);
    const unpaidItems = (budgetItems ?? []).filter((item) => !item.is_paid);
    const hasTarget = trip.budget_target != null && trip.budget_target > 0;
    const hasLines = payments.length > 0 || (budgetItems?.length ?? 0) > 0;
    let status: PlanningStatus = "not_started";
    let detail = "No payments or budget yet";
    if (soon) {
      status = "needs_attention";
      detail = `${soon.label} due ${formatDayLabel(soon.due_date!.slice(0, 10))}`;
    } else if (unpaid.length > 0 || unpaidItems.length > 0) {
      status = "in_progress";
      const openCount = unpaid.length + unpaidItems.length;
      detail = openCount === 1 ? "1 amount still open" : `${openCount} amounts still open`;
    } else if (hasLines && budgetItems !== null) {
      status = "ready";
      detail = "Payments and budget lines are marked paid";
    } else if (payments.length > 0) {
      status = "in_progress";
      detail = "Payments are marked paid";
    } else if (hasTarget) {
      status = "in_progress";
      detail = "A budget target is set, with no lines yet";
    }
    areas.push({
      id: "budget",
      label: "Budget and payments",
      status,
      detail,
    });
  }

  const actions: WorkspaceAction[] = [];
  const base = tripHrefBase.replace(/\/$/, "");

  if (phase !== "past" && firstUnplanned) {
    if (assignedDays === 0) {
      actions.push({
        id: "assign-parks",
        label: "Finish assigning park days",
        detail: "Every day is still open",
        kind: "focus_day",
        dateKey: firstUnplanned,
      });
    } else {
      actions.push({
        id: "review-open-day",
        label: "Review an unplanned day",
        detail: `${formatDayLabel(firstUnplanned)} has no park or rest day yet`,
        kind: "open_day",
        dateKey: firstUnplanned,
      });
    }
  }

  if (phase !== "past" && unsupportedPace) {
    actions.push({
      id: "preferences-pace",
      label: "Choose a planning pace",
      detail: "A saved pace isn't one TripTiles can use",
      kind: "href",
      href: `${base}?tab=planning#organise-preferences`,
    });
  } else if (phase !== "past" && !prefs) {
    actions.push({
      id: "preferences",
      label: "Add planning preferences",
      detail: "Pace and must-dos live in Smart Plan",
      kind: "smart_plan",
    });
  }

  const budgetArea = areas.find((area) => area.id === "budget");
  if (budgetArea?.status === "needs_attention") {
    actions.push({
      id: "payment",
      label: "Review an upcoming payment",
      detail: budgetArea.detail,
      kind: "href",
      href: `${base}?tab=payments`,
    });
  }

  if (checklist && checklist.total > 0 && checklist.checked < checklist.total) {
    const left = checklist.total - checklist.checked;
    actions.push({
      id: "checklist",
      label: "Complete checklist items",
      detail: left === 1 ? "1 item still open" : `${left} items still open`,
      kind: "href",
      href: `${base}?tab=checklist`,
    });
  } else if (checklist && checklist.total === 0 && phase !== "past") {
    actions.push({
      id: "checklist-start",
      label: "Complete checklist items",
      detail: "The list has no items yet",
      kind: "href",
      href: `${base}?tab=checklist`,
    });
  }

  const stayArea = areas.find((area) => area.id === "accommodation");
  if (stayArea?.status === "not_started" && phase !== "past") {
    actions.push({
      id: "stay",
      label: "Add where you're staying",
      detail: "This helps keep the whole trip together.",
      kind: "href",
      href: `${base}?tab=planning#organise-accommodation`,
    });
  } else if (stayArea?.status === "needs_attention") {
    actions.push({
      id: "stay-due",
      label: "Review an upcoming payment",
      detail: stayArea.detail,
      kind: "href",
      href: `${base}?tab=payments`,
    });
  }

  if (phase !== "past" && smartStatus === "not_started" && prefs) {
    actions.push({
      id: "smart-plan",
      label: "Build your Smart Plan",
      detail: "Preferences are saved and no plan has been applied",
      kind: "smart_plan",
    });
  }

  const seen = new Set<string>();
  const unique = actions.filter((action) => {
    const key = `${action.label}|${action.href ?? ""}|${action.dateKey ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    areas,
    actions: unique.slice(0, 4),
    dayKinds,
  };
}
