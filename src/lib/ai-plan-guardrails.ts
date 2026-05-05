import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { formatDateKey, parseDate } from "@/lib/date-helpers";
import { isCruisePaletteTileName } from "@/lib/cruise-tiles";
import { THEME_PARK_GROUP_SET } from "@/lib/park-categories";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import { tripProfileAllowsStructuralMealSlots } from "@/lib/trip-intelligence";
import type {
  Assignment,
  Assignments,
  Park,
  Trip,
  TripIntelligenceMealPreference,
} from "@/lib/types";

const DINING_IDS = new Set(["owl", "tsr", "char", "specd", "villa"]);
const FLYOUT_IDS = new Set(["flyout"]);
const FLYHOME_IDS = new Set(["flyhome"]);

const MAIN_PARK_GROUPS = THEME_PARK_GROUP_SET;

/** Tiles that only make sense when the trip includes a cruise segment. */
export function requiresCruiseSegment(p: Park): boolean {
  if (p.park_group === "excursions") return true;
  if (isCruisePaletteTileName(p.name)) return true;
  return false;
}

function cloneDaySlots(day: Assignment): Assignment {
  return { ...day };
}

function cloneAssignments(a: Assignments): Assignments {
  const out: Assignments = {};
  for (const [k, v] of Object.entries(a)) {
    out[k] = cloneDaySlots(v);
  }
  return out;
}

function sortTripDateKeys(keys: string[]): string[] {
  return [...keys].sort(
    (a, b) =>
      parseDate(keyToIsoForParse(a)).getTime() -
      parseDate(keyToIsoForParse(b)).getTime(),
  );
}

export function sortDateKeysFromSet(keys: Set<string>): string[] {
  return sortTripDateKeys([...keys]);
}

/** Normalize YYYY-M-D keys for parseDate (expects yyyy-mm-dd with padding). */
function keyToIsoForParse(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dayKeyTime(key: string): number {
  return parseDate(keyToIsoForParse(key)).getTime();
}

function stripFlyFromDay(
  day: Assignment,
  stripFlyout: boolean,
  stripFlyhome: boolean,
): void {
  const slots: ("am" | "pm" | "lunch" | "dinner")[] = [
    "am",
    "pm",
    "lunch",
    "dinner",
  ];
  for (const s of slots) {
    const id = getParkIdFromSlotValue(day[s]);
    if (!id) continue;
    if (stripFlyout && FLYOUT_IDS.has(id)) delete day[s];
    if (stripFlyhome && FLYHOME_IDS.has(id)) delete day[s];
  }
}

/**
 * Fly Out only on first day; Fly Home only on last day; never both on the same day
 * unless the trip is a single day.
 */
export function applyFlyBookendRules(
  assignments: Assignments,
  sortedDateKeys: string[],
): Assignments {
  const out = cloneAssignments(assignments);
  if (sortedDateKeys.length === 0) return out;

  const first = sortedDateKeys[0];
  const last = sortedDateKeys[sortedDateKeys.length - 1];
  const singleDay = first === last;

  for (const dayKey of sortedDateKeys) {
    const day = out[dayKey];
    if (!day) continue;

    if (singleDay) {
      let flyouts = 0;
      let flyhomes = 0;
      for (const s of ["am", "pm", "lunch", "dinner"] as const) {
        const id = getParkIdFromSlotValue(day[s]);
        if (id && FLYOUT_IDS.has(id)) flyouts++;
        if (id && FLYHOME_IDS.has(id)) flyhomes++;
      }
      if (flyouts > 1 || flyhomes > 1) {
        let seenO = false;
        let seenH = false;
        for (const s of ["am", "pm", "lunch", "dinner"] as const) {
          const id = getParkIdFromSlotValue(day[s]);
          if (id && FLYOUT_IDS.has(id)) {
            if (seenO) delete day[s];
            else seenO = true;
          }
          if (id && FLYHOME_IDS.has(id)) {
            if (seenH) delete day[s];
            else seenH = true;
          }
        }
      }
      continue;
    }

    if (dayKey === first) {
      stripFlyFromDay(day, false, true);
      let seenFlyout = false;
      for (const s of ["am", "pm", "lunch", "dinner"] as const) {
        const id = getParkIdFromSlotValue(day[s]);
        if (id && FLYOUT_IDS.has(id)) {
          if (seenFlyout) delete day[s];
          else seenFlyout = true;
        }
      }
    } else if (dayKey === last) {
      stripFlyFromDay(day, true, false);
      let seenFlyhome = false;
      for (const s of ["am", "pm", "lunch", "dinner"] as const) {
        const id = getParkIdFromSlotValue(day[s]);
        if (id && FLYHOME_IDS.has(id)) {
          if (seenFlyhome) delete day[s];
          else seenFlyhome = true;
        }
      }
    } else {
      stripFlyFromDay(day, true, true);
    }
  }

  return out;
}

function cruiseWindowKeys(trip: Trip): { start: string; end: string } | null {
  if (!trip.has_cruise || !trip.cruise_embark || !trip.cruise_disembark) {
    return null;
  }
  const start = formatDateKey(parseDate(trip.cruise_embark));
  const end = formatDateKey(parseDate(trip.cruise_disembark));
  return { start, end };
}

export function stripCruiseOnlyTiles(
  assignments: Assignments,
  trip: Trip,
  parksById: Map<string, Park>,
): Assignments {
  const out = cloneAssignments(assignments);
  const window = cruiseWindowKeys(trip);

  for (const dayKey of Object.keys(out)) {
    const day = out[dayKey];
    if (!day) continue;

    for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
      const id = getParkIdFromSlotValue(day[slot]);
      if (!id) continue;
      const p = parksById.get(id);
      if (!p || !requiresCruiseSegment(p)) continue;

      if (!trip.has_cruise) {
        delete day[slot];
        continue;
      }

      if (!window) {
        delete day[slot];
        continue;
      }

      const t = dayKeyTime(dayKey);
      if (
        t < dayKeyTime(window.start) ||
        t > dayKeyTime(window.end)
      ) {
        delete day[slot];
      }
    }
  }

  return out;
}

