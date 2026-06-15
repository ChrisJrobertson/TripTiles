/**
 * Seed polished public gallery trips (idempotent via fixed public_slug).
 *
 * Usage (repo root, .env.local with Supabase URL + service role key):
 *   node scripts/seed-gallery-trips.mjs
 *
 * Safe to re-run: upserts by public_slug; does not delete user trips.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path, override = false) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    if (override || !process.env[key]) process.env[key] = val;
  }
}

const root = resolve(import.meta.dirname, "..");
loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, ".env.local"), true);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GALLERY_LABEL = "TripTiles verified";

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateRange(start, end) {
  const keys = [];
  let cur = start;
  while (cur <= end) {
    keys.push(cur);
    cur = addDays(cur, 1);
  }
  return keys;
}

/** Build assignments from per-day slot map (park id or "rest"). */
function buildAssignments(start, end, dayPlans) {
  const keys = dateRange(start, end);
  const assignments = {};
  for (let i = 0; i < keys.length; i++) {
    const plan = dayPlans[i] ?? dayPlans[dayPlans.length - 1];
    if (plan === "rest") {
      assignments[keys[i]] = { am: "rest", pm: "rest" };
    } else {
      assignments[keys[i]] = { ...plan };
    }
  }
  return assignments;
}

const SEEDS = [
  {
    public_slug: "gallery-wdw-family-classic",
    adventure_name: "Classic Walt Disney World · 7 days",
    family_name: "The Henderson Family",
    region_id: "orlando",
    destination: "orlando",
    start_date: "2026-07-10",
    end_date: "2026-07-16",
    adults: 2,
    children: 2,
    child_ages: [8, 11],
    clone_count: 18,
    view_count: 142,
    dayPlans: [
      { am: "mk", pm: "mk" },
      { am: "ep", pm: "ep" },
      { am: "hs", pm: "hs" },
      "rest",
      { am: "ak", pm: "ak" },
      { am: "mk", pm: "ds", lunch: "owl" },
      { am: "ep", pm: "ep", dinner: "tsr" },
    ],
    preferences: {
      ai_crowd_summary:
        "Peak July — rope-drop Magic Kingdom and Animal Kingdom; use Lightning Lane on Hollywood Studios headliners.",
    },
  },
  {
    public_slug: "gallery-universal-thrills",
    adventure_name: "Universal Orlando · Thrills & shows",
    family_name: "The Patel Family",
    region_id: "orlando",
    destination: "orlando",
    start_date: "2026-08-05",
    end_date: "2026-08-09",
    adults: 2,
    children: 1,
    child_ages: [10],
    clone_count: 12,
    view_count: 89,
    dayPlans: [
      { am: "ioa", pm: "ioa" },
      { am: "usf", pm: "usf" },
      "rest",
      { am: "eu", pm: "eu" },
      { am: "ioa", pm: "cw", dinner: "tsr" },
    ],
    preferences: {
      ai_crowd_summary:
        "Summer crowds — front-load Islands of Adventure; Express Pass shortens waits on eligible rides.",
    },
  },
  {
    public_slug: "gallery-dubai-parks-week",
    adventure_name: "Dubai theme parks · 6 days",
    family_name: "The Al-Rashid Family",
    region_id: "uae",
    destination: "custom",
    start_date: "2026-10-12",
    end_date: "2026-10-17",
    adults: 2,
    children: 2,
    child_ages: [6, 9],
    clone_count: 9,
    view_count: 67,
    dayPlans: [
      { am: "img", pm: "img" },
      { am: "legodxb", pm: "legodxb" },
      "rest",
      { am: "motgate", pm: "motgate" },
      { am: "aquav", pm: "aquav" },
      { am: "bolly", pm: "bolly" },
    ],
    preferences: {
      ai_crowd_summary:
        "Shoulder season — mornings are cooler; water parks fit mid-trip for a break from dry rides.",
    },
  },
  {
    public_slug: "gallery-florida-combo",
    adventure_name: "Disney + Universal · Florida combo",
    family_name: "The Morrison Family",
    region_id: "florida_combo",
    destination: "custom",
    start_date: "2026-09-01",
    end_date: "2026-09-08",
    adults: 2,
    children: 0,
    child_ages: [],
    clone_count: 15,
    view_count: 118,
    dayPlans: [
      { am: "mk", pm: "mk" },
      { am: "ep", pm: "ep" },
      { am: "hs", pm: "hs" },
      "rest",
      { am: "ioa", pm: "ioa" },
      { am: "usf", pm: "usf" },
      { am: "ak", pm: "eu" },
      { am: "mk", pm: "ds" },
    ],
    preferences: {
      ai_crowd_summary:
        "Two-resort holiday — cluster Disney days then Universal; plan rest before park-hopping intensity.",
    },
  },
  {
    public_slug: "gallery-wdw-relaxed-first-timers",
    adventure_name: "First-timers WDW · Relaxed pace",
    family_name: "The Williams Family",
    region_id: "orlando",
    destination: "orlando",
    start_date: "2026-11-14",
    end_date: "2026-11-21",
    adults: 2,
    children: 1,
    child_ages: [5],
    clone_count: 11,
    view_count: 76,
    dayPlans: [
      { am: "mk", pm: "mk" },
      "rest",
      { am: "ep", pm: "ep" },
      { am: "ak", pm: "ak" },
      "rest",
      { am: "hs", pm: "hs" },
      { am: "bb", pm: "ds" },
      { am: "mk", pm: "ep" },
    ],
    preferences: {
      ai_crowd_summary:
        "November shoulder season — gentler queues; two rest days keep a preschooler happy.",
    },
  },
];

