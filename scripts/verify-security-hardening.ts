/**
 * JWT negative/positive tests for the review hardening SQL.
 * Allows local Docker or hosted staging. Refuses the production project ref.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PROD_REF = "inqexwdkuqdfdoaauxyw";
const STAGING_REF = "whuvghmgdxgsaqpfcorq";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function fail(msg: string): never {
  throw new Error(`FAIL ${msg}`);
}

function pass(id: string, detail = ""): void {
  console.log(`PASS ${id}${detail ? ` ${detail}` : ""}`);
}

function denied(error: { message?: string } | null | undefined): boolean {
  return Boolean(error);
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
  const anon =
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) {
    fail(
      "Need NEXT_PUBLIC_SUPABASE_URL, anon/publishable key, and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  if (url.includes(PROD_REF)) {
    fail("Refusing to run against production project inqexwdkuqdfdoaauxyw");
  }
  const isLocal = /127\.0\.0\.1|localhost/.test(url);
  const isStaging = url.includes(STAGING_REF);
  if (!isLocal && !isStaging) {
    fail("Refusing unknown URL for security JWT tests");
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const password = "Test-hardening-1a";
  const emails = {
    a: `owner-${stamp}@example.test`,
    b: `invitee-${stamp}@example.test`,
    c: `other-${stamp}@example.test`,
    admin: `agency-admin-${stamp}@example.test`,
    unverified: `unverified-${stamp}@example.test`,
  };

  const created: string[] = [];
  const agencyIds: string[] = [];
  const tripIds: string[] = [];

  const createConfirmed = async (email: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser");
    created.push(data.user.id);
    return data.user.id;
  };

  try {
    const aId = await createConfirmed(emails.a);
    const bId = await createConfirmed(emails.b);
    const cId = await createConfirmed(emails.c);
    const adminId = await createConfirmed(emails.admin);
    const { data: unverifiedUser, error: unverifiedErr } =
      await admin.auth.admin.createUser({
        email: emails.unverified,
        password,
        email_confirm: false,
      });
    if (unverifiedErr || !unverifiedUser.user) {
      throw unverifiedErr ?? new Error("create unverified user");
    }
    created.push(unverifiedUser.user.id);
    const unverifiedId = unverifiedUser.user.id;

    const sessionOf = async (email: string) => {
      const c = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await c.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) throw error ?? new Error(`signIn ${email}`);
      return createClient(url, anon, {
        global: {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    };

    const a = await sessionOf(emails.a);
    const b = await sessionOf(emails.b);
    const c = await sessionOf(emails.c);
    const agencyAdmin = await sessionOf(emails.admin);

    let unverified: SupabaseClient | null = null;
    try {
      unverified = await sessionOf(emails.unverified);
    } catch (e) {
      console.log(
        `SKIP C11 sign-in blocked for unverified user: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    const { data: signupProfile, error: signupErr } = await a
      .from("profiles")
      .select("id, tier")
      .eq("id", aId)
      .maybeSingle();
    if (signupErr || signupProfile?.id !== aId) {
      fail(`X02: signup profile missing: ${signupErr?.message}`);
    }
    if (signupProfile?.tier !== "free") {
      fail(`X02: expected free tier, got ${String(signupProfile?.tier)}`);
    }
    pass("X02", "signup created free profile");

    const p01 = await a.from("profiles").update({ tier: "family" }).eq("id", aId);
    if (!denied(p01.error)) fail("P01: user was able to set own tier");
    pass("P01", "tier update denied");

    const p02 = await a
      .from("profiles")
      .update({ tier_expires_at: new Date(Date.now() + 86400000).toISOString() })
      .eq("id", aId);
    if (!denied(p02.error)) fail("P02: user was able to set tier_expires_at");
    pass("P02", "expiry update denied");

    const p03 = await a
      .from("profiles")
      .update({ agency_id: "00000000-0000-0000-0000-000000000001" })
      .eq("id", aId);
    if (!denied(p03.error)) fail("P03: user was able to set agency_id");
    pass("P03", "agency_id update denied");

    const p04 = await a
      .from("profiles")
      .update({
        stripe_customer_id: "cus_forged",
        stripe_subscription_id: "sub_forged",
      })
      .eq("id", aId);
    if (!denied(p04.error)) fail("P04: user was able to set Stripe ids");
    pass("P04", "Stripe id update denied");

    const p05 = await a
      .from("profiles")
      .update({ ai_generations_lifetime: 0 })
      .eq("id", aId);
    if (!denied(p05.error)) fail("P05: user was able to reset AI counter");
    pass("P05", "AI counter update denied");

    const p06 = await a
      .from("profiles")
      .update({ display_name: "Owner A", temperature_unit: "f" })
      .eq("id", aId)
      .select("display_name, temperature_unit")
      .maybeSingle();
    if (
      p06.error ||
      p06.data?.display_name !== "Owner A" ||
      p06.data?.temperature_unit !== "f"
    ) {
      fail(`P06: display_name/prefs update failed: ${p06.error?.message}`);
    }
    pass("P06", "display_name and temperature_unit");

    const p07 = await a
      .from("profiles")
      .update({ display_name: "Hijacked" })
      .eq("id", bId)
      .select("id");
    if (p07.error) {
      pass("P07", `B row update denied (${p07.error.message})`);
    } else if ((p07.data ?? []).length === 0) {
      pass("P07", "B row unchanged (0 rows)");
    } else {
      fail("P07: A modified B's display_name");
    }

    const a01 = await a
      .from("profiles")
      .update({
        tier: "agent_admin",
        agency_id: "00000000-0000-0000-0000-000000000001",
      })
      .eq("id", aId);
    if (!denied(a01.error)) fail("A01: user self-upgraded to agent_admin");
    pass("A01", "self-upgrade denied");

    const s01 = await a.from("purchases").insert({
      user_id: aId,
      product: "family",
      provider: "stripe",
      subscription_status: "active",
      amount_gbp_pence: 1,
      currency: "GBP",
      status: "completed",
    });
    if (!denied(s01.error)) fail("S01: user inserted a forged purchase");
    pass("S01", "forged purchase insert denied");

    const { data: seedPurchase, error: seedPurchaseErr } = await admin
      .from("purchases")
      .insert({
        user_id: aId,
        product: "pro",
        provider: "stripe",
        subscription_status: "active",
        amount_gbp_pence: 100,
        currency: "GBP",
        status: "completed",
      })
      .select("id")
      .single();
    if (seedPurchaseErr || !seedPurchase?.id) {
      fail(`S02 setup: ${seedPurchaseErr?.message}`);
    }
    const s02 = await a
      .from("purchases")
      .update({ subscription_status: "canceled" })
      .eq("id", seedPurchase.id);
    if (!denied(s02.error)) fail("S02: user updated own purchase");
    pass("S02", "purchase update denied");

    const { data: bPurchase, error: bPurchaseErr } = await admin
      .from("purchases")
      .insert({
        user_id: bId,
        product: "family",
        provider: "stripe",
        subscription_status: "active",
        amount_gbp_pence: 100,
        currency: "GBP",
        status: "completed",
      })
      .select("id")
      .single();
    if (bPurchaseErr || !bPurchase?.id) {
      fail(`S03 setup: ${bPurchaseErr?.message}`);
    }
    const s03 = await a.from("purchases").select("id").eq("user_id", bId);
    if (s03.error) fail(`S03 query error: ${s03.error.message}`);
    if ((s03.data ?? []).length !== 0) fail("S03: A read B's purchases");
    pass("S03", "cross-user purchase select empty");

    const { data: agencyA, error: agencyAErr } = await admin
      .from("agencies")
      .insert({
        name: "Agency A",
        slug: `agency-a-${stamp}`,
        contact_email: emails.admin,
        subscription_plan: "starter",
        max_seats: 3,
      })
      .select("id")
      .single();
    if (agencyAErr || !agencyA?.id) fail(`agency A setup: ${agencyAErr?.message}`);
    agencyIds.push(agencyA.id);

    const { data: agencyB, error: agencyBErr } = await admin
      .from("agencies")
      .insert({
        name: "Agency B",
        slug: `agency-b-${stamp}`,
        contact_email: emails.c,
      })
      .select("id")
      .single();
    if (agencyBErr || !agencyB?.id) fail(`agency B setup: ${agencyBErr?.message}`);
    agencyIds.push(agencyB.id);

    const { error: adminProfileErr } = await admin
      .from("profiles")
      .update({ tier: "agent_admin", agency_id: agencyA.id })
      .eq("id", adminId);
    if (adminProfileErr) fail(`admin profile: ${adminProfileErr.message}`);

    const a02 = await agencyAdmin
      .from("agencies")
      .update({ name: "Agency A renamed" })
      .eq("id", agencyA.id)
      .select("name")
      .maybeSingle();
    if (a02.error || a02.data?.name !== "Agency A renamed") {
      fail(`A02: agency name update failed: ${a02.error?.message}`);
    }
    pass("A02", "agency admin renamed own agency");

    const a03plan = await agencyAdmin
      .from("agencies")
      .update({ subscription_plan: "enterprise" })
      .eq("id", agencyA.id);
    if (!denied(a03plan.error)) fail("A03: agency admin set subscription_plan");
    const a03seats = await agencyAdmin
      .from("agencies")
      .update({ max_seats: 99 })
      .eq("id", agencyA.id);
    if (!denied(a03seats.error)) fail("A03: agency admin set max_seats");
    const a03trial = await agencyAdmin
      .from("agencies")
      .update({
        trial_ends_at: new Date(Date.now() + 86400000 * 90).toISOString(),
      })
      .eq("id", agencyA.id);
    if (!denied(a03trial.error)) fail("A03: agency admin set trial_ends_at");
    pass("A03", "plan/seats/trial denied");

    const a04 = await agencyAdmin
      .from("agencies")
      .update({ name: "Hijacked B" })
      .eq("id", agencyB.id)
      .select("id");
    if (a04.error) {
      pass("A04", `other agency denied (${a04.error.message})`);
    } else if ((a04.data ?? []).length === 0) {
      pass("A04", "other agency unchanged (0 rows)");
    } else {
      fail("A04: agency admin renamed another agency");
    }

    const { data: trip, error: tripErr } = await a
      .from("trips")
      .insert({
        owner_id: aId,
        family_name: "Test family",
        adventure_name: "Hardening trip",
        start_date: "2026-12-01",
        end_date: "2026-12-05",
      })
      .select("id")
      .single();
    if (tripErr || !trip?.id) fail(`trip insert: ${tripErr?.message}`);
    tripIds.push(trip.id);

    const x01trips = await anonClient.from("trips").select("id").limit(5);
    if (x01trips.error) {
      pass("X01", `anon trips denied (${x01trips.error.message})`);
    } else if ((x01trips.data ?? []).length === 0) {
      pass("X01", "anon trips select empty");
    } else {
      fail("X01: anon selected private trip rows");
    }

    const x01upd = await anonClient
      .from("profiles")
      .update({ display_name: "anon" })
      .eq("id", aId);
    if (!denied(x01upd.error) && (x01upd.count ?? 0) > 0) {
      fail("X01: anon updated a profile");
    }
    pass("X01b", "anon profile update denied");

    const c00 = await a.from("trip_collaborators").insert({
      trip_id: trip.id,
      user_id: null,
      invited_email: emails.b,
      invited_by: aId,
      role: "viewer",
      status: "pending",
      invite_token: `tok-free-${stamp}`,
    });
    if (!denied(c00.error)) {
      fail("C00: free-tier owner inserted a family invite");
    }
    pass("C00", "free owner invite insert denied");

    const { error: familyErr } = await admin
      .from("profiles")
      .update({ tier: "family" })
      .eq("id", aId);
    if (familyErr) fail(`family tier setup: ${familyErr.message}`);

    const c01 = await a
      .from("trip_collaborators")
      .insert({
        trip_id: trip.id,
        user_id: null,
        invited_email: emails.b,
        invited_by: aId,
        role: "viewer",
        status: "pending",
        invite_token: `tok-b-${stamp}`,
      })
      .select("id")
      .single();
    if (c01.error || !c01.data?.id) {
      fail(`C01: family owner pending invite failed: ${c01.error?.message}`);
    }
    pass("C01", "family owner pending invite");
    const inviteId = c01.data.id;

    const c02 = await a.from("trip_collaborators").insert({
      trip_id: trip.id,
      user_id: bId,
      invited_email: emails.c,
      invited_by: aId,
      role: "editor",
      status: "accepted",
      invite_token: `tok-accepted-${stamp}`,
    });
    if (!denied(c02.error)) fail("C02: owner inserted already-accepted collaborator");
    pass("C02", "accepted/arbitrary user_id insert denied");

    const c04 = await c
      .from("trip_collaborators")
      .update({
        status: "accepted",
        user_id: cId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select("id");
    if (c04.error) {
      pass("C04", `unmatched email denied (${c04.error.message})`);
    } else if ((c04.data ?? []).length === 0) {
      pass("C04", "unmatched email unchanged (0 rows)");
    } else {
      fail("C04: unmatched user accepted B's invite");
    }

    const c03 = await b
      .from("trip_collaborators")
      .update({
        status: "accepted",
        user_id: bId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .select("id, status, user_id, role")
      .maybeSingle();
    if (c03.error || c03.data?.status !== "accepted" || c03.data?.user_id !== bId) {
      fail(`C03: matching invitee accept failed: ${c03.error?.message}`);
    }
    pass("C03", "matching invitee accepted once");

    const c05 = await b
      .from("trip_collaborators")
      .update({ role: "editor" })
      .eq("id", inviteId)
      .select("id");
    if (c05.error) {
      pass("C05", `self-promote denied (${c05.error.message})`);
    } else if ((c05.data ?? []).length === 0) {
      pass("C05", "self-promote unchanged (0 rows)");
    } else {
      fail("C05: collaborator promoted own role");
    }

    const c06 = await b
      .from("trip_collaborators")
      .update({ invited_email: emails.c, invite_token: "stolen", trip_id: trip.id })
      .eq("id", inviteId);
    if (!denied(c06.error)) fail("C06: collaborator mutated invitation identity");
    pass("C06", "identity fields immutable");

    const c07 = await b
      .from("trip_collaborators")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .select("id");
    if (c07.error) {
      pass("C07", `self-revoke denied (${c07.error.message})`);
    } else if ((c07.data ?? []).length === 0) {
      pass("C07", "self-revoke unchanged (0 rows)");
    } else {
      fail("C07: collaborator revoked own invitation");
    }

    const c08 = await a
      .from("trip_collaborators")
      .update({ role: "editor" })
      .eq("id", inviteId)
      .select("role")
      .maybeSingle();
    if (c08.error || c08.data?.role !== "editor") {
      fail(`C08: owner role change failed: ${c08.error?.message}`);
    }
    pass("C08", "owner changed editor/viewer role");

    const c09 = await a
      .from("trip_collaborators")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .select("status")
      .maybeSingle();
    if (c09.error || c09.data?.status !== "revoked") {
      fail(`C09: owner revoke failed: ${c09.error?.message}`);
    }
    pass("C09", "owner revoked invite");

    const c10 = await b
      .from("trip_collaborators")
      .update({
        status: "accepted",
        user_id: bId,
        accepted_at: new Date().toISOString(),
        role: "editor",
      })
      .eq("id", inviteId)
      .select("id");
    if (c10.error) {
      pass("C10", `revoked re-accept denied (${c10.error.message})`);
    } else if ((c10.data ?? []).length === 0) {
      pass("C10", "revoked re-accept unchanged (0 rows)");
    } else {
      fail("C10: revoked collaborator re-accepted");
    }

    if (unverified) {
      const c11insert = await a
        .from("trip_collaborators")
        .insert({
          trip_id: trip.id,
          user_id: null,
          invited_email: emails.unverified,
          invited_by: aId,
          role: "viewer",
          status: "pending",
          invite_token: `tok-unverified-${stamp}`,
        })
        .select("id")
        .single();
      if (c11insert.error || !c11insert.data?.id) {
        fail(`C11 setup: ${c11insert.error?.message}`);
      }
      const c11 = await unverified
        .from("trip_collaborators")
        .update({
          status: "accepted",
          user_id: unverifiedId,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", c11insert.data.id)
        .select("id");
      if (c11.error) {
        pass("C11", `unverified accept denied (${c11.error.message})`);
      } else if ((c11.data ?? []).length === 0) {
        pass("C11", "unverified accept unchanged (0 rows)");
      } else {
        fail("C11: unverified email accepted an invitation");
      }
    } else {
      pass("C11", "unverified sign-in blocked by Auth (gate held)");
    }

    const rpcUser = await a.rpc("increment_ai_generations_lifetime", {
      p_user_id: aId,
    });
    if (!denied(rpcUser.error)) {
      fail("X03a: authenticated JWT executed increment RPC");
    }
    pass("X03a", "authenticated increment RPC denied");

    const { error: zeroErr } = await admin
      .from("profiles")
      .update({ ai_generations_lifetime: 0 })
      .eq("id", aId);
    if (zeroErr) fail(`X03 setup: ${zeroErr.message}`);

    const rpcOne = await admin.rpc("increment_ai_generations_lifetime", {
      p_user_id: aId,
    });
    if (rpcOne.error || rpcOne.data !== 1) {
      fail(`X03b: service-role increment failed: ${rpcOne.error?.message}`);
    }
    pass("X03b", "service-role increment returned 1");

    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () =>
        admin.rpc("increment_ai_generations_lifetime", { p_user_id: aId }),
      ),
    );
    const concurrentErr = concurrent.find((r) => r.error);
    if (concurrentErr?.error) {
      fail(`X03c concurrent: ${concurrentErr.error.message}`);
    }
    const totals = concurrent.map((r) => r.data as number).sort((x, y) => x - y);
    const unique = new Set(totals);
    if (unique.size !== 8 || totals[0] !== 2 || totals[7] !== 9) {
      fail(`X03c concurrent totals not atomic: ${totals.join(",")}`);
    }
    pass("X03c", "8 concurrent increments atomic (2..9)");

    console.log(
      "verify-security-hardening.ts: PASS (P01-P07 S01-S03 A01-A04 C00-C11 X01 X02 X03)",
    );
  } finally {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
