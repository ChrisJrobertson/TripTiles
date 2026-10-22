/**
 * Export and delete a disposable e2e account. Does not touch real customers
 * or the persistent returning-customer account.
 *
 * Run:
 *   TRIPTILES_ALLOW_AUTH_TEST=1 node --env-file=.env.local --import tsx scripts/verify-account-lifecycle.ts
 */
import { createClient } from "@supabase/supabase-js";
import { assertAuthTestHarnessAllowed } from "../src/lib/auth/test-session-guard";

const REAL_CUSTOMERS = new Set([
  "chrisjrobertson@outlook.com",
  "ellie_robertson@icloud.com",
]);

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  assertAuthTestHarnessAllowed(process.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anon || !serviceKey) fail("Missing Supabase credentials");

  const stamp = Date.now().toString(36);
  const email = `triptiles-e2e-delete-${stamp}@example.com`;
  if (REAL_CUSTOMERS.has(email) || !email.startsWith("triptiles-e2e-delete-")) {
    fail("Refusing to create an account outside the disposable namespace");
  }
  const password = `E2e-${crypto.randomUUID()}`;
  const note = `E2E_DELETE_NOTE_${stamp}`;
  const tileName = `E2E tile ${stamp.slice(0, 6)}`;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    fail(`Could not create the disposable account: ${createError?.message ?? "no user"}`);
  }
  const userId = created.user.id;

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) fail(`Profile lookup failed: ${profileError.message}`);
    if (!profile?.id) {
      const { error: insertProfileError } = await admin.from("profiles").insert({
        id: userId,
        email,
        tier: "free",
        referral_code: crypto.randomUUID().replaceAll("-", ""),
        temperature_unit: "c",
        email_marketing_opt_out: false,
      });
      if (insertProfileError) fail(`Profile insert failed: ${insertProfileError.message}`);
    }

    const user = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await user.auth.signInWithPassword({ email, password });
    if (signInError) fail(`Disposable sign-in failed: ${signInError.message}`);

    const { data: trip, error: tripError } = await user
      .from("trips")
      .insert({
        owner_id: userId,
        start_date: "2099-09-01",
        end_date: "2099-09-02",
        adventure_name: "E2E delete probe",
        family_name: "E2E delete",
        region_id: "orlando",
        destination: "orlando",
        adults: 2,
        children: 0,
        child_ages: [],
        notes: note,
        is_public: false,
      })
      .select("id")
      .single();
    if (tripError || !trip?.id) fail(`Probe trip insert failed: ${tripError?.message ?? "no id"}`);

    const tileId = `ct_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const { error: tileError } = await user.from("custom_tiles").insert({
      id: tileId,
      user_id: userId,
      name: tileName,
      park_group: "disney",
      bg_colour: "#0B1E5C",
      fg_colour: "#C9A961",
      region_ids: ["orlando"],
    });
    if (tileError) fail(`Probe tile insert failed: ${tileError.message}`);

    const [{ data: exportedTrips, error: exportTripError }, { data: exportedTiles, error: exportTileError }] =
      await Promise.all([
        user.from("trips").select("id, notes").eq("owner_id", userId),
        user.from("custom_tiles").select("id, name").eq("user_id", userId),
      ]);
    if (exportTripError || exportTileError) fail("Account export queries failed");
    const tripRow = (exportedTrips ?? []).find((row) => row.id === trip.id);
    const tileRow = (exportedTiles ?? []).find((row) => row.id === tileId);
    if (!tripRow || tripRow.notes !== note || !tileRow || tileRow.name !== tileName) {
      fail("Export did not return the disposable trip and custom tile");
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) fail(`Account deletion failed: ${deleteError.message}`);

    const { data: tripLeft } = await admin.from("trips").select("id").eq("id", trip.id).maybeSingle();
    const { data: tileLeft } = await admin.from("custom_tiles").select("id").eq("id", tileId).maybeSingle();
    const { data: profileLeft } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (tripLeft || tileLeft || profileLeft) {
      fail("Private records remained after account deletion");
    }

    const anonResponse = await fetch(
      `${url}/rest/v1/trips?id=eq.${encodeURIComponent(String(trip.id))}&select=notes`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
    );
    const anonBody = await anonResponse.text();
    if (anonBody.includes(note)) fail("Anonymous client could read the deleted trip");

    const { error: signInAfter } = await user.auth.signInWithPassword({ email, password });
    if (!signInAfter) fail("Deleted account could still sign in");

    console.log("account-lifecycle: export returned the probe records; deletion removed them");
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Account lifecycle check failed");
  process.exit(1);
});
