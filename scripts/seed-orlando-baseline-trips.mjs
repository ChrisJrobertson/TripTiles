/**
 * Creates Chris and Ellie via the Auth admin API, then four private
 * Orlando trips each. Passwords are read from the environment and never printed.
 *
 *   node --env-file=.env.local scripts/seed-orlando-baseline-trips.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const accounts = [
  {
    label: "Chris",
    email: process.env.TEST_CHRIS_EMAIL,
    password: process.env.TEST_CHRIS_PASSWORD,
    trips: [
      {
        adventure_name: "Disney Family Week",
        start_date: "2026-11-02",
        end_date: "2026-11-08",
        planning_preferences: {
          pace: "relaxed",
          mustDoParks: ["mk", "ep", "hs", "ak"],
          priorities: ["character_meets", "low_thrill"],
          adults: 2,
          children: 2,
          childAges: [6, 9],
        },
      },
      {
        adventure_name: "Disney + Universal including Epic Universe",
        start_date: "2026-12-06",
        end_date: "2026-12-13",
        planning_preferences: {
          pace: "moderate",
          mustDoParks: ["mk", "ep", "us", "ioa", "eu"],
          priorities: ["epic_universe", "one_park_per_day"],
          adults: 2,
          children: 1,
          childAges: [11],
        },
      },
      {
        adventure_name: "Orlando Two-Week Holiday",
        start_date: "2027-02-06",
        end_date: "2027-02-20",
        planning_preferences: {
          pace: "relaxed",
          mustDoParks: ["mk", "ep", "hs", "ak", "us", "ioa", "eu", "sw"],
          priorities: ["rest_days", "water_parks"],
          adults: 2,
          children: 2,
          childAges: [5, 8],
        },
      },
      {
        adventure_name: "High-Intensity Theme Park Test",
        start_date: "2027-03-15",
        end_date: "2027-03-20",
        planning_preferences: {
          pace: "intense",
          mustDoParks: ["hs", "us", "ioa", "eu"],
          priorities: ["coasters", "rope_drop"],
          adults: 2,
          children: 0,
          childAges: [],
        },
      },
    ],
  },
  {
    label: "Ellie",
    email: process.env.TEST_ELLIE_EMAIL,
    password: process.env.TEST_ELLIE_PASSWORD,
    trips: [
      {
        adventure_name: "Relaxed Disney Holiday",
        start_date: "2026-11-16",
        end_date: "2026-11-22",
        planning_preferences: {
          pace: "relaxed",
          mustDoParks: ["mk", "ep", "ak"],
          priorities: ["shows", "early_nights"],
          adults: 2,
          children: 1,
          childAges: [4],
        },
      },
      {
        adventure_name: "Universal & Epic Universe",
        start_date: "2027-01-10",
        end_date: "2027-01-16",
        planning_preferences: {
          pace: "moderate",
          mustDoParks: ["us", "ioa", "eu", "vb"],
          priorities: ["epic_universe", "express"],
          adults: 2,
          children: 0,
          childAges: [],
        },
      },
      {
        adventure_name: "Orlando Family Mix",
        start_date: "2027-04-03",
        end_date: "2027-04-12",
        planning_preferences: {
          pace: "moderate",
          mustDoParks: ["mk", "hs", "us", "sw"],
          priorities: ["mixed_parks", "character_meets"],
          adults: 2,
          children: 2,
          childAges: [7, 10],
        },
      },
      {
        adventure_name: "Short Orlando Break",
        start_date: "2026-10-26",
        end_date: "2026-10-29",
        planning_preferences: {
          pace: "relaxed",
          mustDoParks: ["mk", "ep"],
          priorities: ["short_trip", "evenings_free"],
          adults: 2,
          children: 0,
          childAges: [],
        },
      },
    ],
  },
];

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function ensureUser(admin, email, password) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!created.error && created.data.user) return created.data.user;
  const message = created.error?.message ?? "";
  if (!/already|registered|exists/i.test(message)) {
    throw new Error(`createUser ${email}: ${message}`);
  }
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw new Error(listed.error.message);
  const existing = listed.data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!existing) throw new Error(`could not find existing user ${email}`);
  return existing;
}

async function main() {
  assert(url && anon && service, "Missing Supabase URL, anon key, or service role key");
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const parkIds = [
    ...new Set(accounts.flatMap((account) => account.trips.flatMap((trip) => trip.planning_preferences.mustDoParks))),
  ];
  const { data: parks, error: parkErr } = await admin
    .from("parks")
    .select("id")
    .in("id", parkIds);
  if (parkErr) throw new Error(parkErr.message);
  const found = new Set((parks ?? []).map((park) => park.id));
  const missing = parkIds.filter((id) => !found.has(id));
  assert(missing.length === 0, `missing catalogue park ids: ${missing.join(", ")}`);

  const summary = [];

  for (const account of accounts) {
    assert(account.email && account.password, `Missing credentials for ${account.label}`);
    const user = await ensureUser(admin, account.email, account.password);
    const { data: profiles, error: profileErr } = await admin
      .from("profiles")
      .select("id, tier")
      .eq("id", user.id);
    if (profileErr) throw new Error(profileErr.message);
    assert(profiles?.length === 1 && profiles[0].id === user.id, `${account.label} profile missing`);

    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (signedIn.error) throw new Error(`${account.label} sign-in failed: ${signedIn.error.message}`);

    const { data: existingTrips, error: existingErr } = await client
      .from("trips")
      .select("id, adventure_name");
    if (existingErr) throw new Error(existingErr.message);
    const have = new Set((existingTrips ?? []).map((trip) => trip.adventure_name));

    for (const trip of account.trips) {
      if (have.has(trip.adventure_name)) continue;
      const { error } = await client.from("trips").insert({
        owner_id: user.id,
        adventure_name: trip.adventure_name,
        family_name: account.label,
        destination: "orlando",
        region_id: "orlando",
        start_date: trip.start_date,
        end_date: trip.end_date,
        is_public: false,
        planning_preferences: trip.planning_preferences,
      });
      if (error) throw new Error(`${account.label} ${trip.adventure_name}: ${error.message}`);
    }

    const { data: mine, error: listErr } = await client.from("trips").select("id, adventure_name");
    if (listErr) throw new Error(listErr.message);
    summary.push({
      label: account.label,
      email: account.email,
      profile_id_matches_auth: true,
      tier: profiles[0].tier,
      private_trips: (mine ?? []).map((trip) => trip.adventure_name).sort(),
    });
  }

  const chris = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ellie = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const chrisSign = await chris.auth.signInWithPassword({
    email: accounts[0].email,
    password: accounts[0].password,
  });
  const ellieSign = await ellie.auth.signInWithPassword({
    email: accounts[1].email,
    password: accounts[1].password,
  });
  if (chrisSign.error || ellieSign.error) {
    throw new Error("isolation sign-in failed");
  }
  const chrisRows = await chris.from("trips").select("adventure_name, family_name");
  const ellieRows = await ellie.from("trips").select("adventure_name, family_name");
  if (chrisRows.error || ellieRows.error) {
    throw new Error(chrisRows.error?.message || ellieRows.error?.message);
  }
  const chrisNames = new Set((chrisRows.data ?? []).map((row) => row.adventure_name));
  const ellieNames = new Set((ellieRows.data ?? []).map((row) => row.adventure_name));
  for (const name of accounts[1].trips.map((trip) => trip.adventure_name)) {
    assert(!chrisNames.has(name), `Chris can see Ellie's trip ${name}`);
  }
  for (const name of accounts[0].trips.map((trip) => trip.adventure_name)) {
    assert(!ellieNames.has(name), `Ellie can see Chris's trip ${name}`);
  }
  assert(chrisNames.size === 4, `Chris sees ${chrisNames.size} trips`);
  assert(ellieNames.size === 4, `Ellie sees ${ellieNames.size} trips`);

  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonTrips = await anonClient.from("trips").select("id").eq("is_public", false);
  const anonProfiles = await anonClient.from("profiles").select("id");
  if (anonTrips.error) throw new Error(anonTrips.error.message);
  assert((anonTrips.data ?? []).length === 0, "anon saw private trips");
  const profilesBlocked =
    anonProfiles.error != null || (anonProfiles.data ?? []).length === 0;
  assert(profilesBlocked, "anon saw profiles");

  const chrisUpdate = await chris
    .from("trips")
    .update({ colour_theme: "sunset" })
    .eq("adventure_name", "Disney Family Week")
    .select("id");
  if (chrisUpdate.error) throw new Error(chrisUpdate.error.message);
  assert((chrisUpdate.data ?? []).length === 1, "Chris could not update his trip");

  const ellieUpdate = await ellie
    .from("trips")
    .update({ colour_theme: "ocean" })
    .eq("adventure_name", "Short Orlando Break")
    .select("id");
  if (ellieUpdate.error) throw new Error(ellieUpdate.error.message);
  assert((ellieUpdate.data ?? []).length === 1, "Ellie could not update her trip");

  console.log(JSON.stringify({ ok: true, accounts: summary, anon_private_trips: 0 }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