function isMainVenuePark(p: Park): boolean {
  return MAIN_PARK_GROUPS.has(p.park_group);
}

/**
 * First calendar day is arrival: no full theme/water parks in AM/PM (only fly
 * tiles, dining codes, rest/shopping, etc.). Fixes model text vs slots mismatch
 * and preserves-merge leaving an old park on day 1.
 */
export function applyArrivalDayNoThemeParks(
  assignments: Assignments,
  sortedDateKeys: string[],
  parksById: Map<string, Park>,
): Assignments {
  if (sortedDateKeys.length <= 1) return cloneAssignments(assignments);

  const out = cloneAssignments(assignments);
  const first = sortedDateKeys[0];
  const day = out[first];
  if (!day) return out;

  for (const s of ["am", "pm"] as const) {
    const id = getParkIdFromSlotValue(day[s]);
    if (!id) continue;
    if (DINING_IDS.has(id) || FLYOUT_IDS.has(id) || FLYHOME_IDS.has(id)) {
      continue;
    }
    const p = parksById.get(id);
    if (p && isMainVenuePark(p)) delete day[s];
  }

  if (Object.keys(day).length === 0) delete out[first];
  else out[first] = day;

  return out;
}

function isRestfulTile(p: Park): boolean {
  const n = p.name.toLowerCase();
  if (/\brest\s*[/&]\s*pool\b|\brest\s*day\b|\blazy\s*day\b/i.test(n)) return true;
  if (/\bpool\b|\bspa\b|shopping|outlet|resort\s*grounds|hotel\s*day/i.test(n)) {
    return true;
  }
  if (p.park_group === "activities") {
    if (/\brest\b|\bpool\b|spa|shopping|outlet/i.test(n)) return true;
  }
  return false;
}

/** If any AM/PM slot is a rest/pool style tile, remove headline parks from AM/PM the same day. */
export function applyRestDayConsistency(
  assignments: Assignments,
  parksById: Map<string, Park>,
): Assignments {
  const out = cloneAssignments(assignments);

  for (const dayKey of Object.keys(out)) {
    const day = out[dayKey];
    if (!day) continue;

    const amPmSlots = ["am", "pm"] as const;
    let hasRest = false;
    for (const s of amPmSlots) {
      const id = getParkIdFromSlotValue(day[s]);
      if (!id) continue;
      const p = parksById.get(id);
      if (p && isRestfulTile(p)) hasRest = true;
    }

    if (!hasRest) continue;

    for (const s of amPmSlots) {
      const id = getParkIdFromSlotValue(day[s]);
      if (!id) continue;
      const p = parksById.get(id);
      if (p && isMainVenuePark(p)) delete day[s];
    }
  }

  return out;
}

