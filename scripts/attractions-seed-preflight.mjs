/**
 * One-off: pre-flight for attractions seeding (parks + schema discovery via REST).
 * Run: node --env-file=.env.local scripts/attractions-seed-preflight.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const want = ["dl", "dca", "dlp", "wds", "wdsp", "hkdl"];
  const { data: rows, error } = await supabase
    .from("parks")
    .select("id, name, country, region_ids, official_url, park_group")
    .in("id", want);
  if (error) {
    console.error("parks query error:", error.message);
    process.exit(1);
  }
  console.log("--- parks (dl, dca, dlp, wds, wdsp, hkdl) ---");
  console.log(JSON.stringify(rows, null, 2));

  const { data: tiers, error: te } = await supabase
    .from("attractions")
    .select("skip_line_tier")
    .not("skip_line_tier", "is", null);
  if (te) {
    console.error("skip_line_tier query:", te.message);
  } else {
    const set = new Set(
      (tiers ?? [])
        .map((r) => r.skip_line_tier)
        .filter((t) => t != null),
    );
    console.log("--- distinct skip_line_tier (from sample) ---");
    console.log([...set].sort());
  }

  const { data: one, error: oerr } = await supabase
    .from("attractions")
    .select("*")
    .limit(1);
  if (oerr) {
    console.error("attractions sample:", oerr.message);
  } else if (one?.length) {
    console.log("--- sample attraction column keys ---");
    console.log(Object.keys(one[0]).sort().join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
