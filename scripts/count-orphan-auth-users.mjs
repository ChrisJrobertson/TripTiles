/**
 * Counts auth users with no row in public.profiles (via Auth Admin API + profiles lookup).
 * Does not use raw SQL on auth.users (not exposed via PostgREST); equivalent to checking
 * orphans for typical Supabase setups.
 *
 * Usage: node scripts/count-orphan-auth-users.mjs
 * Loads .env.local when present (same pattern as diag-profile-tier.mjs).
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
  let page = 1;
  const perPage = 1000;
  let totalAuth = 0;
  let orphans = [];
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error("listUsers failed:", error.message);
      process.exit(1);
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    totalAuth += users.length;

    for (const u of users) {
      const { data: row } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", u.id)
        .maybeSingle();
      if (!row) {
        orphans.push({ id: u.id, created_at: u.created_at });
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  console.log("auth.users count (via admin API):", totalAuth);
  console.log("users with no profiles row:", orphans.length);
  if (orphans.length > 0 && process.env.LIST_ORPHAN_IDS === "1") {
    for (const o of orphans) {
      console.log(" ", o.id, o.created_at);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
