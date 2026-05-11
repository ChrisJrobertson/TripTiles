import type { LiveWaitPublicItem } from "@/lib/live-wait/public-types";

export function isLiveWaitStale(staleAfterIso: string): boolean {
  const t = new Date(staleAfterIso).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
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
  stale: boolean;
};

/**
 * Concise copy for ride rows — advisory, non-alarming.
 */
export function formatLiveWaitForUi(row: LiveWaitPublicItem): LiveWaitDisplayParts {
  const stale = isLiveWaitStale(row.stale_after);
  const minsAgo = minutesBetween(row.observed_at);
  const freshnessLine = stale
    ? `Stale · last update ${minsAgo} min ago`
    : `Updated ${minsAgo} min ago`;

  if (!row.is_open || row.operating_status === "closed") {
    return {
      statusLine: "Closed (posted)",
      freshnessLine,
      stale,
    };
  }

  if (row.operating_status === "temporarily_closed") {
    return {
      statusLine: "Temporarily closed (posted)",
      freshnessLine,
      stale,
    };
  }

  if (row.operating_status === "down") {
    return {
      statusLine: "Down (posted)",
      freshnessLine,
      stale,
    };
  }

  if (row.operating_status === "refurb") {
    return {
      statusLine: "Refurbishment (posted)",
      freshnessLine,
      stale,
    };
  }

  const w = row.wait_minutes;
  if (w == null) {
    return {
      statusLine: "Open · wait not posted",
      freshnessLine,
      stale,
    };
  }
  if (w <= 0) {
    return {
      statusLine: "Open · walk-on or no standby posted",
      freshnessLine,
      stale,
    };
  }

  return {
    statusLine: `About ${w} min posted wait`,
    freshnessLine,
    stale,
  };
}
