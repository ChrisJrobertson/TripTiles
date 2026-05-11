/**
 * Env parsing for live wait ingestion (CLI + Vercel cron).
 */

export function liveWaitExternalParkIdsFromEnv(): string[] {
  const raw =
    process.env.LIVE_WAIT_QUEUE_TIMES_PARK_IDS?.trim() ||
    process.env.LIVE_WAIT_EXTERNAL_PARK_IDS?.trim();
  if (!raw) return ["6", "5"];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function liveWaitStaleAfterMinutesFromEnv(): number {
  const raw = process.env.LIVE_WAIT_STALE_AFTER_MINUTES?.trim();
  const n = raw ? Number(raw) : 15;
  return Number.isFinite(n) && n > 0 ? n : 15;
}
