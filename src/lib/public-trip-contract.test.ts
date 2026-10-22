/**
 * Run: npx tsx src/lib/public-trip-contract.test.ts
 */
import assert from "node:assert/strict";
import { PUBLIC_TRIP_COLUMNS, toPublicTrip } from "./public-trip-contract";

const NOTE = "E2E_PRIVATE_NOTE_TOKEN";
const DAY_NOTE = "E2E_DAY_NOTE_TOKEN";
const FAMILY = "E2E_FAMILY_TOKEN";
const EMAIL = "secret-parent@example.com";
const PAYMENT = "E2E_PAYMENT_TOKEN";
const OWNER = "415a7743-8a2b-4e17-9047-5bb8b2e87bc6";

function run() {
  const denied = [
    "notes",
    "child_ages",
    "adults",
    "children",
    "family_name",
    "owner_id",
    "agency_id",
    "planning_preferences",
    "budget_target",
    "budget_currency",
    "email_reminders",
    "custom_parks",
    "cruise_line",
    "ship_name",
    "day_snapshots",
    "previous_preferences_snapshot",
  ];
  for (const column of denied) {
    assert.equal(
      PUBLIC_TRIP_COLUMNS.split(",").includes(column),
      false,
      `${column} must not be in the public column list`,
    );
  }

  const trip = toPublicTrip({
    id: "95a460d1-c204-409b-880b-3b092d47cec8",
    owner_id: OWNER,
    agency_id: OWNER,
    family_name: FAMILY,
    adventure_name: "Orlando public",
    destination: "orlando",
    region_id: "orlando",
    start_date: "2026-12-06",
    end_date: "2026-12-13",
    has_cruise: false,
    assignments: {
      "2026-12-06": {
        am: "mk",
        pm: { parkId: "eu", time: "14:30", note: NOTE },
        lunch: { parkId: "mk", surprise: EMAIL },
      },
      "not-a-date": { am: "mk" },
    },
    preferences: {
      day_notes: { "2026-12-06": DAY_NOTE },
      public_view: {
        adventure_title: "Published title",
        family_label: "The travellers",
        email: EMAIL,
      },
      ai_crowd_summary: "Arrive at rope drop.",
      ai_day_crowd_notes: { "2026-12-06": "Morning is quieter." },
      must_dos: { "2026-12-06": { mk: [{ why: NOTE }] } },
      contact_email: EMAIL,
      adventure_title_color: "#2455ac",
    },
    notes: NOTE,
    child_ages: [4, 9],
    adults: 2,
    children: 2,
    planning_preferences: { additionalNotes: NOTE },
    budget_target: 424242,
    budget_currency: "USD",
    colour_theme: "ocean",
    is_public: true,
    public_slug: "orlando-public-95a460",
    clone_count: 3,
    view_count: 8,
    gallery_owner_label: "Alex R",
    cruise_line: "Private Line",
    ship_name: "Private Ship",
    email_reminders: true,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-02T00:00:00.000Z",
    last_opened_at: "2026-10-03T00:00:00.000Z",
  });

  const serialised = JSON.stringify(trip);
  for (const secret of [NOTE, DAY_NOTE, FAMILY, EMAIL, PAYMENT, OWNER, "424242", "Private Line"]) {
    assert.equal(serialised.includes(secret), false, `public trip leaked ${secret}`);
  }

  assert.equal(trip.adventure_name, "Orlando public");
  assert.equal(trip.destination, "orlando");
  assert.equal(trip.region_id, "orlando");
  assert.equal(trip.start_date, "2026-12-06");
  assert.equal(trip.end_date, "2026-12-13");
  assert.equal(trip.assignments["2026-12-06"]?.am, "mk");
  assert.deepEqual(trip.assignments["2026-12-06"]?.pm, { parkId: "eu", time: "14:30" });
  assert.equal(trip.notes, null);
  assert.deepEqual(trip.child_ages, []);
  assert.equal(trip.adults, 0);
  assert.equal(trip.children, 0);
  assert.equal(trip.owner_id, "");
  assert.equal(trip.family_name, "");
  assert.equal(trip.planning_preferences, null);
  assert.equal(trip.budget_target, null);
  assert.equal(trip.preferences.public_view && (trip.preferences.public_view as { adventure_title: string }).adventure_title, "Published title");
  assert.equal(trip.preferences.ai_crowd_summary, "Arrive at rope drop");
  assert.equal(trip.gallery_owner_label, "Alex R");
  assert.equal(trip.colour_theme, "ocean");
  assert.equal("day_notes" in trip.preferences, false);
  assert.equal("must_dos" in trip.preferences, false);
  assert.equal("contact_email" in trip.preferences, false);

  console.log("public-trip-contract.test.ts: ok");
}

run();
