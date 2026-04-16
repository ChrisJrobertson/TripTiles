/**
 * End-to-end check: creating an auth user inserts into auth.users and should run
 * on_auth_user_created → handle_new_user → profiles row.
 *
 * Uses Auth Admin API (same DB trigger as email/password signUp).
 *
 * Usage: node scripts/test-handle-new-user-trigger.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. .env.local).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
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

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const stamp = Date.now();
  const email = `trigger-e2e+${stamp}@example.com`;
  const password = "TriggerE2ETest_Pw1!";

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createErr || !created?.user?.id) {
    console.error("createUser failed:", createErr?.message ?? createErr);
    process.exit(1);
  }

  const uid = created.user.id;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select(
      "id, email, tier, referral_code, temperature_unit, email_marketing_opt_out, created_at, updated_at",
    )
    .eq("id", uid)
    .maybeSingle();

  if (profErr) {
    console.error("profiles select failed:", profErr.message);
    await supabase.auth.admin.deleteUser(uid);
    process.exit(1);
  }

  if (!profile) {
    console.error("FAIL: no profiles row for new auth user", uid);
    await supabase.auth.admin.deleteUser(uid);
    process.exit(1);
  }

  const tu = profile.temperature_unit;
  if (tu !== "c" && tu !== "f") {
    console.error(
      "FAIL: profiles.temperature_unit must be c or f, got:",
      tu,
    );
    await supabase.auth.admin.deleteUser(uid);
    process.exit(1);
  }

  if (profile.email_marketing_opt_out !== false) {
    console.error(
      "FAIL: new user should have email_marketing_opt_out false, got:",
      profile.email_marketing_opt_out,
    );
    await supabase.auth.admin.deleteUser(uid);
    process.exit(1);
  }

  console.log("OK: profile row exists for new user");
  console.log(JSON.stringify(profile, null, 2));

  const { error: delErr } = await supabase.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error("cleanup deleteUser failed:", delErr.message);
    process.exit(1);
  }
  console.log("cleanup: test user deleted");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
