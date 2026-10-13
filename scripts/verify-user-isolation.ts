/**
 * Two-user isolation against the linked project.
 * Reads the existing private trips. Writes only a disposable probe row, then deletes it.
 * Run: node --env-file=.env.local --import tsx scripts/verify-user-isolation.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const chrisPassword = process.env.TEST_CHRIS_PASSWORD;
const elliePassword = process.env.TEST_ELLIE_PASSWORD;

const CHRIS = "chrisjrobertson@outlook.com";
const ELLIE = "ellie_robertson@icloud.com";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) fail(`sign-in failed for ${email}: ${error?.message ?? "no user"}`);
  return client;
}

async function ownTripIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from("trips").select("id");
  if (error) fail(`own trip list failed: ${error.message}`);
  return (data ?? []).map((row) => row.id as string);
}

async function canRead(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from("trips").select("id").eq("id", id).maybeSingle();
  if (error) fail(`read failed: ${error.message}`);
  return Boolean(data?.id);
}

async function main(): Promise<void> {
  if (!url || !anon || !serviceKey || !chrisPassword || !elliePassword) {
    fail("Missing Supabase URL, anon key, service role key, or test passwords.");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const chris = await signIn(CHRIS, chrisPassword);
  const ellie = await signIn(ELLIE, elliePassword);
  const chrisUser = (await chris.auth.getUser()).data.user;
  const ellieUser = (await ellie.auth.getUser()).data.user;
  if (!chrisUser || !ellieUser) fail("Signed-in user id missing.");
  if (chrisUser.id === ellieUser.id) fail("Both sessions resolved to the same user.");

  const chrisIds = await ownTripIds(chris);
  const ellieIds = await ownTripIds(ellie);
  const overlap = chrisIds.filter((id) => ellieIds.includes(id));
  if (overlap.length > 0) fail(`Trip lists overlap: ${overlap.join(",")}`);
  if (chrisIds.length === 0 || ellieIds.length === 0) {
    fail(`Expected both users to have private trips. Counts: ${chrisIds.length}, ${ellieIds.length}`);
  }

  for (const id of ellieIds) {
    if (await canRead(chris, id)) fail("Chris can read an Ellie trip.");
  }
  for (const id of chrisIds) {
    if (await canRead(ellie, id)) fail("Ellie can read a Chris trip.");
  }

  const probeName = `RLS isolation probe ${Date.now()}`;
  const { data: inserted, error: insertError } = await admin
    .from("trips")
    .insert({
      owner_id: chrisUser.id,
      start_date: "2099-01-06",
      end_date: "2099-01-07",
      adventure_name: probeName,
      region_id: "orlando",
    })
    .select("id")
    .single();
  if (insertError || !inserted?.id) fail(`Probe insert failed: ${insertError?.message ?? "no id"}`);
  const probeId = inserted.id as string;

  try {
    if (!(await canRead(chris, probeId))) fail("Owner cannot read the probe trip.");
    if (await canRead(ellie, probeId)) fail("Ellie can read Chris's probe trip.");

    const { data: ellieUpdate } = await ellie
      .from("trips")
      .update({ adventure_name: "should-not-stick" })
      .eq("id", probeId)
      .select("id");
    if ((ellieUpdate ?? []).length > 0) fail("Ellie update returned a row.");

    const { data: afterUpdate } = await admin
      .from("trips")
      .select("adventure_name")
      .eq("id", probeId)
      .single();
    if (afterUpdate?.adventure_name !== probeName) {
      fail("Ellie update changed the probe trip.");
    }

    const { data: ellieDelete } = await ellie.from("trips").delete().eq("id", probeId).select("id");
    if ((ellieDelete ?? []).length > 0) fail("Ellie delete returned a row.");
    if (!(await canRead(chris, probeId))) fail("Ellie delete removed Chris's probe trip.");

    const renamed = `${probeName} renamed`;
    const { data: ownerUpdate, error: ownerUpdateError } = await chris
      .from("trips")
      .update({ adventure_name: renamed })
      .eq("id", probeId)
      .select("adventure_name")
      .single();
    if (ownerUpdateError || ownerUpdate?.adventure_name !== renamed) {
      fail(`Owner update failed: ${ownerUpdateError?.message ?? "name unchanged"}`);
    }

    const { error: ownerDeleteError } = await chris.from("trips").delete().eq("id", probeId);
    if (ownerDeleteError) fail(`Owner delete failed: ${ownerDeleteError.message}`);
    const { data: gone } = await admin.from("trips").select("id").eq("id", probeId).maybeSingle();
    if (gone?.id) fail("Owner delete left the probe trip in place.");

    console.log(
      JSON.stringify({
        ok: true,
        chrisTrips: chrisIds.length,
        ellieTrips: ellieIds.length,
        crossRead: "denied",
        crossUpdate: "denied",
        crossDelete: "denied",
        ownerUpdate: "probe-only",
        ownerDelete: "probe-only",
      }),
    );
  } finally {
    await admin.from("trips").delete().eq("id", probeId);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "isolation check failed";
  fail(message);
});
