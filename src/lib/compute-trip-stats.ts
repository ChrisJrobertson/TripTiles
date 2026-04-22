import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import { THEME_PARK_GROUP_SET } from "@/lib/park-categories";
import type { Park, SlotType, Trip } from "@/lib/types";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";

const THEME_GROUPS = THEME_PARK_GROUP_SET;

function tripDateKeys(trip: Trip): string[] {
  const keys: string[] = [];
  let d = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  while (d.getTime() <= end.getTime()) {
    keys.push(formatDateKey(d));
    d = addDays(d, 1);
  }
  return keys;
}

function isRestStylePark(p: Park | undefined): boolean {
  if (!p) return false;
  const n = p.name.toLowerCase();
  if (/\brest\b|\bpool\b|lazy|hotel day|shopping day/i.test(n)) return true;
  return p.park_group === "activities" && /\brest\b|\bpool\b/i.test(n);
}

export type TripStatsSummary = {
  totalDays: number;
  parkDays: number;
  restDays: number;
  uniqueParkIds: number;
  mostVisitedName: string | null;
  /** Theme-park days that include this park (same day counts once per park). */
  mostVisitedDayCount: number;
  mealSlotsFilled: number;
  namedRestaurantCount: number;
  estimatedMiles: number;
  completenessPct: number;
};

export function computeTripStats(
  trip: Trip,
  parkById: Map<string, Park>,
): TripStatsSummary {
  const keys = tripDateKeys(trip);
  const totalDays = Math.max(1, keys.length);
  const slots: SlotType[] = ["am", "pm", "lunch", "dinner"];

  const themeDayCounts = new Map<string, number>();
  let parkDays = 0;
  let restDays = 0;
  let mealSlotsFilled = 0;
  const namedRestaurants = new Set<string>();

  for (const dk of keys) {
    const day = trip.assignments[dk] ?? {};
    let dayHasTheme = false;
    let anyAssignment = false;
    const themeSeenThisDay = new Set<string>();

    for (const s of slots) {
      const id = getParkIdFromSlotValue(day[s]);
      if (!id) continue;
      anyAssignment = true;
      const p = parkById.get(id);
      if (s === "lunch" || s === "dinner") mealSlotsFilled += 1;
      if (p && isNamedRestaurantPark(p)) namedRestaurants.add(id);
      if (p && THEME_GROUPS.has(p.park_group)) {
        dayHasTheme = true;
        themeSeenThisDay.add(id);
      }
    }

    for (const id of themeSeenThisDay) {
      themeDayCounts.set(id, (themeDayCounts.get(id) ?? 0) + 1);
    }

    if (dayHasTheme) parkDays += 1;
    else {
      let onlyRestOrEmpty = !anyAssignment;
      if (anyAssignment) {
        onlyRestOrEmpty = slots.every((s) => {
          const id = getParkIdFromSlotValue(day[s]);
          if (!id) return true;
          return isRestStylePark(parkById.get(id));
        });
      }
      if (onlyRestOrEmpty) restDays += 1;
    }
  }

  let mostId: string | null = null;
  let mostN = 0;
  for (const [pid, n] of themeDayCounts) {
    if (n > mostN) {
      mostN = n;
      mostId = pid;
    }
  }

  const filled = keys.reduce((acc, dk) => {
    const day = trip.assignments[dk] ?? {};
    let c = 0;
    for (const s of slots) {
      if (getParkIdFromSlotValue(day[s])) c += 1;
    }
    return acc + c;
  }, 0);
  const possible = totalDays * 4;
  const completenessPct =
    possible > 0 ? Math.round((filled / possible) * 100) : 0;

  let miles = 0;
  for (const dk of keys) {
    const day = trip.assignments[dk] ?? {};
    let theme = false;
    let empty = true;
    for (const s of ["am", "pm"] as const) {
      const id = getParkIdFromSlotValue(day[s]);
      if (id) empty = false;
      const p = parkById.get(id ?? "");
      if (p && THEME_GROUPS.has(p.park_group)) theme = true;
    }
    if (theme) miles += 10;
    else if (empty) miles += 2;
    else miles += 4;
  }

  return {
    totalDays,
    parkDays,
    restDays,
    uniqueParkIds: themeDayCounts.size,
    mostVisitedName: mostId ? parkById.get(mostId)?.name ?? null : null,
    mostVisitedDayCount: mostN,
    mealSlotsFilled,
    namedRestaurantCount: namedRestaurants.size,
    estimatedMiles: Math.round(miles),
    completenessPct,
  };
}

export function buildTripStatsShareText(
  stats: TripStatsSummary,
  destinationLabel: string,
): string {
  const d = destinationLabel.trim() || "our trip";
  return `Our ${d}: ${stats.totalDays} days, ${stats.parkDays} park days, ${stats.restDays} rest days, ~${stats.estimatedMiles} miles of walking planned! Built with TripTiles 🗺️ triptiles.app`;
}
