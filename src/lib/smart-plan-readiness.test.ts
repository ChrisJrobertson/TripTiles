/**
 * Run: npx tsx src/lib/smart-plan-readiness.test.ts
 */
import assert from "node:assert/strict";
import {
  holidayWizardDefaults,
  hydrateHolidayWizardFromTripPreferences,
  mapWizardToPlanningPreferences,
} from "./smart-plan-holiday-wizard";
import {
  assignmentDayIsProtected,
  buildSmartPlanReadiness,
  restoreProtectedAssignmentDays,
} from "./smart-plan-readiness";
import type { Park, Trip } from "./types";

function park(partial: Pick<Park, "id" | "name" | "park_group">): Park {
  return {
    icon: null,
    bg_colour: "#123456",
    fg_colour: "#ffffff",
    destinations: [],
    region_ids: ["orlando"],
    is_custom: false,
    sort_order: 0,
    ...partial,
  };
}

function trip(
  partial: Partial<Trip> & Pick<Trip, "start_date" | "end_date">,
): Trip {
  return {
    id: "trip-1",
    owner_id: "user",
    agency_id: null,
    family_name: "Robertson",
    adventure_name: "Orlando",
    destination: "orlando",
    region_id: "orlando",
    has_cruise: false,
    cruise_embark: null,
    cruise_disembark: null,
    adults: 2,
    children: 0,
    child_ages: [],
    assignments: {},
    preferences: {},
    notes: null,
    budget_target: null,
    budget_currency: "GBP",
    is_public: false,
    public_slug: null,
    last_opened_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    day_snapshots: [],
    planning_preferences: null,
    colour_theme: "classic",
    email_reminders: true,
    gallery_owner_label: null,
    ...partial,
  };
}

const parks = [
  park({ id: "mk", name: "Magic Kingdom", park_group: "disney" }),
  park({ id: "eu", name: "Epic Universe", park_group: "universal" }),
  park({ id: "rest", name: "Rest / Pool", park_group: "activities" }),
];

const representative = trip({
  id: "82499e33-ed75-455f-b8c7-7e3dc22c9488",
  start_date: "2026-12-06",
  end_date: "2026-12-13",
  planning_preferences_issue: {
    unsupportedPace: "moderate",
    fields: {
      mustDoParks: ["mk"],
      priorities: [],
      additionalNotes: null,
      adults: 2,
      children: 0,
      childAges: [],
    },
  },
  assignments: {
    "2026-12-06": { am: "mk", pm: "mk" },
    "2026-12-07": { am: "eu", pm: "eu" },
    "2026-12-08": { am: "rest", pm: "rest" },
  },
});

const unsupported = buildSmartPlanReadiness({
  trip: representative,
  parks,
  scope: "fill_empty_days_only",
});

assert.equal(unsupported.ready, false);
assert.match(unsupported.headline, /pace/i);
const pace = unsupported.required.find((check) => check.id === "pace");
assert.equal(pace?.ok, false);
assert.match(pace?.detail ?? "", /moderate/);
assert.equal(unsupported.required.find((check) => check.id === "dates")?.ok, true);
assert.equal(
  unsupported.organisePreferencesHref,
  "/trip/82499e33-ed75-455f-b8c7-7e3dc22c9488?tab=planning#organise-preferences",
);

const rest = unsupported.days.find((day) => day.dateKey === "2026-12-08");
const magic = unsupported.days.find((day) => day.dateKey === "2026-12-06");
const epic = unsupported.days.find((day) => day.dateKey === "2026-12-07");
const open = unsupported.days.find((day) => day.dateKey === "2026-12-09");
assert.equal(rest?.fate, "stays");
assert.match(rest?.detail ?? "", /Rest/);
assert.equal(magic?.fate, "stays");
assert.match(magic?.label ?? "", /Magic Kingdom/);
assert.equal(epic?.fate, "stays");
assert.equal(open?.fate, "may_fill");
assert.equal(unsupported.days.filter((day) => day.fate === "may_fill").length, 5);
assert.ok(unsupported.fixed.some((line) => /ride priorities/i.test(line)));

const overwrite = buildSmartPlanReadiness({
  trip: representative,
  parks,
  scope: "improve_whole_trip",
});
assert.equal(
  overwrite.days.find((day) => day.dateKey === "2026-12-08")?.fate,
  "stays",
);
assert.equal(
  overwrite.days.find((day) => day.dateKey === "2026-12-06")?.fate,
  "may_replace",
);
assert.match(overwrite.scopeNote, /Rest days/);

const confirmed = buildSmartPlanReadiness({
  trip: {
    ...representative,
    planning_preferences_issue: null,
    planning_preferences: {
      pace: "relaxed",
      mustDoParks: ["mk", "eu"],
      priorities: [],
      additionalNotes: null,
      adults: 2,
      children: 0,
      childAges: [],
    },
  },
  parks,
  scope: "fill_empty_days_only",
});
assert.equal(confirmed.ready, true);
assert.equal(confirmed.headline, "Ready to build your plan");
assert.equal(confirmed.required.find((check) => check.id === "must_do")?.ok, true);
assert.equal(confirmed.helpful.length, 0);

const missingOptional = buildSmartPlanReadiness({
  trip: trip({
    start_date: "2026-12-06",
    end_date: "2026-12-08",
    planning_preferences: null,
  }),
  parks,
});
assert.equal(missingOptional.ready, true);
assert.ok(missingOptional.helpful.some((item) => item.id === "pace_missing"));
assert.ok(missingOptional.helpful.some((item) => item.id === "must_do"));

assert.equal(
  assignmentDayIsProtected({ am: "rest", pm: "mk" }),
  true,
);
assert.equal(assignmentDayIsProtected({ am: "mk", pm: "mk" }), false);
assert.equal(assignmentDayIsProtected({ am: "flyout" }), true);

const restored = restoreProtectedAssignmentDays(
  {
    "2026-12-06": { am: "mk", pm: "mk" },
    "2026-12-08": { am: "rest", pm: "rest" },
  },
  {
    "2026-12-06": { am: "eu", pm: "eu" },
    "2026-12-08": { am: "eu", pm: "eu" },
    "2026-12-09": { am: "mk", pm: "mk" },
  },
);
assert.deepEqual(restored["2026-12-08"], { am: "rest", pm: "rest" });
assert.deepEqual(restored["2026-12-06"], { am: "eu", pm: "eu" });
assert.deepEqual(restored["2026-12-09"], { am: "mk", pm: "mk" });

const savedPaceTrip = trip({
  start_date: "2026-11-02",
  end_date: "2026-11-08",
  planning_preferences: {
    pace: "relaxed",
    mustDoParks: ["mk", "ep", "hs", "ak"],
    priorities: ["characters"],
    additionalNotes: null,
    adults: 2,
    children: 0,
    childAges: [],
  },
});
const hydrated = hydrateHolidayWizardFromTripPreferences({
  trip: savedPaceTrip,
  profile: null,
});
assert.equal(hydrated.paceStyle, "relaxed");
assert.deepEqual(hydrated.parkPriorities, ["mk", "ep", "hs", "ak"]);
const kept = mapWizardToPlanningPreferences({
  trip: savedPaceTrip,
  wizard: holidayWizardDefaults(),
  tripParks: parks,
});
assert.deepEqual(kept.mustDoParks, ["mk", "ep", "hs", "ak"]);

console.log("smart-plan-readiness.test.ts ok");
