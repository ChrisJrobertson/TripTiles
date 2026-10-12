import type { FreshnessState } from "@/lib/park-data/types";

/** Observations older than this, and already past `staleAfter`, are STALE rather than RECENT. */
export const DEFAULT_RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;

export type FreshnessInput = {
  observedAt: string | null;
  fetchedAt?: string | null;
  staleAfter: string | null;
  now?: Date;
  recentWindowMs?: number;
};

/**
 * Deterministic freshness.
 *
 * LIVE means `now` is still within the stored stale threshold.
 * RECENT means the threshold has passed but the observation is inside the recent window.
 * Missing or unparseable timestamps are UNKNOWN — never treated as live.
 * `fetchedAt` is retained for provenance and does not make an old observation live.
 */
export function classifyFreshness(input: FreshnessInput): FreshnessState {
  const now = input.now ?? new Date();
  const observed = input.observedAt ? Date.parse(input.observedAt) : Number.NaN;
  const stale = input.staleAfter ? Date.parse(input.staleAfter) : Number.NaN;
  if (!Number.isFinite(observed) || !Number.isFinite(stale)) return "UNKNOWN";
  if (now.getTime() <= stale) return "LIVE";
  const recentMs = input.recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS;
  if (now.getTime() - observed <= recentMs) return "RECENT";
  return "STALE";
}

export function freshnessAllowsLiveDescription(state: FreshnessState): boolean {
  return state === "LIVE";
}
