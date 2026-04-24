import type { TripRidePriority } from "@/types/attractions";

/**
 * Resolves a catalogue park id for an attraction when we only have the
 * current day’s ride priority rows (already joined to attractions in the app).
 */
export function getParkIdForAttraction(
  attractionId: string,
  dayPriorities: TripRidePriority[],
): string | null {
  const row = dayPriorities.find((r) => r.attraction_id === attractionId);
  return row?.attraction?.park_id ?? null;
}
