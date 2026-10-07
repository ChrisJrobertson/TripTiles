/**
 * Proves the canonical local Supabase baseline:
 * signup creates one profile, profile id equals the auth user id,
 * owners can CRUD their trips, and private trips are isolated.
 *
 * Targets the local CLI stack (supabase status), not .env.local.
 *
 *   npx tsx scripts/verify-canonical-baseline.ts
 */
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function localEnv(): { url: string; anon: string; service: string } {
  const raw = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
  });
  const map = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx);
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  const url = map.get("API_URL");
  const anon = map.get("ANON_KEY") || map.get("PUBLISHABLE_KEY");
  const service = map.get("SERVICE_ROLE_KEY") || map.get("SECRET_KEY");
  if (!url || !anon || !service) {
    throw new Error("supabase status did not return API_URL and keys");
  }
  return { url, anon, service };
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function main(): Promise<void> {
  const { url, anon, service } = localEnv();
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const password = `Canonical-${stamp}-Test`;
  const emails = [
    `canonical-a-${stamp}@example.com`,
    `canonical-b-${stamp}@example.com`,
  ] as const;
  const userIds: string[] = [];

  try {
    for (const email of emails) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`createUser ${email}: ${error?.message ?? "no user"}`);
      }
      userIds.push(data.user.id);
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("id, email, tier")
        .eq("id", data.user.id);
      if (pErr) throw new Error(`profile read: ${pErr.message}`);
      assert(profiles?.length === 1, `expected one profile for ${email}`);
      assert(profiles[0].id === data.user.id, "profile id must equal auth user id");
      assert(profiles[0].tier === "free", `expected free tier, got ${profiles[0].tier}`);
    }

    const clients: SupabaseClient[] = [];
    for (const email of emails) {
      const client = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`signIn ${email}: ${error.message}`);
      clients.push(client);
    }

    const tripIds: string[] = [];
    for (let i = 0; i < clients.length; i++) {
      const { data, error } = await clients[i]
        .from("trips")
        .insert({
          owner_id: userIds[i],
          adventure_name: `Canonical trip ${i + 1}`,
          family_name: "Baseline",
          start_date: "2026-11-01",
          end_date: "2026-11-05",
          is_public: false,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`insert trip ${i}: ${error?.message}`);
      tripIds.push(data.id as string);

      const { error: updErr } = await clients[i]
        .from("trips")
        .update({ family_name: "Baseline Updated" })
        .eq("id", data.id);
      if (updErr) throw new Error(`update trip ${i}: ${updErr.message}`);
    }

    const { data: seenByA, error: aErr } = await clients[0]
      .from("trips")
      .select("id");
    if (aErr) throw new Error(`user A list: ${aErr.message}`);
    const idsA = (seenByA ?? []).map((r) => r.id as string).sort();
    assert(
      idsA.length === 1 && idsA[0] === tripIds[0],
      `user A should see only their trip, saw ${idsA.join(",")}`,
    );

    const { data: seenByB, error: bErr } = await clients[1]
      .from("trips")
      .select("id");
    if (bErr) throw new Error(`user B list: ${bErr.message}`);
    const idsB = (seenByB ?? []).map((r) => r.id as string).sort();
    assert(
      idsB.length === 1 && idsB[0] === tripIds[1],
      `user B should see only their trip, saw ${idsB.join(",")}`,
    );

    const { data: crossData, error: crossErr } = await clients[0]
      .from("trips")
      .update({ family_name: "Hijack" })
      .eq("id", tripIds[1])
      .select("id");
    if (crossErr) throw new Error(`cross update error: ${crossErr.message}`);
    assert((crossData ?? []).length === 0, "cross-user update must not change a row");

    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: anonTrips, error: anonTripErr } = await anonClient
      .from("trips")
      .select("id")
      .eq("is_public", false);
    if (anonTripErr) throw new Error(`anon trips: ${anonTripErr.message}`);
    assert((anonTrips ?? []).length === 0, "anon must not see private trips");

    const { data: anonProfiles, error: anonProfErr } = await anonClient
      .from("profiles")
      .select("id");
    if (anonProfErr && !/permission|RLS|42501/i.test(anonProfErr.message)) {
      throw new Error(`anon profiles: ${anonProfErr.message}`);
    }
    assert(
      anonProfErr != null || (anonProfiles ?? []).length === 0,
      "anon must not read profiles",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          profiles_match_auth_ids: true,
          private_trip_isolation: true,
          anon_private_trips: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
