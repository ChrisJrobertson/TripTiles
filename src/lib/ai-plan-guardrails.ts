import { formatDateKey, parseDate } from "@/lib/date-helpers";
import type { Assignments, Park, Trip } from "@/lib/types";

const DINING_IDS = new Set(["owl", "tsr", "char", "specd", "villa"]);
const FLYOUT_IDS = new Set(["flyout"]);
const FLYHOME_IDS = new Set(["flyhome"]);

const MAIN_PARK_GROUPS = new Set([
  "disney",
  "disneyextra",
  "universal",
  "seaworld",
  "attractions",
]);

/** Tiles that only make sense when the trip includes a cruise segment. */
export function requiresCruiseSegment(p: Park): boolean {
  if (p.park_group === "excursions") return true;
  const n = p.name.toLowerCase();
  if (/\bship\s*pool\b|\bat\s*sea\b|\bport\s*day\b|cruise\s*[—–-]\s*at\s*sea/i.test(n)) {
    return true;
  }
  if (/cruise\s*[—–-]\s*(embark|disembark)/i.test(n)) return true;
  return false;
}

function cloneDaySlots(
  day: Partial<Record<"am" | "pm" | "lunch" | "dinner", string>>,
): Partial<Record<"am" | "pm" | "lunch" | "dinner", string>> {
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
  day: Partial<Record<"am" | "pm" | "lunch" | "dinner", string>>,
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
    const v = day[s];
    if (!v) continue;
    if (stripFlyout && FLYOUT_IDS.has(v)) delete day[s];
    if (stripFlyhome && FLYHOME_IDS.has(v)) delete day[s];
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
        const v = day[s];
        if (v && FLYOUT_IDS.has(v)) flyouts++;
        if (v && FLYHOME_IDS.has(v)) flyhomes++;
      }
      if (flyouts > 1 || flyhomes > 1) {
        let seenO = false;
        let seenH = false;
        for (const s of ["am", "pm", "lunch", "dinner"] as const) {
          const v = day[s];
          if (v && FLYOUT_IDS.has(v)) {
            if (seenO) delete day[s];
            else seenO = true;
          }
          if (v && FLYHOME_IDS.has(v)) {
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
        const v = day[s];
        if (v && FLYOUT_IDS.has(v)) {
          if (seenFlyout) delete day[s];
          else seenFlyout = true;
        }
      }
    } else if (dayKey === last) {
      stripFlyFromDay(day, true, false);
      let seenFlyhome = false;
      for (const s of ["am", "pm", "lunch", "dinner"] as const) {
        const v = day[s];
        if (v && FLYHOME_IDS.has(v)) {
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
      const id = day[slot];
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
      const id = day[s];
      if (!id) continue;
      const p = parksById.get(id);
      if (p && isRestfulTile(p)) hasRest = true;
    }

    if (!hasRest) continue;

    for (const s of amPmSlots) {
      const id = day[s];
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

  function venueIdsForDay(
    day: Partial<Record<"am" | "pm" | "lunch" | "dinner", string>>,
  ): Set<string> {
    const set = new Set<string>();
    for (const s of ["am", "pm"] as const) {
      const id = day[s];
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
        if (day2[s] === badId) {
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
  return pruneEmptyDays(a);
}
