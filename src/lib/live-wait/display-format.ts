import { classifyFreshness } from "@/lib/park-data/freshness";
import type { FreshnessState } from "@/lib/park-data/types";
import type { LiveWaitPublicItem } from "@/lib/live-wait/public-types";

export function isLiveWaitStale(staleAfterIso: string, now = new Date()): boolean {
  const t = new Date(staleAfterIso).getTime();
  if (Number.isNaN(t)) return false;
  return t < now.getTime();
}

export function minutesBetween(isoFrom: string, isoTo = new Date().toISOString()): number {
  const a = new Date(isoFrom).getTime();
  const b = new Date(isoTo).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 60_000));
}

export type LiveWaitDisplayParts = {
  statusLine: string;
  freshnessLine: string;
  freshness: FreshnessState;
  /** True when the figure must not be described as live. */
  stale: boolean;
  liveLabel: string;
};

/**
 * Concise copy for ride rows — advisory, non-alarming.
 * Only a LIVE freshness state uses the word "Live".
 */
export function formatLiveWaitForUi(row: LiveWaitPublicItem, now = new Date()): LiveWaitDisplayParts {
  const freshness = classifyFreshness({
    observedAt: row.observed_at,
    fetchedAt: row.fetched_at,
    staleAfter: row.stale_after,
    now,
  });
  const minsAgo = minutesBetween(row.observed_at, now.toISOString());
  const freshnessLine =
    freshness === "LIVE"
      ? `Updated ${minsAgo} min ago`
      : freshness === "RECENT"
        ? `Recent · last update ${minsAgo} min ago`
        : freshness === "STALE"
          ? `Stale · last update ${minsAgo} min ago`
          : "Freshness unknown";
  const liveLabel =
    freshness === "LIVE"
      ? "Live (advisory): "
      : freshness === "RECENT"
        ? "Recent (advisory): "
        : freshness === "STALE"
          ? "Stale (advisory): "
          : "Wait (advisory): ";
  const stale = freshness !== "LIVE";

  const base = { freshnessLine, freshness, stale, liveLabel };

  if (!row.is_open || row.operating_status === "closed") {
    return { ...base, statusLine: "Closed (posted)" };
  }
  if (row.operating_status === "temporarily_closed") {
    return { ...base, statusLine: "Temporarily closed (posted)" };
  }
  if (row.operating_status === "down") {
    return { ...base, statusLine: "Down (posted)" };
  }
  if (row.operating_status === "refurb") {
    return { ...base, statusLine: "Refurbishment (posted)" };
  }
  const w = row.wait_minutes;
  if (w == null) return { ...base, statusLine: "Open · wait not posted" };
  if (w <= 0) return { ...base, statusLine: "Open · walk-on or no standby posted" };
  return { ...base, statusLine: `About ${w} min posted wait` };
}
