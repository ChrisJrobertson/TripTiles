import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { isCruisePaletteTileName } from "@/lib/cruise-tiles";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import type { Assignment, Assignments, Park, Trip } from "@/lib/types";

const THEME_GROUPS = new Set([
  "disney",
  "universal",
  "attractions",
  "seaworld",
  "disneyextra",
]);

const GENERIC_DINING_NAMES = new Set([
  "Table Service",
  "Quick Service",
  "Specialty Dining",
  "Character Dining",
]);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function usedParkIds(assignments: Assignments): Set<string> {
  const s = new Set<string>();
  for (const day of Object.values(assignments)) {
    if (!day) continue;
    for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
      const id = getParkIdFromSlotValue(day[slot]);
      if (id) s.add(id);
    }
  }
  return s;
}

function emptyDayKeys(trip: Trip, assignments: Assignments): string[] {
  const keys: string[] = [];
  let d = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  while (d.getTime() <= end.getTime()) {
    const key = formatDateKey(d);
    const day = assignments[key];
    const empty =
      !day ||
      !getParkIdFromSlotValue(day.am) &&
        !getParkIdFromSlotValue(day.pm) &&
        !getParkIdFromSlotValue(day.lunch) &&
        !getParkIdFromSlotValue(day.dinner);
    if (empty) keys.push(key);
    d = addDays(d, 1);
  }
  return keys;
}

export type SurpriseResult = {
  dateKey: string;
  assignment: Assignment;
};

/**
 * Picks a random empty day and fills AM/PM/Lunch/Dinner without calling the AI.
 */
export function buildSurpriseDayPlan(input: {
  trip: Trip;
  parks: Park[];
  /** Prefer this day if it is empty; otherwise random empty day. */
  preferredDateKey?: string | null;
}): SurpriseResult | null {
  const { trip, parks } = input;
  const rid = trip.region_id ?? (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) return null;

  const used = usedParkIds(trip.assignments);
  const regionParks = parks.filter(
    (p) =>
      !p.is_custom &&
      parkMatchesPlannerRegion(p, rid) &&
      (!isCruisePaletteTileName(p.name) || trip.has_cruise),
  );

  const themes = shuffle(
    regionParks.filter(
      (p) => THEME_GROUPS.has(p.park_group) && !used.has(p.id),
    ),
  );
  const themesAny = shuffle(
    regionParks.filter((p) => THEME_GROUPS.has(p.park_group)),
  );
  const themePark = themes[0] ?? themesAny[0];
  if (!themePark) return null;

  const diningGeneric = shuffle(
    regionParks.filter(
      (p) =>
        p.park_group === "dining" &&
        !isNamedRestaurantPark(p) &&
        GENERIC_DINING_NAMES.has(p.name),
    ),
  );
  const diningNamed = shuffle(
    regionParks.filter((p) => isNamedRestaurantPark(p)),
  );

  const lunch =
    diningGeneric[0] ??
    regionParks.find((p) => p.park_group === "dining") ??
    themePark;
  const dinner = diningNamed[0] ?? diningGeneric[1] ?? lunch;

  const emptyKeys = emptyDayKeys(trip, trip.assignments);
  if (emptyKeys.length === 0) return null;
  let dateKey = emptyKeys[0]!;
  if (
    input.preferredDateKey &&
    emptyKeys.includes(input.preferredDateKey)
  ) {
    dateKey = input.preferredDateKey;
  } else {
    dateKey = emptyKeys[Math.floor(Math.random() * emptyKeys.length)]!;
  }

  const assignment: Assignment = {
    am: themePark.id,
    pm: themePark.id,
    lunch: lunch.id,
    dinner: dinner.id,
  };

  return { dateKey, assignment };
}
