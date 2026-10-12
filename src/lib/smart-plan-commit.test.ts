/**
 * Run: npx tsx src/lib/smart-plan-commit.test.ts
 */
import assert from "node:assert/strict";
import {
  commitSmartPlan,
  readSmartPlanUndoBundle,
} from "./smart-plan-commit";
import type { TripPlanningPreferences, TripPlanningProfile } from "./types";

const savedPrefs: TripPlanningPreferences = {
  pace: "relaxed",
  mustDoParks: ["mk", "ep", "hs", "ak"],
  priorities: ["characters"],
  additionalNotes: null,
  adults: 2,
  children: 1,
  childAges: [6],
};

const saved = {
  assignments: {
    "2026-11-02": {},
  },
  preferences: { note: "kept" },
  planningPreferences: savedPrefs,
};

const proposedPrefs: TripPlanningPreferences = {
  ...savedPrefs,
  pace: "balanced",
  mustDoParks: ["mk"],
};

const profile = {
  partyType: "family",
  rideTolerance: "mostly_gentle",
  avoidances: [],
  walkingPreference: "balanced",
  pacePreference: "balanced",
  mealPreference: "unknown",
  queuePreference: "balanced",
  learnedSignals: [],
  updatedAt: "2026-10-12T00:00:00.000Z",
} as TripPlanningProfile;

const failed = commitSmartPlan({
  generationOk: false,
  saved,
  proposed: {
    assignments: { "2026-11-02": { am: "mk", pm: "mk" } },
    preferences: { note: "new" },
    planningPreferences: proposedPrefs,
    profile,
  },
});

assert.equal(failed.wrote, false);
assert.equal(failed.undo, null);
assert.equal(failed.planningPreferences?.pace, "relaxed");
assert.deepEqual(failed.planningPreferences?.mustDoParks, [
  "mk",
  "ep",
  "hs",
  "ak",
]);
assert.deepEqual(failed.assignments, saved.assignments);
assert.equal(failed.preferences.note, "kept");
assert.equal(failed.preferences.trip_planning_profile, undefined);

const applied = commitSmartPlan({
  generationOk: true,
  saved,
  proposed: {
    assignments: { "2026-11-02": { am: "mk", pm: "mk" } },
    preferences: { note: "new" },
    planningPreferences: proposedPrefs,
    profile,
  },
});

assert.equal(applied.wrote, true);
assert.equal(applied.planningPreferences?.pace, "balanced");
assert.deepEqual(applied.planningPreferences?.mustDoParks, ["mk"]);
assert.deepEqual(applied.assignments["2026-11-02"], { am: "mk", pm: "mk" });
assert.equal(applied.preferences.note, "new");
assert.equal(
  (applied.preferences.trip_planning_profile as { pacePreference?: string })
    .pacePreference,
  "balanced",
);
assert.equal(applied.undo?.planningPreferences?.pace, "relaxed");
assert.deepEqual(applied.undo?.planningPreferences?.mustDoParks, [
  "mk",
  "ep",
  "hs",
  "ak",
]);
assert.deepEqual(applied.undo?.preferences, { note: "kept" });

const restored = readSmartPlanUndoBundle(applied.undo);
assert.equal(restored.planningPreferences?.pace, "relaxed");
assert.equal(restored.preferences.note, "kept");

const legacy = readSmartPlanUndoBundle({ crowd: "busy" });
assert.equal(legacy.preferences.crowd, "busy");
assert.equal("planningPreferences" in legacy, false);

console.log("smart-plan-commit.test.ts ok");
