/**
 * Export and delete a disposable e2e account. Does not touch real customers
 * or the persistent returning-customer account.
 *
 * Also proves a user who has sent invitations can be deleted without leaving
 * `trip_collaborators_invited_by_fkey` dangling, and without deleting the
 * invitee's account or another owner's trip.
 *
 * Run:
 *   TRIPTILES_ALLOW_AUTH_TEST=1 node --env-file=.env.local --import tsx scripts/verify-account-lifecycle.ts
 */
import { createClient } from "@supabase/supabase-js";
import { clearCollaboratorRefsForAccount } from "../src/lib/account/clear-collaborator-refs";
import { assertAuthTestHarnessAllowed } from "../src/lib/auth/test-session-guard";

const REAL_CUSTOMERS = new Set([
  "chrisjrobertson@outlook.com",
  "ellie_robertson@icloud.com",
]);
const PROD_REF = "inqexwdkuqdfdoaauxyw";

function fail(message: string): never {
  throw new Error(message);
}

async function ensureProfile(
  lookup: () => PromiseLike<{
    data: { id?: string } | null;
    error: { message: string } | null;
  }>,
  insert: () => PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { data: profile, error: profileError } = await lookup();
  if (profileError) fail(`Profile lookup failed: ${profileError.message}`);
  if (profile?.id) return;
  const { error: insertProfileError } = await insert();
  if (insertProfileError) fail(`Profile insert failed: ${insertProfileError.message}`);
}

