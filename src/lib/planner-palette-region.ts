import type { Trip } from "@/lib/types";

/** Region id used for palette / park filtering (shared across planner regions). */
export function resolvePaletteRegionId(trip: Trip | null): string | null {
  if (!trip) return null;
  if (trip.region_id) return trip.region_id;
  if (trip.destination !== "custom") return trip.destination;
  return null;
}
