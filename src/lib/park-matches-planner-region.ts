import { legacyDestinationFromRegionId } from "@/lib/legacy-destination";
import type { Destination, Park } from "@/lib/types";

function matchesDestination(park: Park, dest: Destination): boolean {
  if (dest === "custom") return true;
  return park.destinations.includes(dest);
}

/** Same rules as the planner Palette: `region_ids` first, else legacy destination match. */
export function parkMatchesPlannerRegion(
  park: Park,
  regionId: string | null,
): boolean {
  if (!regionId) return true;
  if (park.region_ids?.length) {
    return park.region_ids.includes(regionId);
  }
  const legacy = legacyDestinationFromRegionId(regionId);
  return matchesDestination(park, legacy);
}
