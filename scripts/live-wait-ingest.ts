/**
 * Live wait and schedule ingestion.
 *
 * Examples:
 *   npm run live-wait:ingest:dry
 *   node --env-file=.env.local --import tsx scripts/live-wait-ingest.ts
 *
 * With LIVE_WAIT_PROVIDER unset, ThemeParks.wiki is ingested first and
 * Queue-Times second. Set LIVE_WAIT_PROVIDER to force a single provider.
 */

import { runThemeParkIngest } from "@/lib/park-data/orchestrate-ingest";
import { getSupabaseUrl } from "@/lib/supabase/env";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!dryRun && (!url || !key)) {
    console.error(
      "[park-data] Write mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. via --env-file=.env.local).",
    );
    process.exit(1);
  }

  const report = await runThemeParkIngest({
    dryRun,
    supabaseUrl: url,
    serviceRoleKey: key,
  });

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main().catch((err) => {
  console.error("[park-data] Fatal:", err);
  process.exit(1);
});
