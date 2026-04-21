import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { Trip } from "@/lib/types";

/** Orlando theme parks supported by the V1 day sequencer (canonical `parks.id`). */
export const DAY_SEQUENCER_PARK_IDS = new Set([
  "mk",
  "ep",
  "hs",
  "ak",
  "eu",
  "us",
  "ioa",
]);

const SLOT_KEYS = ["am", "pm", "lunch", "dinner"] as const;

/** Unique park IDs assigned to any day slot (AM, PM, lunch, dinner). */
export function collectAssignmentParkIdsForDay(
  trip: Trip,
  dateKey: string,
): string[] {
  const ass = trip.assignments[dateKey] ?? {};
  const ids: string[] = [];
  for (const slot of SLOT_KEYS) {
    const id = getParkIdFromSlotValue(ass[slot]);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

/**
 * Show Touring Plan vs Smart Plan (AI) toggle for this day.
 * Requires at least one sequencer-supported park and every assigned slot park to be supported.
 */
export function dayShowsTouringPlanModeToggle(
  trip: Trip,
  dateKey: string,
): boolean {
  const ids = collectAssignmentParkIdsForDay(trip, dateKey);
  if (ids.length === 0) return false;
  if (!ids.some((id) => DAY_SEQUENCER_PARK_IDS.has(id))) return false;
  return ids.every((id) => DAY_SEQUENCER_PARK_IDS.has(id));
}

/** Default mode when the day toggle is shown: touring if every assigned park is supported (and non-empty). */
export function defaultDayPlannerMode(
  trip: Trip,
  dateKey: string,
): "touring" | "ai" {
  return dayShowsTouringPlanModeToggle(trip, dateKey) ? "touring" : "ai";
}