/**
 * No duplicate main-venue park ID on AM/PM across consecutive calendar days.
 * Clears conflicting slots on the later day (PM first, then AM).
 */
export function applyConsecutiveParkRules(
  assignments: Assignments,
  sortedDateKeys: string[],
  parksById: Map<string, Park>,
): Assignments {
  const out = cloneAssignments(assignments);

  function venueIdsForDay(day: Assignment): Set<string> {
    const set = new Set<string>();
    for (const s of ["am", "pm"] as const) {
      const id = getParkIdFromSlotValue(day[s]);
      if (!id) continue;
      if (DINING_IDS.has(id) || FLYOUT_IDS.has(id) || FLYHOME_IDS.has(id)) {
        continue;
      }
      const p = parksById.get(id);
      if (p && isMainVenuePark(p)) set.add(id);
    }
    return set;
  }

  for (let i = 0; i < sortedDateKeys.length - 1; i++) {
    const d1 = sortedDateKeys[i];
    const d2 = sortedDateKeys[i + 1];
    const day1 = out[d1];
    const day2 = out[d2];
    if (!day1 || !day2) continue;

    const v1 = venueIdsForDay(day1);
    const dup = [...venueIdsForDay(day2)].filter((id) => v1.has(id));
    if (dup.length === 0) continue;

    for (const badId of dup) {
      for (const s of ["pm", "am"] as const) {
        if (getParkIdFromSlotValue(day2[s]) === badId) {
          delete day2[s];
          break;
        }
      }
    }
  }

  return out;
}

function pruneEmptyDays(assignments: Assignments): Assignments {
  const out: Assignments = {};
  for (const [k, v] of Object.entries(assignments)) {
    if (v && Object.keys(v).length > 0) out[k] = v;
  }
  return out;
}

function classifyTableStructuralDining(
  slotId: string | undefined,
  parksById: Map<string, Park>,
): boolean {
  if (!slotId) return false;
  if (slotId === "tsr" || slotId === "char" || slotId === "villa") return true;
  const p = parksById.get(slotId);
  return p ? isNamedRestaurantPark(p) : false;
}

function classifyQuickStructural(slotId: string | undefined): boolean {
  return slotId === "owl" || slotId === "specd";
}

function isStructuralSmartPlanMealSlot(
  slotId: string | undefined,
  parksById: Map<string, Park>,
): boolean {
  if (!slotId) return false;
  if (DINING_IDS.has(slotId)) return true;
  const p = parksById.get(slotId);
  return p ? isNamedRestaurantPark(p) : false;
}

function dayHasFlyTravelTile(day: Assignment | undefined): boolean {
  if (!day) return false;
  for (const s of ["am", "pm", "lunch", "dinner"] as const) {
    const id = getParkIdFromSlotValue(day[s]);
    if (id && (FLYOUT_IDS.has(id) || FLYHOME_IDS.has(id))) return true;
  }
  return false;
}

/** Both AM & PM tiles are headline theme parks → high-stamina park day. */
function isFullMainVenueParkPairDay(
  day: Assignment | undefined,
  parksById: Map<string, Park>,
): boolean {
  const amId = getParkIdFromSlotValue(day?.am);
  const pmId = getParkIdFromSlotValue(day?.pm);
  const pa = amId ? parksById.get(amId) : undefined;
  const pb = pmId ? parksById.get(pmId) : undefined;
  return Boolean(
    pa &&
      MAIN_PARK_GROUPS.has(pa.park_group) &&
      pb &&
      MAIN_PARK_GROUPS.has(pb.park_group),
  );
}

/** Rest / springs / softer days — better candidates for sparing table-service use. */
function sitDownFriendlyDay(
  day: Assignment | undefined,
  parksById: Map<string, Park>,
): boolean {
  if (!day) return false;
  if (isFullMainVenueParkPairDay(day, parksById)) return false;
  return true;
}

