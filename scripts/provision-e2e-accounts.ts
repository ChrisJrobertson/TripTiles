/**
 * Create or refresh isolated, confirmed Auth users for repeatable tests.
 *
 * Uses Auth Admin createUser / updateUser with email_confirm. It does not send
 * email, does not change the project's confirmation setting, and refuses any
 * address outside the triptiles-e2e example.com namespace.
 *
 * Required:
 *   TRIPTILES_ALLOW_AUTH_TEST=1
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TRIPTILES_E2E_EMAIL / TRIPTILES_E2E_PASSWORD
 *   TRIPTILES_E2E_B_EMAIL / TRIPTILES_E2E_B_PASSWORD
 *
 * Optional:
 *   --reset-returning-trips   delete trips owned by TRIPTILES_E2E_EMAIL only
 *
 * Run:
 *   TRIPTILES_ALLOW_AUTH_TEST=1 node --env-file=.env.local --import tsx scripts/provision-e2e-accounts.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertAuthTestHarnessAllowed } from "../src/lib/auth/test-session-guard";

const E2E_EMAIL = /^triptiles-e2e-[a-z0-9-]+@example\.com$/;
const REAL_CUSTOMERS = new Set([
  "chrisjrobertson@outlook.com",
  "ellie_robertson@icloud.com",
]);

type Account = { email: string; password: string; resetTrips: boolean };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function accountFromEnv(emailKey: string, passwordKey: string, resetTrips: boolean): Account {
  const email = process.env[emailKey]?.trim().toLowerCase() ?? "";
  const password = process.env[passwordKey] ?? "";
  if (!email || !password) fail(`Missing ${emailKey} or ${passwordKey}`);
  if (REAL_CUSTOMERS.has(email) || !E2E_EMAIL.test(email)) {
    fail(`Refusing to provision ${emailKey}: address is outside the isolated e2e namespace`);
  }
  if (password.length < 12) fail(`${passwordKey} must be at least 12 characters`);
  return { email, password, resetTrips };
}

async function findUser(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers failed: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureProfile(admin: SupabaseClient, userId: string, email: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) fail(`profile lookup failed for ${email}: ${error.message}`);
  if (data?.id) return;

  const referral = crypto.randomUUID().replaceAll("-", "");
  const { error: insertError } = await admin.from("profiles").insert({
    id: userId,
    email,
    tier: "free",
    referral_code: referral,
    temperature_unit: "c",
    email_marketing_opt_out: false,
  });
  if (insertError) fail(`profile insert failed for ${email}: ${insertError.message}`);
}

async function resetOwnedTrips(admin: SupabaseClient, userId: string, email: string) {
  const { error } = await admin.from("trips").delete().eq("owner_id", userId);
  if (error) fail(`trip reset failed for ${email}: ${error.message}`);
}

async function provePasswordLogin(url: string, anon: string, account: Account) {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || !data.user) fail(`password login failed for ${account.email}: ${error?.message ?? "no user"}`);
  await client.auth.signOut();
}

async function provision(admin: SupabaseClient, account: Account) {
  const existing = await findUser(admin, account.email);
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });
    if (error || !data.user) fail(`createUser failed for ${account.email}: ${error?.message ?? "no user"}`);
    await ensureProfile(admin, data.user.id, account.email);
    if (account.resetTrips) await resetOwnedTrips(admin, data.user.id, account.email);
    return { email: account.email, id: data.user.id, action: "created" };
  }

  const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
    password: account.password,
    email_confirm: true,
  });
  if (error || !data.user) fail(`updateUser failed for ${account.email}: ${error?.message ?? "no user"}`);
  await ensureProfile(admin, data.user.id, account.email);
  if (account.resetTrips) await resetOwnedTrips(admin, data.user.id, account.email);
  return { email: account.email, id: data.user.id, action: "refreshed" };
}

async function main() {
  assertAuthTestHarnessAllowed(process.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !serviceKey || !anon) {
    fail("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const resetReturning = process.argv.includes("--reset-returning-trips");
  const accounts = [
    accountFromEnv("TRIPTILES_E2E_EMAIL", "TRIPTILES_E2E_PASSWORD", resetReturning),
    accountFromEnv("TRIPTILES_E2E_B_EMAIL", "TRIPTILES_E2E_B_PASSWORD", false),
  ];

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const account of accounts) {
    const result = await provision(admin, account);
    await provePasswordLogin(url, anon, account);
    results.push({ ...result, password_login: "ok" });
  }

  console.log(JSON.stringify({ ok: true, accounts: results }));
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : "e2e account provision failed");
});
