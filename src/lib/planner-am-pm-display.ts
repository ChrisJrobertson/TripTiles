import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { Assignment, Park } from "@/lib/types";

const REST_IDS = new Set(["rest", "pool"]);
const TRAVEL_IDS = new Set(["flyout", "flyhome"]);

export function isRestParkId(id: string): boolean {
  return REST_IDS.has(id);
}

export function isTravelParkId(id: string): boolean {
  return TRAVEL_IDS.has(id);
}

function fallbackPark(id: string): Park {
  return {
    id,
    name: id,
    icon: null,
    bg_colour: "#E8E4DC",
    fg_colour: "#1E1B4B",
    park_group: "custom",
    destinations: [],
    region_ids: [],
    is_custom: false,
    sort_order: 0,
  };
}

export type HalfDayDisplay =
  | { state: "flexible" }
  | { state: "park"; park: Park };

/**
 * How to render the AM+PM row of the planner calendar (visual only; four-slot
 * assignment model is unchanged).
 */
export type AmPmCalendarPresentation =
  | { mode: "unified_full_day"; park: Park }
  | { mode: "unified_travel_day"; park: Park }
  | { mode: "unified_rest_day"; stylePark: Park }
  | { mode: "split"; morning: HalfDayDisplay; afternoon: HalfDayDisplay };

function lookupPark(
  id: string | undefined,
  parkById: ReadonlyMap<string, Park>,
): Park | undefined {
  if (!id) return undefined;
  return parkById.get(id) ?? fallbackPark(id);
}

/**
 * Decide unified vs split AM/PM rendering for a day's assignments.
 */
export function buildAmPmPresentation(
  ass: Assignment,
  parkById: ReadonlyMap<string, Park>,
): AmPmCalendarPresentation {
  const amId = getParkIdFromSlotValue(ass.am);
  const pmId = getParkIdFromSlotValue(ass.pm);

  const amTravel = Boolean(amId && isTravelParkId(amId));
  const pmTravel = Boolean(pmId && isTravelParkId(pmId));

  if (amId && pmId) {
    if (isRestParkId(amId) && isRestParkId(pmId)) {
      const stylePark =
        lookupPark(amId, parkById) ?? lookupPark(pmId, parkById)!;
      return { mode: "unified_rest_day", stylePark };
    }
    if (amId === pmId && isTravelParkId(amId)) {
      const park = lookupPark(amId, parkById) ?? fallbackPark(amId);
      return { mode: "unified_travel_day", park };
    }
    if (amId === pmId && !isRestParkId(amId) && !isTravelParkId(amId)) {
      const park = lookupPark(amId, parkById);
      if (park) {
        return { mode: "unified_full_day", park };
      }
    }
  }

  if (amTravel && !pmId) {
    const park = lookupPark(amId!, parkById) ?? fallbackPark(amId!);
    return { mode: "unified_travel_day", park };
  }
  if (pmTravel && !amId) {
    const park = lookupPark(pmId!, parkById) ?? fallbackPark(pmId!);
    return { mode: "unified_travel_day", park };
  }

  const toHalf = (id: string | undefined): HalfDayDisplay => {
    if (!id) return { state: "flexible" };
    const park = lookupPark(id, parkById);
    return park ? { state: "park", park } : { state: "flexible" };
  };

  return {
    mode: "split",
    morning: toHalf(amId),
    afternoon: toHalf(pmId),
  };
}
