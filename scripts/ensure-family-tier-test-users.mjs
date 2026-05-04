/**
 * Create or upgrade auth users to Family tier (top retail entitlements) for testing.
 * Uses Auth Admin + profiles update (service role).
 *
 * - New user: createUser (email confirmed) → handle_new_user creates profile → tier set to family.
 * - Existing user: find by email → profiles.tier = family, tier_expires_at cleared.
 *
 * Testers should use **Forgot password?** on /login — passwords are not printed here.
 *
 * Usage (repo root, .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   node scripts/ensure-family-tier-test-users.mjs user1@example.com user2@example.com
 *
 * Optional: TEMP_BOOTSTRAP_PASSWORD=... for a known initial password on **new** accounts only.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const TARGET_EMAILS = process.argv
  .slice(2)
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (TARGET_EMAILS.length === 0) {
  console.error(
    "Usage: node scripts/ensure-family-tier-test-users.mjs email1@example.com [email2@example.com ...]",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(targetEmail) {
  const norm = targetEmail.toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (let guard = 0; guard < 50; guard++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === norm);
    if (hit) return hit.id;
    if (users.length < perPage) return null;
    page += 1;
  }
  return null;
}

async function setFamilyTier(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({
      tier: "family",
      tier_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(`profiles update: ${error.message}`);
}

async function ensureUser(email) {
  const bootstrapPw =
    process.env.TEMP_BOOTSTRAP_PASSWORD?.trim() ||
    `${randomUUID()}Aa1!`;

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password: bootstrapPw,
      email_confirm: true,
    });

  if (!createErr && created?.user?.id) {
    await setFamilyTier(created.user.id);
    return {
      email,
      userId: created.user.id,
      outcome: "created",
    };
  }

  const msg = createErr?.message ?? "";
  const duplicate =
    /already|registered|exists|duplicate/i.test(msg) ||
    createErr?.status === 422;

  if (!duplicate) {
    throw new Error(`createUser ${email}: ${msg || JSON.stringify(createErr)}`);
  }

  const existingId = await findUserIdByEmail(email);
  if (!existingId) {
    throw new Error(
      `User ${email} appears to exist (create failed) but was not found via listUsers — check Supabase Auth dashboard.`,
    );
  }
  await setFamilyTier(existingId);
  return {
    email,
    userId: existingId,
    outcome: "updated_existing",
  };
}

async function main() {
  console.log("Ensuring Family tier for:", TARGET_EMAILS.join(", "));
  const results = [];
  for (const email of TARGET_EMAILS) {
    const r = await ensureUser(email);
    results.push(r);
    console.log(
      `  OK ${r.email} → ${r.userId} (${r.outcome === "created" ? "new account" : "existing account, tier set to family"})`,
    );
  }
  console.log("\nDone. Testers: live site → /login → **Forgot password** to set a password.");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