function isModelStructuralMealSlot(
  dk: string,
  slot: "lunch" | "dinner",
  out: Assignments,
  prior: Assignments,
  preserveExistingSlots: boolean,
): boolean {
  const mergedId = getParkIdFromSlotValue(out[dk]?.[slot]);
  if (!mergedId) return false;
  if (!preserveExistingSlots) return true;
  const prevId = getParkIdFromSlotValue(prior[dk]?.[slot]);
  return !prevId;
}

/**
 * Lighter structural meal tiling for profiles that consent to QS/TS, without
 * day-strategy sequencing.
 *
 * — `mixed`: cap ~2–4 table-style placements per trip, thin QS on heavy park days,
 *   strip fly travel days unless the slot was guest-locked (preserve mode).
 * — `quick_service`: drop table structural tiles the model inferred.
 */
export function rebalanceStructuralMealsForProfile(params: {
  merged: Assignments;
  prior: Assignments;
  mealPreference: TripIntelligenceMealPreference | null | undefined;
  parksById: Map<string, Park>;
  preserveExistingSlots: boolean;
  sortedTripDateKeys: string[];
}): Assignments {
  const {
    merged,
    prior,
    mealPreference,
    parksById,
    preserveExistingSlots,
    sortedTripDateKeys,
  } = params;
  const pref = mealPreference;
  const takesStructural =
    pref === "mixed" ||
    pref === "quick_service" ||
    pref === "table_service" ||
    pref === "snacks";
  if (!takesStructural) return merged;

  const out = cloneAssignments(merged);

  /** Fly days — omit automatic structural meals everywhere this applies. */
  for (const dk of sortedTripDateKeys) {
    const day = out[dk];
    if (!day || !dayHasFlyTravelTile(day)) continue;
    for (const slot of ["lunch", "dinner"] as const) {
      const id = getParkIdFromSlotValue(day[slot]);
      if (!id || !isStructuralSmartPlanMealSlot(id, parksById)) continue;
      if (!isModelStructuralMealSlot(dk, slot, out, prior, preserveExistingSlots))
        continue;
      delete day[slot];
    }
    if (Object.keys(day).length === 0) delete out[dk];
  }

  /** quick_service preference never fabricates TS / signature dining tiles. */
  if (pref === "quick_service") {
    for (const dk of sortedTripDateKeys) {
      const day = out[dk];
      if (!day) continue;
      for (const slot of ["lunch", "dinner"] as const) {
        const id = getParkIdFromSlotValue(day[slot]);
        if (
          !id ||
          !classifyTableStructuralDining(id, parksById) ||
          !isModelStructuralMealSlot(dk, slot, out, prior, preserveExistingSlots)
        ) {
          continue;
        }
        delete day[slot];
      }
      if (Object.keys(day).length === 0) delete out[dk];
    }
    return pruneEmptyDays(out);
  }

  if (pref !== "mixed") return pruneEmptyDays(out);

  const calendarSpan = sortedTripDateKeys.length;
  const maxTableTouches = Math.min(
    4,
    Math.max(2, Math.round(calendarSpan / 5) || 2),
  );

  type Tagged = {
    dk: string;
    score: number;
  };
  const tableDinnerTags: Tagged[] = [];
  for (const dk of sortedTripDateKeys) {
    const day = out[dk];
    if (!day) continue;
    const id = getParkIdFromSlotValue(day.dinner);
    if (
      !id ||
      !classifyTableStructuralDining(id, parksById) ||
      !isModelStructuralMealSlot(dk, "dinner", out, prior, preserveExistingSlots)
    ) {
      continue;
    }
    const sd = sitDownFriendlyDay(day, parksById) ? 2 : 0;
    tableDinnerTags.push({ dk, score: sd });
  }

  if (tableDinnerTags.length > maxTableTouches) {
    tableDinnerTags.sort((a, b) => a.score - b.score || a.dk.localeCompare(b.dk));
    const dropCount = tableDinnerTags.length - maxTableTouches;
    for (let i = 0; i < dropCount; i++) {
      const { dk } = tableDinnerTags[i]!;
      const day = out[dk];
      if (!day?.dinner) continue;
      if (
        isModelStructuralMealSlot(dk, "dinner", out, prior, preserveExistingSlots)
      ) {
        delete day.dinner;
        if (Object.keys(day).length === 0) delete out[dk];
      }
    }
  }

  /** Remove speculative table lunches on full park-stamina days. */
  for (const dk of sortedTripDateKeys) {
    const day = out[dk];
    if (!day || !isFullMainVenueParkPairDay(day, parksById)) continue;
    const lid = getParkIdFromSlotValue(day.lunch);
    if (
      lid &&
      classifyTableStructuralDining(lid, parksById) &&
      isModelStructuralMealSlot(dk, "lunch", out, prior, preserveExistingSlots)
    ) {
      delete day.lunch;
      if (Object.keys(day).length === 0) delete out[dk];
    }
  }

  const fullParkDays = sortedTripDateKeys.filter((dk) =>
    isFullMainVenueParkPairDay(out[dk], parksById),
  );
  const fpCount = fullParkDays.length;
  const owlCap =
    fpCount === 0 ? 0 : Math.min(fpCount, Math.max(2, Math.ceil(fpCount * 0.55)));
  const owlLunches: string[] = [];
  for (const dk of sortedTripDateKeys) {
    const day = out[dk];
    if (
      !day ||
      !isFullMainVenueParkPairDay(day, parksById) ||
      !classifyQuickStructural(getParkIdFromSlotValue(day.lunch))
    )
      continue;
    if (
      !isModelStructuralMealSlot(dk, "lunch", out, prior, preserveExistingSlots)
    )
      continue;
    owlLunches.push(dk);
  }

  while (owlLunches.length > owlCap) {
    const dk = owlLunches.pop();
    if (!dk) break;
    const day = out[dk];
    if (!day?.lunch) continue;
    delete day.lunch;
    if (Object.keys(day).length === 0) delete out[dk];
  }

  return pruneEmptyDays(out);
}