async function main() {
  assertAuthTestHarnessAllowed(process.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anon || !serviceKey) fail("Missing Supabase credentials");
  if (url.includes(PROD_REF)) {
    fail("Refusing to run against production project inqexwdkuqdfdoaauxyw");
  }

  const stamp = Date.now().toString(36);
  const email = `triptiles-e2e-delete-${stamp}@example.com`;
  const inviteeEmail = `triptiles-e2e-invitee-${stamp}@example.com`;
  if (
    REAL_CUSTOMERS.has(email) ||
    REAL_CUSTOMERS.has(inviteeEmail) ||
    !email.startsWith("triptiles-e2e-delete-") ||
    !inviteeEmail.startsWith("triptiles-e2e-invitee-")
  ) {
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

  const { data: inviteeCreated, error: inviteeCreateError } =
    await admin.auth.admin.createUser({
      email: inviteeEmail,
      password: `E2e-${crypto.randomUUID()}`,
      email_confirm: true,
    });
  if (inviteeCreateError || !inviteeCreated.user) {
    await admin.auth.admin.deleteUser(userId);
    fail(
      `Could not create the disposable invitee: ${inviteeCreateError?.message ?? "no user"}`,
    );
  }
  const inviteeId = inviteeCreated.user.id;
  const leftoverUserIds = new Set<string>([userId, inviteeId]);
  const dropLeftover = (id: string) => leftoverUserIds.delete(id);

  try {
    await ensureProfile(
      () => admin.from("profiles").select("id").eq("id", userId).maybeSingle(),
      () =>
        admin.from("profiles").insert({
          id: userId,
          email,
          tier: "free",
          referral_code: crypto.randomUUID().replaceAll("-", ""),
          temperature_unit: "c",
          email_marketing_opt_out: false,
        }),
    );
    await ensureProfile(
      () => admin.from("profiles").select("id").eq("id", inviteeId).maybeSingle(),
      () =>
        admin.from("profiles").insert({
          id: inviteeId,
          email: inviteeEmail,
          tier: "free",
          referral_code: crypto.randomUUID().replaceAll("-", ""),
          temperature_unit: "c",
          email_marketing_opt_out: false,
        }),
    );

    const user = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await user.auth.signInWithPassword({
      email,
      password,
    });
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

    const { error: inviteError } = await admin.from("trip_collaborators").insert({
      trip_id: trip.id,
      user_id: null,
      invited_email: inviteeEmail,
      invited_by: userId,
      role: "editor",
      status: "pending",
      invite_token: crypto.randomUUID(),
      invite_sent_at: new Date().toISOString(),
    });
    if (inviteError) fail(`Probe invite insert failed: ${inviteError.message}`);

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

    const cleared = await clearCollaboratorRefsForAccount(admin, userId);
    if (!cleared.ok) fail(`Collaborator cleanup failed: ${cleared.error}`);

    const { data: inviteLeftBeforeDelete } = await admin
      .from("trip_collaborators")
      .select("id")
      .eq("invited_by", userId);
    if ((inviteLeftBeforeDelete ?? []).length > 0) {
      fail("Collaborator rows remained after invited_by cleanup");
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) fail(`Account deletion failed: ${deleteError.message}`);
    dropLeftover(userId);

    const { data: tripLeft } = await admin.from("trips").select("id").eq("id", trip.id).maybeSingle();
    const { data: tileLeft } = await admin.from("custom_tiles").select("id").eq("id", tileId).maybeSingle();
    const { data: profileLeft } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (tripLeft || tileLeft || profileLeft) {
      fail("Private records remained after account deletion");
    }

    const { data: inviteeLeft } = await admin
      .from("profiles")
      .select("id")
      .eq("id", inviteeId)
      .maybeSingle();
    if (!inviteeLeft?.id) fail("Deleting the inviter removed the invitee's profile");

    const anonResponse = await fetch(
      `${url}/rest/v1/trips?id=eq.${encodeURIComponent(String(trip.id))}&select=notes`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
    );
    const anonBody = await anonResponse.text();
    if (anonBody.includes(note)) fail("Anonymous client could read the deleted trip");

    const { error: signInAfter } = await user.auth.signInWithPassword({ email, password });
    if (!signInAfter) fail("Deleted account could still sign in");

    const { data: owner2, error: owner2Error } = await admin.auth.admin.createUser({
      email: `triptiles-e2e-delete2-${stamp}@example.com`,
      password: `E2e-${crypto.randomUUID()}`,
      email_confirm: true,
    });
    if (owner2Error || !owner2.user) {
      fail(`Could not create the second owner: ${owner2Error?.message ?? "no user"}`);
    }
    leftoverUserIds.add(owner2.user.id);
    await ensureProfile(
      () =>
        admin.from("profiles").select("id").eq("id", owner2.user.id).maybeSingle(),
      () =>
        admin.from("profiles").insert({
          id: owner2.user.id,
          email: `triptiles-e2e-delete2-${stamp}@example.com`,
          tier: "free",
          referral_code: crypto.randomUUID().replaceAll("-", ""),
          temperature_unit: "c",
          email_marketing_opt_out: false,
        }),
    );

    const { data: trip2, error: trip2Error } = await admin
      .from("trips")
      .insert({
        owner_id: owner2.user.id,
        start_date: "2099-10-01",
        end_date: "2099-10-02",
        adventure_name: "E2E invitee-delete probe",
        family_name: "E2E invitee-delete",
        region_id: "orlando",
        destination: "orlando",
        adults: 1,
        children: 0,
        child_ages: [],
        is_public: false,
      })
      .select("id")
      .single();
    if (trip2Error || !trip2?.id) {
      fail(`Second owner trip insert failed: ${trip2Error?.message ?? "no id"}`);
    }

    const { error: acceptedInviteError } = await admin.from("trip_collaborators").insert({
      trip_id: trip2.id,
      user_id: inviteeId,
      invited_email: inviteeEmail,
      invited_by: owner2.user.id,
      role: "viewer",
      status: "accepted",
      invite_token: crypto.randomUUID(),
      accepted_at: new Date().toISOString(),
    });
    if (acceptedInviteError) {
      fail(`Accepted-invite insert failed: ${acceptedInviteError.message}`);
    }

    const inviteeCleared = await clearCollaboratorRefsForAccount(admin, inviteeId);
    if (!inviteeCleared.ok) fail(`Invitee collaborator cleanup failed: ${inviteeCleared.error}`);
    const { error: inviteeDeleteError } = await admin.auth.admin.deleteUser(inviteeId);
    if (inviteeDeleteError) fail(`Invitee deletion failed: ${inviteeDeleteError.message}`);
    dropLeftover(inviteeId);

    const { data: owner2TripLeft } = await admin
      .from("trips")
      .select("id")
      .eq("id", trip2.id)
      .maybeSingle();
    if (!owner2TripLeft?.id) fail("Deleting the invitee removed another owner's trip");

    const { data: owner2ProfileLeft } = await admin
      .from("profiles")
      .select("id")
      .eq("id", owner2.user.id)
      .maybeSingle();
    if (!owner2ProfileLeft?.id) fail("Deleting the invitee removed the other owner's profile");

    const owner2Cleared = await clearCollaboratorRefsForAccount(admin, owner2.user.id);
    if (!owner2Cleared.ok) fail(`Second owner collaborator cleanup failed: ${owner2Cleared.error}`);
    const { error: owner2DeleteError } = await admin.auth.admin.deleteUser(owner2.user.id);
    if (owner2DeleteError) fail(`Second owner cleanup failed: ${owner2DeleteError.message}`);
    dropLeftover(owner2.user.id);

    console.log(
      "account-lifecycle: export returned the probe records; inviter deletion cleared invited_by; invitee profile and the other owner's trip survived",
    );
  } catch (error) {
    for (const id of leftoverUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Account lifecycle check failed");
  process.exit(1);
});
