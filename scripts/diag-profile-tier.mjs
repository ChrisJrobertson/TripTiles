/**
 * One-off diagnostic: prints `profiles.id` + `profiles.tier` for each auth user
 * (service role, bypasses RLS).
 *
 * Usage from repo root:
 *   node scripts/diag-profile-tier.mjs
 *   DIAG_USER_ID=<uuid> node scripts/diag-profile-tier.mjs
 *
 * Loads `.env.local` when present (does not print secret values).
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
const targetId = process.env.DIAG_USER_ID?.trim();

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: listData, error: listErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    console.error("auth.admin.listUsers failed:", listErr.message);
    process.exit(1);
  }

  const users = listData?.users ?? [];
  console.log("auth users (page 1):", users.length);

  for (const u of users) {
    const { data: row, error: pe } = await supabase
      .from("profiles")
      .select("id, tier, updated_at")
      .eq("id", u.id)
      .maybeSingle();

    const tier = row?.tier ?? "(no row)";
    const mark = targetId && u.id === targetId ? "  <-- DIAG_USER_ID" : "";
    console.log(`  ${u.id}  tier=${tier}${mark}`);
    if (pe) console.log("    profiles error:", pe.message);
  }

  if (targetId) {
    console.log("\n--- DIAG_USER_ID detail ---");
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, tier, display_name, updated_at")
      .eq("id", targetId)
      .maybeSingle();
    console.log("profiles:", pErr?.message ?? prof);
  } else {
    console.log(
      "\nSet DIAG_USER_ID=<your uuid> to print profiles detail for one user.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
