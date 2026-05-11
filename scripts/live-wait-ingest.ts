/**
 * Live wait ingestion CLI (Queue-Times provider by default).
 *
 * Examples:
 *   node --import tsx scripts/live-wait-ingest.ts --dry-run
 *   node --env-file=.env.local --import tsx scripts/live-wait-ingest.ts --dry-run
 *   node --env-file=.env.local --import tsx scripts/live-wait-ingest.ts
 */

import { runLiveWaitIngest } from "@/lib/live-wait/ingest-run";
import { getLiveWaitProviderAdapter } from "@/lib/live-wait/provider-factory";
import { getSupabaseUrl } from "@/lib/supabase/env";

const dryRun = process.argv.includes("--dry-run");

function parseParkIds(): string[] {
  const raw =
    process.env.LIVE_WAIT_QUEUE_TIMES_PARK_IDS?.trim() ||
    process.env.LIVE_WAIT_EXTERNAL_PARK_IDS?.trim();
  if (!raw) {
    // Small Orlando subset (Magic Kingdom + Epcot) — override via env in prod.
    return ["6", "5"];
  }
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseStaleMinutes(): number {
  const raw = process.env.LIVE_WAIT_STALE_AFTER_MINUTES?.trim();
  const n = raw ? Number(raw) : 15;
  return Number.isFinite(n) && n > 0 ? n : 15;
}

async function main() {
  const adapter = getLiveWaitProviderAdapter();
  const externalParkIds = parseParkIds();
  const staleAfterMinutes = parseStaleMinutes();

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!dryRun && (!url || !key)) {
    console.error(
      "[live-wait] Write mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. via --env-file=.env.local).",
    );
    process.exit(1);
  }

  const log = await runLiveWaitIngest({
    adapter,
    externalParkIds,
    staleAfterMinutes,
    dryRun,
    supabaseUrl: url,
    serviceRoleKey: key,
  });

  console.log(JSON.stringify({ ok: true, ...log }, null, 2));
}

main().catch((err) => {
  console.error("[live-wait] Fatal:", err);
  process.exit(1);
});
