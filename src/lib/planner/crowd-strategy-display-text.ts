import type { Park, Trip } from "@/lib/types";
import {
  regionHasDisneyQueueParks,
  regionHasUniversalQueueParks,
} from "@/lib/wizard-queue-step-region";

/** Matches legacy Smart Plan crowd copy shown before launch polish. */
const STALE_CROWD_SUMMARY_PREFIX = "with no specific crowd data";

export const CONFIDENT_CROWD_STRATEGY_FALLBACK =
  "Detailed crowd modelling isn't available for this region yet — Smart Plan still uses park hours, your travel dates, and group profile to shape a sensible day.";

/**
 * Resolves trip-level crowd banner copy. For regions without Disney/Universal
 * queue parks, replaces known stale AI phrasing with confident fallback while
 * leaving other stored text intact.
 */
export function resolvePlannerCrowdStrategyText(
  trip: Trip,
  parks: Park[],
  raw: unknown,
): string | null {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;

  const hasQueueParks =
    regionHasDisneyQueueParks(parks, trip.region_id) ||
    regionHasUniversalQueueParks(parks, trip.region_id);

  if (!hasQueueParks) {
    const lower = trimmed.toLowerCase();
    if (lower.startsWith(STALE_CROWD_SUMMARY_PREFIX)) {
      return CONFIDENT_CROWD_STRATEGY_FALLBACK;
    }
  }

  return trimmed;
}
