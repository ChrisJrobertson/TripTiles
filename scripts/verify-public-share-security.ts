/**
 * Proves anonymous clients cannot read private trip fields before publish,
 * while a trip is public, or after it is revoked.
 *
 * Run: node --env-file=.env.local --import tsx scripts/verify-public-share-security.ts
 *
 * Uses the isolated e2e account only. The service role deletes the probe
 * afterwards and is not used as the security evidence.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.TRIPTILES_E2E_B_EMAIL?.trim().toLowerCase();
const password = process.env.TRIPTILES_E2E_B_PASSWORD;

const REAL_CUSTOMERS = new Set([
  "chrisjrobertson@outlook.com",
  "ellie_robertson@icloud.com",
]);

type Outcome = { status: number; rows: number; body: unknown };

export type ShareProbe = {
  owner: SupabaseClient;
  tripId: string;
  slug: string;
  tokens: string[];
};

function fail(message: string): never {
  throw new Error(message);
}

function assertAccount(value: string | undefined): asserts value is string {
  if (!value || REAL_CUSTOMERS.has(value) || !value.startsWith("triptiles-e2e-")) {
    fail("TRIPTILES_E2E_B_EMAIL is not an isolated e2e account");
  }
}

function leaks(body: unknown, tokens: string[]): boolean {
  const text = JSON.stringify(body);
  return tokens.some((token) => text.includes(token));
}

async function rest(path: string, token: string | null): Promise<Outcome> {
  const headers = new Headers();
  headers.set("apikey", anon!);
  headers.set("Authorization", `Bearer ${token ?? anon}`);
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const rows = Array.isArray(body) ? body.length : 0;
  return { status: response.status, rows, body };
}

function assertHidden(outcome: Outcome, tokens: string[], label: string) {
  if (leaks(outcome.body, tokens)) {
    fail(`${label}: anonymous response contained private data`);
  }
  const denied = outcome.status === 401 || outcome.status === 403;
  const empty = outcome.status === 200 && outcome.rows === 0;
  if (!denied && !empty) {
    fail(`${label}: anonymous read returned HTTP ${outcome.status} with ${outcome.rows} rows`);
  }
}

export async function createShareProbe(): Promise<ShareProbe> {
  assertAccount(email);
  if (!url || !anon || !serviceKey || !password) {
    fail("Missing Supabase or e2e credentials");
  }

  const owner = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await owner.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) fail(`Sign-in failed for the e2e account: ${signInError.message}`);
  const userId = (await owner.auth.getUser()).data.user?.id;
  if (!userId) fail("E2E session has no user id");

  const { data: attraction, error: attractionError } = await owner
    .from("attractions")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (attractionError || !attraction?.id) {
    fail("Could not read a catalogue attraction for the probe");
  }

  const stamp = Date.now();
  const note = `E2E_PRIVATE_NOTE_${stamp}`;
  const dayNote = `E2E_DAY_NOTE_${stamp}`;
  const family = `E2E_FAMILY_${stamp}`;
  const payment = `E2E_PAYMENT_${stamp}`;
  const rideNote = `E2E_RIDE_NOTE_${stamp}`;
  const budgetNote = `E2E_BUDGET_${stamp}`;
  const slug = `e2e-share-${stamp}`;
  const tokens = [note, dayNote, family, payment, rideNote, budgetNote, "secret-parent@example.com"];

  const { data: trip, error: tripError } = await owner
    .from("trips")
    .insert({
      owner_id: userId,
      start_date: "2099-08-01",
      end_date: "2099-08-03",
      adventure_name: "E2E share probe",
      family_name: family,
      region_id: "orlando",
      destination: "orlando",
      adults: 2,
      children: 1,
      child_ages: [13],
      notes: note,
      is_public: false,
      public_slug: null,
      assignments: { "2099-08-01": { am: "mk" } },
      preferences: {
        day_notes: { "2099-08-01": dayNote },
        public_view: {
          adventure_title: "E2E Public Title",
          family_label: "E2E Public Group",
        },
        ai_crowd_summary: "Rope drop at Magic Kingdom.",
        contact_email: "secret-parent@example.com",
      },
    })
    .select("id")
    .single();
  if (tripError || !trip?.id) fail(`Probe trip insert failed: ${tripError?.message ?? "no id"}`);

  const tripId = String(trip.id);
  const { error: paymentError } = await owner.from("trip_payments").insert({
    trip_id: tripId,
    label: payment,
    amount_pence: 2500,
    currency: "GBP",
  });
  if (paymentError) fail(`Probe payment insert failed: ${paymentError.message}`);

  const { error: rideError } = await owner.from("trip_ride_priorities").insert({
    trip_id: tripId,
    attraction_id: attraction.id,
    day_date: "2099-08-01",
    priority: "must_do",
    notes: rideNote,
  });
  if (rideError) fail(`Probe ride insert failed: ${rideError.message}`);

  const { error: budgetError } = await owner.from("trip_budget_items").insert({
    trip_id: tripId,
    category: "tickets",
    label: "Park tickets",
    amount: 199,
    currency: "GBP",
    notes: budgetNote,
  });
  if (budgetError) fail(`Probe budget insert failed: ${budgetError.message}`);

  return { owner, tripId, slug, tokens };
}

export async function publishShareProbe(probe: ShareProbe) {
  const { error } = await probe.owner
    .from("trips")
    .update({ is_public: true, public_slug: probe.slug })
    .eq("id", probe.tripId);
  if (error) fail(`Publish failed: ${error.message}`);
}

export async function revokeShareProbe(probe: ShareProbe) {
  const { error } = await probe.owner
    .from("trips")
    .update({ is_public: false, public_slug: null })
    .eq("id", probe.tripId);
  if (error) fail(`Revoke failed: ${error.message}`);
}

export async function assertAnonymousShareHidden(probe: ShareProbe, phase: string) {
  const id = encodeURIComponent(probe.tripId);
  const slug = encodeURIComponent(probe.slug);
  const checks: Array<[string, string]> = [
    [`trips?id=eq.${id}&select=id,notes,child_ages,family_name,owner_id,preferences,adults,children`, "trip by id"],
    [`trips?public_slug=eq.${slug}&select=id,notes,child_ages,preferences`, "trip by slug"],
    [`trips?is_public=eq.true&select=id,notes,child_ages&limit=100`, "public trip list"],
    [`trip_payments?trip_id=eq.${id}&select=label,amount_pence`, "payments"],
    [`trip_ride_priorities?trip_id=eq.${id}&select=notes,attraction_id`, "ride priorities"],
    [`trip_budget_items?trip_id=eq.${id}&select=notes,label,amount`, "budget items"],
    ["profiles?select=id,email&limit=1", "profiles"],
    ["purchases?select=id&limit=1", "purchases"],
    ["stripe_webhook_events?select=id&limit=1", "stripe webhook events"],
  ];
  for (const [path, label] of checks) {
    assertHidden(await rest(path, null), probe.tokens, `${phase} / ${label}`);
  }

  const missing = await rest(
    "trips?public_slug=eq.not-a-published-e2e-slug&select=id,notes",
    null,
  );
  assertHidden(missing, probe.tokens, `${phase} / invalid slug`);

  const listed = await rest("trips?is_public=eq.true&select=id&limit=100", null);
  if (leaks(listed.body, [probe.tripId])) {
    fail(`${phase}: anonymous client enumerated the probe trip id`);
  }
}

export async function assertOwnerRetainsPrivateTrip(probe: ShareProbe) {
  const { data, error } = await probe.owner
    .from("trips")
    .select("id, notes, child_ages, is_public")
    .eq("id", probe.tripId)
    .maybeSingle();
  if (error || !data) fail("Owner could not read the trip after sharing changes");
  const row = data as { notes?: string; child_ages?: number[]; is_public?: boolean };
  if (row.notes !== probe.tokens[0] || !row.child_ages?.includes(13)) {
    fail("Owner read did not return the private trip fields");
  }
  if (row.is_public !== false) fail("Trip was still public after revoke");
}

export async function deleteShareProbe(probe: ShareProbe) {
  if (!url || !serviceKey) return;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("trip_payments").delete().eq("trip_id", probe.tripId);
  await admin.from("trip_ride_priorities").delete().eq("trip_id", probe.tripId);
  await admin.from("trip_budget_items").delete().eq("trip_id", probe.tripId);
  await admin.from("trips").delete().eq("id", probe.tripId);
}

async function main() {
  const probe = await createShareProbe();
  try {
    await assertAnonymousShareHidden(probe, "private");
    await publishShareProbe(probe);
    await assertAnonymousShareHidden(probe, "published");
    await revokeShareProbe(probe);
    await assertAnonymousShareHidden(probe, "revoked");
    await assertOwnerRetainsPrivateTrip(probe);
    console.log("public-share-security: anonymous access denied; owner access retained");
  } finally {
    await deleteShareProbe(probe);
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("verify-public-share-security.ts")) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Public share security check failed";
    console.error(message);
    process.exit(1);
  });
}
