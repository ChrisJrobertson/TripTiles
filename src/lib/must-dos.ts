import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import type {
  ParkMustDo,
  ParkMustDoTiming,
  TripMustDosMap,
} from "@/types/must-dos";
import type { Assignments } from "@/lib/types";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { SlotType } from "@/lib/types";

const TIMINGS = new Set<ParkMustDoTiming>([
  "rope_drop",
  "morning",
  "midday",
  "afternoon",
  "evening",
]);

const SLOT_ORDER: SlotType[] = ["am", "pm", "lunch", "dinner"];

export function newMustDoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `md_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function parseTiming(raw: unknown): ParkMustDoTiming | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/-/g, "_") as ParkMustDoTiming;
  return TIMINGS.has(t) ? t : null;
}

export function timingPillLabel(t: ParkMustDoTiming): string {
  switch (t) {
    case "rope_drop":
      return "🌅 Rope drop";
    case "morning":
      return "Morning";
    case "midday":
      return "Midday";
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
    default:
      return t;
  }
}

export function sanitizeWhyLine(raw: string): string {
  const t = sanitizeDayNote(raw.trim().slice(0, 200));
  return t.length > 120 ? t.slice(0, 120).trim() : t;
}

/**
 * Parse and validate must-dos from model JSON. Ensures ids and allowed timings.
 */
export function normaliseMustDoItems(raw: unknown): ParkMustDo[] {
  if (!Array.isArray(raw)) return [];
  const out: ParkMustDo[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const timing = parseTiming(o.timing) ?? "morning";
    const why = typeof o.why === "string" ? sanitizeWhyLine(o.why) : "";
    const id =
      typeof o.id === "string" && o.id.trim() ? o.id.trim() : newMustDoId();
    const done = o.done === true;
    out.push({ id, title, timing, why, done });
    if (out.length >= 8) break;
  }
  return out.slice(0, 6);
}

/**
 * Map top-level `must_dos` from the Smart Plan JSON into a safe structure.
 */
export function parseMustDosMapFromAI(
  raw: unknown,
  allowedDateKeys: Set<string>,
  allowedParkIds: Set<string>,
): TripMustDosMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const top = raw as Record<string, unknown>;
  const out: TripMustDosMap = {};
  for (const [dateKey, byPark] of Object.entries(top)) {
    if (!allowedDateKeys.has(dateKey)) continue;
    if (!byPark || typeof byPark !== "object" || Array.isArray(byPark)) {
      continue;
    }
    const parkMap: Record<string, ParkMustDo[]> = {};
    for (const [parkId, items] of Object.entries(
      byPark as Record<string, unknown>,
    )) {
      if (!allowedParkIds.has(parkId)) continue;
      const list = normaliseMustDoItems(items);
      if (list.length > 0) parkMap[parkId] = list;
    }
    if (Object.keys(parkMap).length > 0) out[dateKey] = parkMap;
  }
  return out;
}

export function mergeMustDosMap(
  base: TripMustDosMap,
  incoming: TripMustDosMap,
): TripMustDosMap {
  const out: TripMustDosMap = { ...base };
  for (const [d, byPark] of Object.entries(incoming)) {
    out[d] = { ...(out[d] ?? {}), ...byPark };
  }
  return out;
}

export function getParkIdsForDay(
  ass: Assignments,
  dateKey: string,
): string[] {
  const day = ass[dateKey] ?? {};
  const ids: string[] = [];
  for (const slot of SLOT_ORDER) {
    const id = getParkIdFromSlotValue(day[slot]);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

export function readMustDosMap(
  preferences: Record<string, unknown> | null | undefined,
): TripMustDosMap {
  const m = preferences?.must_dos;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return m as TripMustDosMap;
}

export function getMustDosForDayPark(
  map: TripMustDosMap,
  dateKey: string,
  parkId: string,
): ParkMustDo[] {
  return map[dateKey]?.[parkId] ?? [];
}

/** Keep only must-dos for parks that appear in that day's calendar slots. */
export function filterMustDosToAssignedParks(
  map: TripMustDosMap,
  assignments: Assignments,
  dateAllow: Set<string>,
): TripMustDosMap {
  const out: TripMustDosMap = {};
  for (const dateKey of Object.keys(map)) {
    if (!dateAllow.has(dateKey)) continue;
    const allowed = new Set(getParkIdsForDay(assignments, dateKey));
    const byPark = map[dateKey];
    if (!byPark) continue;
    const next: Record<string, ParkMustDo[]> = {};
    for (const [pid, items] of Object.entries(byPark)) {
      if (allowed.has(pid) && items.length > 0) next[pid] = items;
    }
    if (Object.keys(next).length > 0) out[dateKey] = next;
  }
  return out;
}
