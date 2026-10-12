import type { Assignments, TripPlanningPreferences, TripPlanningProfile } from "@/lib/types";

export const SMART_PLAN_UNDO_VERSION = 2;

export type SmartPlanUndoBundle = {
  smartPlanUndoVersion: typeof SMART_PLAN_UNDO_VERSION;
  preferences: Record<string, unknown>;
  planningPreferences: TripPlanningPreferences | null;
};

export type SmartPlanSavedSlice = {
  assignments: Assignments;
  preferences: Record<string, unknown>;
  planningPreferences: TripPlanningPreferences | null;
};

export type SmartPlanCommitResult = {
  wrote: boolean;
  assignments: Assignments;
  preferences: Record<string, unknown>;
  planningPreferences: TripPlanningPreferences | null;
  /** Present only when a successful run should replace the saved trip. */
  undo: SmartPlanUndoBundle | null;
};

/**
 * Smart Plan edits stay unsaved until generation succeeds.
 * A failed run returns the saved slice and creates no undo snapshot.
 */
export function commitSmartPlan(input: {
  generationOk: boolean;
  saved: SmartPlanSavedSlice;
  proposed: {
    assignments: Assignments;
    preferences: Record<string, unknown>;
    planningPreferences: TripPlanningPreferences | null;
    profile: TripPlanningProfile | null;
  };
}): SmartPlanCommitResult {
  if (!input.generationOk) {
    return {
      wrote: false,
      assignments: input.saved.assignments,
      preferences: input.saved.preferences,
      planningPreferences: input.saved.planningPreferences,
      undo: null,
    };
  }

  const preferences = { ...input.proposed.preferences };
  if (input.proposed.profile) {
    preferences.trip_planning_profile = input.proposed.profile;
  }

  return {
    wrote: true,
    assignments: input.proposed.assignments,
    preferences,
    planningPreferences:
      input.proposed.planningPreferences ?? input.saved.planningPreferences,
    undo: {
      smartPlanUndoVersion: SMART_PLAN_UNDO_VERSION,
      preferences: input.saved.preferences,
      planningPreferences: input.saved.planningPreferences,
    },
  };
}

/** Reads a Smart Plan undo snapshot. Legacy snapshots restore preferences only. */
export function readSmartPlanUndoBundle(raw: unknown): {
  preferences: Record<string, unknown>;
  planningPreferences?: TripPlanningPreferences | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { preferences: {} };
  }
  const record = raw as Record<string, unknown>;
  if (
    record.smartPlanUndoVersion === SMART_PLAN_UNDO_VERSION &&
    record.preferences &&
    typeof record.preferences === "object" &&
    !Array.isArray(record.preferences)
  ) {
    const planning = record.planningPreferences;
    return {
      preferences: record.preferences as Record<string, unknown>,
      planningPreferences:
        planning == null ? null : (planning as TripPlanningPreferences),
    };
  }
  return { preferences: record };
}
