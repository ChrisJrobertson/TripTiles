import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import type { Park } from "@/lib/types";

const DISNEY_GROUPS = new Set(["disney", "disneyextra"]);
const UNIVERSAL_GROUPS = new Set(["universal"]);

export function parksInPlannerRegion(
  parks: Park[],
  regionId: string | null,
): Park[] {
  if (!regionId) return [];
  return parks.filter(
    (p) => !p.is_custom && parkMatchesPlannerRegion(p, regionId),
  );
}

export function regionHasDisneyQueueParks(
  parks: Park[],
  regionId: string | null,
): boolean {
  return parksInPlannerRegion(parks, regionId).some((p) =>
    DISNEY_GROUPS.has(p.park_group),
  );
}

export function regionHasUniversalQueueParks(
  parks: Park[],
  regionId: string | null,
): boolean {
  return parksInPlannerRegion(parks, regionId).some((p) =>
    UNIVERSAL_GROUPS.has(p.park_group),
  );
}

export function classifyThemeParkLine(
  park: Park | undefined,
): "disney" | "universal" | "other" {
  if (!park) return "other";
  if (DISNEY_GROUPS.has(park.park_group)) return "disney";
  if (UNIVERSAL_GROUPS.has(park.park_group)) return "universal";
  return "other";
}
