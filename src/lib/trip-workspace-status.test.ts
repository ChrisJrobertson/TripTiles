/**
 * Run: npx tsx src/lib/trip-workspace-status.test.ts
 */
import assert from "node:assert/strict";
import { loadPlanningPreferences } from "./planning-preferences-load";
import {
  buildTripWorkspaceModel,
  classifyPlannerDay,
  organiseTone,
  plannerDayNextStep,
  plannerDayReadiness,
  plannerDayReadinessLabel,
  tripSetupStatus,
} from "./trip-workspace-status";
import type { Park, Trip, TripBudgetItem } from "./types";
import type { TripPayment } from "@/types/payments";

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

function trip(partial: Partial<Trip> & Pick<Trip, "start_date" | "end_date">): Trip {
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
    children: 1,
    child_ages: [7],
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

function payment(partial: Partial<TripPayment> & Pick<TripPayment, "id" | "label">): TripPayment {
  return {
    trip_id: "trip-1",
    amount_pence: 10000,
    currency: "GBP",
    booking_date: null,
    due_date: null,
    paid_at: null,
    category: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

const magic = park({ id: "magic", name: "Magic Kingdom", park_group: "disney" });
const rest = park({ id: "rest", name: "Rest / Pool", park_group: "activities" });
const parks = new Map<string, Park>([
  [magic.id, magic],
  [rest.id, rest],
]);

function run() {
  {
    const model = buildTripWorkspaceModel({
      trip: trip({ start_date: "2026-11-01", end_date: "2026-11-03" }),
      parkById: parks,
      payments: [],
      todayKey: "2026-10-07",
      checklist: null,
      budgetItems: null,
      tripHrefBase: "/trip/trip-1",
    });
    const parkArea = model.areas.find((area) => area.id === "park_days");
    assert.equal(parkArea?.status, "not_started");
    assert.equal(parkArea?.detail, "3 open");
    assert.equal(model.actions[0]?.label, "Finish assigning park days");
    assert.equal(model.actions.some((action) => action.label.includes("%")), false);
    assert.equal(JSON.stringify(model).includes("%"), false);
  }

  {
    const model = buildTripWorkspaceModel({
      trip: trip({
        start_date: "2026-11-01",
        end_date: "2026-11-03",
        assignments: {
          "2026-11-01": { am: "magic", pm: "magic" },
          "2026-11-02": { am: "rest", pm: "rest" },
        },
        planning_preferences: {
          pace: "balanced",
          mustDoParks: ["magic"],
          priorities: [],
          additionalNotes: null,
          adults: 2,
          children: 1,
          childAges: [7],
        },
      }),
      parkById: parks,
      payments: [
        payment({
          id: "pay-1",
          label: "Villa balance",
          category: "villa",
          due_date: "2026-10-20",
        }),
      ],
      todayKey: "2026-10-07",
      checklist: { total: 4, checked: 1 },
      budgetItems: [],
      tripHrefBase: "/trip/trip-1",
    });
    assert.equal(model.dayKinds["2026-11-01"], "park");
    assert.equal(model.dayKinds["2026-11-02"], "rest");
    assert.equal(model.dayKinds["2026-11-03"], "unplanned");
    assert.equal(
      model.areas.find((area) => area.id === "park_days")?.status,
      "in_progress",
    );
    assert.equal(
      model.areas.find((area) => area.id === "preferences")?.status,
      "ready",
    );
    assert.equal(
      model.actions.some((action) => action.id === "review-open-day"),
      true,
    );
    assert.equal(
      model.actions.some((action) => action.id === "smart-plan"),
      true,
    );
    assert.equal(
      model.actions.some((action) => action.href === "/trip/trip-1?tab=checklist"),
      true,
    );
    assert.ok(model.actions.length <= 4);
  }

  {
    const model = buildTripWorkspaceModel({
      trip: trip({
        start_date: "2026-04-01",
        end_date: "2026-04-02",
        assignments: {
          "2026-04-01": { am: "magic", pm: "magic" },
          "2026-04-02": { am: "rest", pm: "rest" },
        },
        previous_assignments_snapshot_at: "2026-03-01T00:00:00Z",
        planning_preferences: {
          pace: "relaxed",
          mustDoParks: [],
          priorities: [],
          additionalNotes: null,
          adults: 2,
          children: 0,
          childAges: [],
        },
      }),
      parkById: parks,
      payments: [
        payment({
          id: "pay-2",
          label: "Hotel",
          category: "hotel",
          paid_at: "2026-01-02T00:00:00Z",
        }),
      ],
      todayKey: "2026-10-07",
      checklist: { total: 2, checked: 2 },
      budgetItems: [
        {
          id: "b1",
          trip_id: "trip-1",
          category: "accommodation",
          label: "Hotel",
          amount: 800,
          currency: "GBP",
          is_paid: true,
          notes: null,
          sort_order: 0,
          created_at: "",
          updated_at: "",
        } satisfies TripBudgetItem,
      ],
      tripHrefBase: "/trip/trip-1",
    });
    assert.equal(model.actions.length, 0);
    assert.equal(
      model.areas.find((area) => area.id === "smart_plan")?.status,
      "ready",
    );
    assert.equal(
      model.areas.find((area) => area.id === "checklist")?.status,
      "ready",
    );
    assert.equal(
      model.areas.find((area) => area.id === "accommodation")?.status,
      "ready",
    );
    assert.equal(model.areas.find((area) => area.id === "park_days")?.status, "ready");
  }

  {
    const soon = buildTripWorkspaceModel({
      trip: trip({
        start_date: "2026-10-10",
        end_date: "2026-10-12",
        assignments: { "2026-10-10": { am: "magic", pm: "magic" } },
      }),
      parkById: parks,
      payments: [],
      todayKey: "2026-10-07",
      checklist: null,
      budgetItems: null,
      tripHrefBase: "/trip/trip-1",
    });
    assert.equal(
      soon.areas.find((area) => area.id === "park_days")?.status,
      "needs_attention",
    );
  }

  {
    const loaded = loadPlanningPreferences({
      pace: "moderate",
      mustDoParks: ["mk", "ep"],
      priorities: ["epic_universe"],
      adults: 2,
      children: 1,
      childAges: [11],
    });
    assert.equal(loaded.preferences, null);
    assert.equal(loaded.issue?.unsupportedPace, "moderate");
    assert.deepEqual(loaded.issue?.fields.mustDoParks, ["mk", "ep"]);
    assert.equal(
      JSON.stringify(loaded).includes("balanced"),
      false,
    );

    const valid = loadPlanningPreferences({
      pace: "intense",
      mustDoParks: ["hs"],
      priorities: [],
      adults: 2,
      children: 0,
      childAges: [],
    });
    assert.equal(valid.preferences?.pace, "intense");
    assert.equal(valid.issue, null);

    const model = buildTripWorkspaceModel({
      trip: trip({
        start_date: "2026-12-06",
        end_date: "2026-12-13",
        planning_preferences: null,
        planning_preferences_issue: loaded.issue,
      }),
      parkById: parks,
      payments: [],
      todayKey: "2026-10-07",
      checklist: { total: 0, checked: 0 },
      budgetItems: [],
      tripHrefBase: "/trip/trip-1",
    });
    assert.equal(
      model.areas.find((area) => area.id === "preferences")?.status,
      "needs_attention",
    );
    assert.equal(
      model.areas.find((area) => area.id === "preferences")?.detail,
      "Saved pace needs choosing",
    );
    assert.equal(
      model.actions.some((action) => action.id === "preferences-pace"),
      true,
    );
    assert.equal(
      model.areas.find((area) => area.id === "accommodation")?.status,
      "not_started",
    );
    assert.equal(organiseTone("ready", "optional"), "complete");
    assert.equal(organiseTone("not_started", "optional"), "optional");
    assert.equal(organiseTone("not_started", "needs_attention"), "needs_attention");
    assert.equal(
      tripSetupStatus(
        trip({ start_date: "2026-12-06", end_date: "2026-12-13" }),
      ).status,
      "ready",
    );
  }

  assert.equal(classifyPlannerDay(undefined, parks), "unplanned");
  assert.equal(
    classifyPlannerDay({ am: "flyout", pm: "flyout" }, parks),
    "travel",
  );

  assert.equal(
    plannerDayReadiness({
      kind: "unplanned",
      hasRidePriorities: false,
      hasDayPlan: false,
    }),
    "open",
  );
  assert.equal(
    plannerDayReadiness({
      kind: "rest",
      hasRidePriorities: true,
      hasDayPlan: false,
    }),
    "rest",
  );
  assert.equal(
    plannerDayReadiness({
      kind: "park",
      hasRidePriorities: false,
      hasDayPlan: false,
    }),
    "needs_planning",
  );
  assert.equal(
    plannerDayReadiness({
      kind: "park",
      hasRidePriorities: true,
      hasDayPlan: false,
    }),
    "ready",
  );
  assert.equal(
    plannerDayReadiness({
      kind: "park",
      hasRidePriorities: false,
      hasDayPlan: true,
    }),
    "ready",
  );
  assert.equal(plannerDayReadinessLabel("open"), "Open");
  assert.equal(plannerDayReadinessLabel("rest"), "Rest day");
  assert.notEqual(plannerDayNextStep("open"), plannerDayNextStep("rest"));
  assert.match(plannerDayNextStep("rest"), /free on purpose/);
  assert.match(plannerDayNextStep("open"), /Choose a park/);

  {
    const model = buildTripWorkspaceModel({
      trip: trip({
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        assignments: {
          "2026-11-01": { am: "magic", pm: "magic" },
          "2026-11-02": { am: "rest", pm: "rest" },
        },
      }),
      parkById: parks,
      payments: [],
      todayKey: "2026-10-01",
      checklist: null,
      budgetItems: null,
      tripHrefBase: "/trip/trip-1",
    });
    const parkArea = model.areas.find((area) => area.id === "park_days");
    assert.equal(parkArea?.status, "ready");
    assert.match(parkArea?.detail ?? "", /1 park day/);
    assert.match(parkArea?.detail ?? "", /1 rest/);
    assert.equal(parkArea?.detail.includes("open"), false);
    assert.equal(
      model.actions.some(
        (action) =>
          action.id === "assign-parks" || action.id === "review-open-day",
      ),
      false,
    );
  }

  {
    const model = buildTripWorkspaceModel({
      trip: trip({
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        assignments: {
          "2026-11-01": { am: "rest", pm: "rest" },
        },
      }),
      parkById: parks,
      payments: [],
      todayKey: "2026-10-01",
      checklist: null,
      budgetItems: null,
      tripHrefBase: "/trip/trip-1",
    });
    const openAction = model.actions.find((action) => action.id === "review-open-day");
    assert.ok(openAction);
    assert.equal(openAction?.detail.includes("Every day is still open"), false);
    assert.match(openAction?.detail ?? "", /no park or rest day yet/);
    assert.equal(
      model.actions.some((action) => action.id === "assign-parks"),
      false,
    );
  }
}

run();
console.log("trip-workspace-status.test.ts ok");
