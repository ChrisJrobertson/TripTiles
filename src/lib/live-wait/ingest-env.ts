/**
 * Env parsing for live wait ingestion (CLI + Vercel cron).
 */

const LAUNCH_QUEUE_TIMES_PARK_IDS = [
  "6",
  "5",
  "7",
  "8",
  "65",
  "64",
  "334",
  "16",
  "17",
  "4",
  "28",
  "31",
];

export function liveWaitExternalParkIdsFromEnv(): string[] {
  const raw =
    process.env.LIVE_WAIT_QUEUE_TIMES_PARK_IDS?.trim() ||
    process.env.LIVE_WAIT_EXTERNAL_PARK_IDS?.trim();
  // Keep launch coverage working even if Vercel env vars are missing or scoped incorrectly.
  if (!raw) return LAUNCH_QUEUE_TIMES_PARK_IDS;
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
