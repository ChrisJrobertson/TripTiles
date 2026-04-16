/**
 * Fails if PostgREST cannot read columns the app expects on public.profiles.
 * Run before/after deploy or in CI against the target Supabase project (e.g. staging).
 *
 * Usage: node scripts/verify-profiles-columns.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
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

/** Keep in sync with server profile reads (planner, settings, PDF, tier). */
const PROFILES_SELECT_FOR_APP =
  "tier, temperature_unit, email_marketing_opt_out, display_name";

async function main() {
  const { error } = await supabase
    .from("profiles")
    .select(PROFILES_SELECT_FOR_APP)
    .limit(1);

  if (error) {
    console.error("profiles column check failed:", error.message);
    console.error(
      "Hint: deploy migrations (e.g. npx supabase db push --linked) so the DB matches supabase/migrations/.",
    );
    process.exit(1);
  }

  console.log("OK: profiles readable with:", PROFILES_SELECT_FOR_APP);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
