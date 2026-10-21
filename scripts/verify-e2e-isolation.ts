/**
 * Two-user isolation for the dedicated e2e accounts.
 * Allow and deny checks use those users' sessions and the anon key.
 * The service role is used only to delete the probe rows at the end.
 *
 * Run: node --env-file=.env.local --import tsx scripts/verify-e2e-isolation.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const emailA = process.env.TRIPTILES_E2E_EMAIL?.trim().toLowerCase();
const passwordA = process.env.TRIPTILES_E2E_PASSWORD;
const emailB = process.env.TRIPTILES_E2E_B_EMAIL?.trim().toLowerCase();
const passwordB = process.env.TRIPTILES_E2E_B_PASSWORD;

const REAL_CUSTOMERS = new Set([
  "chrisjrobertson@outlook.com",
  "ellie_robertson@icloud.com",
]);

type Outcome = { status: number; rows: number; body: unknown };

function fail(message: string): never {
  throw new Error(message);
}

function assertE2E(email: string | undefined, key: string): asserts email is string {
  if (!email || REAL_CUSTOMERS.has(email) || !email.startsWith("triptiles-e2e-")) {
    fail(`${key} is not an isolated e2e account`);
  }
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url!, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) fail(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function rest(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<Outcome> {
  const headers = new Headers(init.headers);
  headers.set("apikey", anon!);
  headers.set("Authorization", `Bearer ${token ?? anon}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Prefer") && init.method && init.method !== "GET") {
    headers.set("Prefer", "return=representation");
  }
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const rows = Array.isArray(body) ? body.length : body && typeof body === "object" && "id" in body ? 1 : 0;
  return { status: response.status, rows, body };
}

async function main() {
  assertE2E(emailA, "TRIPTILES_E2E_EMAIL");
  assertE2E(emailB, "TRIPTILES_E2E_B_EMAIL");
  if (!url || !anon || !serviceKey || !passwordA || !passwordB) {
    fail("Missing Supabase or e2e credentials");
  }
  if (emailA === emailB) fail("The two e2e accounts must be different");

  const userA = await signIn(emailA, passwordA);
  const userB = await signIn(emailB, passwordB);
  const sessionA = (await userA.auth.getSession()).data.session;
  const sessionB = (await userB.auth.getSession()).data.session;
  const idA = (await userA.auth.getUser()).data.user?.id;
  const idB = (await userB.auth.getUser()).data.user?.id;
  if (!sessionA || !sessionB || !idA || !idB || idA === idB) fail("Both user sessions are required");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const secretNote = `e2e-private-note-${stamp}`;
  const { data: attraction, error: attractionError } = await userA
    .from("attractions")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (attractionError || !attraction?.id) {
    fail(`Could not read an attraction id for the priority probe: ${attractionError?.message ?? "none"}`);
  }

  const { data: tripA, error: tripAError } = await userA
    .from("trips")
    .insert({
      owner_id: idA,
      start_date: "2099-06-01",
      end_date: "2099-06-03",
      adventure_name: `E2E private A ${stamp}`,
      family_name: "E2E A",
      region_id: "orlando",
      destination: "orlando",
      adults: 2,
      children: 1,
      child_ages: [8],
      notes: secretNote,
      is_public: false,
    })
    .select("id")
    .single();
  if (tripAError || !tripA?.id) fail(`User A trip insert failed: ${tripAError?.message ?? "no id"}`);

  const { data: tripB, error: tripBError } = await userB
    .from("trips")
    .insert({
      owner_id: idB,
      start_date: "2099-07-01",
      end_date: "2099-07-02",
      adventure_name: `E2E private B ${stamp}`,
      family_name: "E2E B",
      region_id: "orlando",
      destination: "orlando",
      adults: 1,
      is_public: false,
    })
    .select("id")
    .single();
  if (tripBError || !tripB?.id) fail(`User B trip insert failed: ${tripBError?.message ?? "no id"}`);

  const probeIds = [tripA.id as string, tripB.id as string];

  try {
    const { data: priority, error: priorityError } = await userA
      .from("trip_ride_priorities")
      .insert({
        trip_id: tripA.id,
        attraction_id: attraction.id,
        day_date: "2099-06-01",
        priority: "must_do",
      })
      .select("id")
      .single();
    if (priorityError || !priority?.id) {
      fail(`User A ride priority insert failed: ${priorityError?.message ?? "no id"}`);
    }

    const { data: payment, error: paymentError } = await userA
      .from("trip_payments")
      .insert({
        trip_id: tripA.id,
        label: "E2E private deposit",
        amount_pence: 1500,
        currency: "GBP",
      })
      .select("id")
      .single();
    if (paymentError || !payment?.id) {
      fail(`User A payment insert failed: ${paymentError?.message ?? "no id"}`);
    }

    const { data: budget, error: budgetError } = await userA
      .from("trip_budget_items")
      .insert({
        trip_id: tripA.id,
        category: "tickets",
        label: "E2E private tickets",
        amount: 20,
      })
      .select("id")
      .single();
    if (budgetError || !budget?.id) {
      fail(`User A budget insert failed: ${budgetError?.message ?? "no id"}`);
    }

    const ownRead = await rest(`trips?id=eq.${tripA.id}&select=id`, sessionA.access_token);
    if (ownRead.status !== 200 || ownRead.rows !== 1) fail(`Owner REST read failed: ${JSON.stringify(ownRead)}`);

    const crossRead = await rest(
      `trips?id=eq.${tripA.id}&select=id,notes,child_ages`,
      sessionB.access_token,
    );
    if (crossRead.rows !== 0) fail(`User B read User A's trip: ${JSON.stringify(crossRead)}`);

    const crossUpdate = await rest(`trips?id=eq.${tripA.id}`, sessionB.access_token, {
      method: "PATCH",
      body: JSON.stringify({ adventure_name: "should-not-stick" }),
    });
    if (crossUpdate.rows !== 0) fail(`User B updated User A's trip: ${JSON.stringify(crossUpdate)}`);

    const crossDelete = await rest(`trips?id=eq.${tripA.id}`, sessionB.access_token, {
      method: "DELETE",
    });
    if (crossDelete.rows !== 0) fail(`User B deleted User A's trip: ${JSON.stringify(crossDelete)}`);

    const stillThere = await rest(`trips?id=eq.${tripA.id}&select=adventure_name,notes`, sessionA.access_token);
    const stillRow = Array.isArray(stillThere.body) ? stillThere.body[0] : null;
    if (!stillRow || stillRow.adventure_name !== `E2E private A ${stamp}` || stillRow.notes !== secretNote) {
      fail("User A's trip changed after User B's writes");
    }

    const reverseRead = await rest(`trips?id=eq.${tripB.id}&select=id`, sessionA.access_token);
    if (reverseRead.rows !== 0) fail("User A read User B's private trip");

    const priorityRead = await rest(
      `trip_ride_priorities?trip_id=eq.${tripA.id}&select=id`,
      sessionB.access_token,
    );
    const paymentRead = await rest(
      `trip_payments?trip_id=eq.${tripA.id}&select=id,label`,
      sessionB.access_token,
    );
    const budgetRead = await rest(
      `trip_budget_items?trip_id=eq.${tripA.id}&select=id`,
      sessionB.access_token,
    );
    if (priorityRead.rows || paymentRead.rows || budgetRead.rows) {
      fail(
        `User B read related records: priorities=${priorityRead.rows} payments=${paymentRead.rows} budget=${budgetRead.rows}`,
      );
    }

    const anonPrivate = await rest(`trips?id=eq.${tripA.id}&select=id,notes`, null);
    if (anonPrivate.rows !== 0) fail("Anon read a private trip");

    const slug = `e2e-share-${stamp}`;
    const published = await rest(`trips?id=eq.${tripA.id}`, sessionA.access_token, {
      method: "PATCH",
      body: JSON.stringify({ is_public: true, public_slug: slug }),
    });
    if (published.rows !== 1) fail(`Owner could not publish: ${JSON.stringify(published)}`);

    const anonPublic = await rest(
      `trips?public_slug=eq.${slug}&select=id,adventure_name,notes,child_ages,adults,is_public`,
      null,
    );
    const publicRow = Array.isArray(anonPublic.body) ? anonPublic.body[0] : null;
    if (anonPublic.rows !== 1 || !publicRow?.is_public) fail("Anon could not read the published trip");
    const anonOther = await rest(`trips?id=eq.${tripB.id}&select=id`, null);
    if (anonOther.rows !== 0) fail("Publishing User A exposed User B");

    const anonPayment = await rest(`trip_payments?trip_id=eq.${tripA.id}&select=label`, null);
    const revoked = await rest(`trips?id=eq.${tripA.id}`, sessionA.access_token, {
      method: "PATCH",
      body: JSON.stringify({ is_public: false, public_slug: null }),
    });
    if (revoked.rows !== 1) fail(`Owner could not revoke: ${JSON.stringify(revoked)}`);
    const anonAfterRevoke = await rest(`trips?public_slug=eq.${slug}&select=id`, null);
    if (anonAfterRevoke.rows !== 0) fail("Anon could still read the trip after revoke");

    const bCannotPublishA = await rest(`trips?id=eq.${tripA.id}`, sessionB.access_token, {
      method: "PATCH",
      body: JSON.stringify({ is_public: true }),
    });
    if (bCannotPublishA.rows !== 0) fail("User B published User A's trip");

    console.log(
      JSON.stringify({
        ok: true,
        userA: emailA,
        userB: emailB,
        ownerRead: ownRead.status,
        crossRead: { status: crossRead.status, rows: crossRead.rows },
        crossUpdate: { status: crossUpdate.status, rows: crossUpdate.rows },
        crossDelete: { status: crossDelete.status, rows: crossDelete.rows },
        reverseRead: { status: reverseRead.status, rows: reverseRead.rows },
        related: {
          priorities: priorityRead.rows,
          payments: paymentRead.rows,
          budget: budgetRead.rows,
        },
        anonPrivate: { status: anonPrivate.status, rows: anonPrivate.rows },
        publicShare: {
          status: anonPublic.status,
          rows: anonPublic.rows,
          exposedNotes: publicRow?.notes === secretNote,
          exposedChildAges: Array.isArray(publicRow?.child_ages) && publicRow.child_ages.length > 0,
          exposedPayment: anonPayment.rows > 0,
        },
        afterRevoke: { status: anonAfterRevoke.status, rows: anonAfterRevoke.rows },
      }),
    );
  } finally {
    const { error } = await admin.from("trips").delete().in("id", probeIds);
    if (error) fail(`probe cleanup failed: ${error.message}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "e2e isolation failed";
  console.error(message);
  process.exit(1);
});