async function resolveOwnerId() {
  const preferred = process.env.GALLERY_SEED_OWNER_EMAIL?.trim().toLowerCase();
  if (preferred) {
    let page = 1;
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      const hit = users.find((u) => (u.email ?? "").toLowerCase() === preferred);
      if (hit) return hit.id;
      if (users.length < 1000) break;
      page += 1;
    }
    throw new Error(`GALLERY_SEED_OWNER_EMAIL not found: ${preferred}`);
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "admin@synqforge.com")
    .maybeSingle();
  if (prof?.id) return String(prof.id);

  const { data: anyProf } = await supabase
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (anyProf?.id) return String(anyProf.id);
  throw new Error("No profile found for gallery seed owner");
}

async function fixExistingPublicTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select("id, public_slug, gallery_owner_label")
    .eq("is_public", true);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (row.gallery_owner_label?.trim()) continue;
    const { error: upErr } = await supabase
      .from("trips")
      .update({
        gallery_owner_label: "Chris",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    console.log(`label fixed: ${row.public_slug ?? row.id}`);
  }
}

async function upsertSeed(ownerId, seed) {
  const { data: existing } = await supabase
    .from("trips")
    .select("id")
    .eq("public_slug", seed.public_slug)
    .maybeSingle();

  const assignments = buildAssignments(
    seed.start_date,
    seed.end_date,
    seed.dayPlans,
  );

  const row = {
    owner_id: ownerId,
    region_id: seed.region_id,
    family_name: seed.family_name,
    adventure_name: seed.adventure_name,
    destination: seed.destination,
    status: "planning",
    start_date: seed.start_date,
    end_date: seed.end_date,
    has_cruise: false,
    assignments,
    preferences: seed.preferences ?? {},
    custom_parks: {},
    notes: null,
    is_public: true,
    public_slug: seed.public_slug,
    gallery_owner_label: GALLERY_LABEL,
    clone_count: seed.clone_count,
    view_count: seed.view_count,
    adults: seed.adults,
    children: seed.children,
    child_ages: seed.child_ages,
    planning_preferences: {
      pace: "balanced",
      mustDoParks: [],
      priorities: [],
      additionalNotes: null,
      adults: seed.adults,
      children: seed.children,
      childAges: seed.child_ages,
      includeDisneySkipTips: true,
      includeUniversalSkipTips: true,
    },
    colour_theme: "classic",
    day_snapshots: [],
    is_archived: false,
    email_reminders: false,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("trips")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error(`${seed.public_slug}: ${error.message}`);
    console.log(`updated: ${seed.public_slug} (${existing.id})`);
    return existing.id;
  }

  const id = randomUUID();
  const { error } = await supabase.from("trips").insert({
    ...row,
    id,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`${seed.public_slug}: ${error.message}`);
  console.log(`created: ${seed.public_slug} (${id})`);
  return id;
}

async function main() {
  const ownerId = await resolveOwnerId();
  console.log(`Gallery seed owner: ${ownerId}`);

  await fixExistingPublicTrips();

  for (const seed of SEEDS) {
    await upsertSeed(ownerId, seed);
  }

  const { count } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true);
  console.log(`Done. Public trips in gallery: ${count ?? "?"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