/**
 * Drops generic QS/TS tiles and bespoke named-restaurant placements when the
 * trip profile does not consent to structured meal scheduling.
 */
export function stripStructuralMealSlotsWhenDeclined(params: {
  merged: Assignments;
  prior: Assignments;
  mealPreference: TripIntelligenceMealPreference | null | undefined;
  parksById: Map<string, Park>;
  preserveExistingSlots: boolean;
}): Assignments {
  const { merged, prior, mealPreference, parksById, preserveExistingSlots } =
    params;
  if (tripProfileAllowsStructuralMealSlots(mealPreference)) return merged;

  const out = cloneAssignments(merged);
  for (const [dk, day] of Object.entries(out)) {
    if (!day) continue;
    for (const slot of ["lunch", "dinner"] as const) {
      const mid = getParkIdFromSlotValue(day[slot]);
      if (!mid || !isStructuralSmartPlanMealSlot(mid, parksById)) continue;

      const prevId = getParkIdFromSlotValue(prior[dk]?.[slot]);
      if (!preserveExistingSlots) {
        delete day[slot];
        continue;
      }
      if (!prevId) delete day[slot];
    }
    if (Object.keys(day).length === 0) delete out[dk];
  }

  return pruneEmptyDays(out);
}

export type GuardrailContext = {
  trip: Trip;
  parksById: Map<string, Park>;
  /** Sorted ascending, same format as assignment keys (Y-M-D). */
  sortedDateKeys: string[];
};

/** Deterministic cleanup after model JSON — keeps calendar consistent even if the model drifts. */
export function enforceAiPlanGuardrails(
  assignments: Assignments,
  ctx: GuardrailContext,
): Assignments {
  let a = assignments;
  a = applyFlyBookendRules(a, ctx.sortedDateKeys);
  a = stripCruiseOnlyTiles(a, ctx.trip, ctx.parksById);
  a = applyConsecutiveParkRules(a, ctx.sortedDateKeys, ctx.parksById);
  a = applyRestDayConsistency(a, ctx.parksById);
  a = applyArrivalDayNoThemeParks(a, ctx.sortedDateKeys, ctx.parksById);
  return pruneEmptyDays(a);
}
