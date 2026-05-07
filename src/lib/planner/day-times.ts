import { eachDateKeyInRange } from "@/lib/date-helpers";
import { dominantThemeParkForAssignments } from "@/lib/dominant-theme-park";
import type { Park, Trip } from "@/lib/types";

/** Per-day guest window at the park (stored under `trips.preferences.day_times`). */
export type DayTimes = { arrival?: string; departure?: string };

export type DayTimesByDate = Record<string, DayTimes>;

export type EffectiveDayWindowSource = "user" | "park" | "default";

export type EffectiveDayWindow = {
  start: string;
  end: string;
  source: EffectiveDayWindowSource;
};

const HHMM = /^(\d{1,2}):(\d{2})$/;

/** Typical theme-park day when DB has no official hours (catalogue gap). */
export const SYNTHETIC_THEME_PARK_HOURS = {
  open: "09:00",
  close: "22:00",
} as const;

/** Travel / rest / non-park days — generous window so AI does not over-constrain. */
export const NON_PARK_DAY_WINDOW = {
  open: "06:00",
  close: "23:59",
} as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse "HH:mm" to minutes from midnight; allows hour 24–26 for late shows. */
export function dayTimeToMinutes(hhmm: string): number | null {
  const m = hhmm.trim().match(HHMM);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (min < 0 || min > 59) return null;
  if (h < 0 || h > 26) return null;
  return h * 60 + min;
}

export function minutesToDayTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad2(Math.min(26, h))}:${pad2(m)}`;
}

/**
 * Validates a single time string. Rules: `06:00` ≤ t ≤ `26:00` (minute 00 only for h>24 optional).
 */
export function isValidDayTimeString(t: string | undefined | null): boolean {
  if (t == null || !String(t).trim()) return true;
  const s = String(t).trim();
  const mins = dayTimeToMinutes(s);
  if (mins == null) return false;
  const minAllowed = 6 * 60;
  const maxAllowed = 26 * 60;
  return mins >= minAllowed && mins <= maxAllowed;
}

export type DayTimesValidation =
  | { ok: true }
  | { ok: false; message: string };

/** When both set, require arrival < departure (same calendar day / extended evening). */
export function validateDayTimesPair(
  arrival: string | undefined | null,
  departure: string | undefined | null,
): DayTimesValidation {
  const a = arrival?.trim() ?? "";
  const d = departure?.trim() ?? "";
  if (!a && !d) return { ok: true };
  if (a && !isValidDayTimeString(a)) {
    return { ok: false, message: "Arrival must be a valid time (06:00–26:00)." };
  }
  if (d && !isValidDayTimeString(d)) {
    return {
      ok: false,
      message: "Departure must be a valid time (06:00–26:00).",
    };
  }
  if (a && d) {
    const ma = dayTimeToMinutes(a);
    const md = dayTimeToMinutes(d);
    if (ma != null && md != null && ma >= md) {
      return {
        ok: false,
        message: "Arrival must be before departure.",
      };
    }
  }
  return { ok: true };
}

export function readDayTimesMap(prefs: Trip["preferences"]): DayTimesByDate {
  const raw = prefs && typeof prefs === "object" && !Array.isArray(prefs)
    ? (prefs as Record<string, unknown>).day_times
    : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DayTimesByDate = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const arrival =
      typeof o.arrival === "string" ? o.arrival.trim() : undefined;
    const departure =
      typeof o.departure === "string" ? o.departure.trim() : undefined;
    const row: DayTimes = {};
    if (arrival) row.arrival = arrival;
    if (departure) row.departure = departure;
    if (row.arrival || row.departure) out[k] = row;
  }
  return out;
}

export function getDayTimes(
  trip: Trip,
  isoDate: string,
): DayTimes | null {
  const m = readDayTimesMap(trip.preferences);
  return m[isoDate] ?? null;
}

/** Merge `day_times` date key; omit empty object to clear. */
export function setDayTimesInPreferences(
  prefs: Record<string, unknown> | null | undefined,
  isoDate: string,
  times: DayTimes | null,
): Record<string, unknown> {
  const base =
    prefs && typeof prefs === "object" && !Array.isArray(prefs)
      ? { ...prefs }
      : {};
  const prevMap = readDayTimesMap(base as Trip["preferences"]);
  const nextMap: DayTimesByDate = { ...prevMap };
  if (
    !times ||
    (!times.arrival?.trim() && !times.departure?.trim())
  ) {
    delete nextMap[isoDate];
  } else {
    const row: DayTimes = {};
    if (times.arrival?.trim()) row.arrival = times.arrival.trim();
    if (times.departure?.trim()) row.departure = times.departure.trim();
    nextMap[isoDate] = row;
  }
  if (Object.keys(nextMap).length === 0) {
    const rest = { ...base };
    delete (rest as { day_times?: unknown }).day_times;
    return rest;
  }
  return { ...base, day_times: nextMap };
}

/**
 * Patch for `updateTripPreferencesPatchAction` — shallow-merge `{ day_times }`.
 * Empty map clears stored overrides for all dates in JSON (same as omitting entries).
 */
export function buildDayTimesPreferencesPatch(
  prevPrefs: Trip["preferences"],
  isoDate: string,
  times: DayTimes | null,
): { day_times: DayTimesByDate } {
  const merged = setDayTimesInPreferences(
    prevPrefs as Record<string, unknown>,
    isoDate,
    times,
  );
  return { day_times: readDayTimesMap(merged as Trip["preferences"]) };
}

/** Short hint under arrival/departure fields in planner UI. */
export function defaultDayTimesFormHint(): string {
  return "Leave blank to use typical theme-park hours (09:00–22:00), AI timeline hours when present, or a full-day window on non-park days.";
}

function timelineParkHoursForDate(
  prefs: Trip["preferences"],
  isoDate: string,
): { open: string; close: string } | null {
  const raw = prefs && typeof prefs === "object" && !Array.isArray(prefs)
    ? (prefs as Record<string, unknown>).ai_day_timeline
    : undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const day = (raw as Record<string, unknown>)[isoDate];
  if (!day || typeof day !== "object" || Array.isArray(day)) return null;
  const ph = (day as Record<string, unknown>).park_hours;
  if (!ph || typeof ph !== "object") return null;
  const open = (ph as { open?: unknown }).open;
  const close = (ph as { close?: unknown }).close;
  if (typeof open !== "string" || typeof close !== "string") return null;
  if (!isValidDayTimeString(open) || !isValidDayTimeString(close)) return null;
  const o = dayTimeToMinutes(open);
  const c = dayTimeToMinutes(close);
  if (o == null || c == null || o >= c) return null;
  return { open: open.trim(), close: close.trim() };
}

/** Resolve primary park for hours hint (theme park tile if any). */
export function primaryParkForDayWindow(
  trip: Trip,
  isoDate: string,
  parkById: ReadonlyMap<string, Park>,
): Park | null {
  return dominantThemeParkForAssignments(
    trip.assignments,
    isoDate,
    parkById as Map<string, Park>,
  );
}

/**
 * Effective in-park window: user overrides → optional last AI timeline hours →
 * synthetic theme-park 09–22 → non-park full day.
 */
export function getEffectiveDayWindow(
  trip: Trip,
  isoDate: string,
  parkById: ReadonlyMap<string, Park>,
): EffectiveDayWindow {
  const user = getDayTimes(trip, isoDate);
  const tl = timelineParkHoursForDate(trip.preferences, isoDate);
  const primary = primaryParkForDayWindow(trip, isoDate, parkById);
  const nonPark = primary == null;
  const syn = nonPark ? NON_PARK_DAY_WINDOW : SYNTHETIC_THEME_PARK_HOURS;

  let baseOpen: string = syn.open;
  let baseClose: string = syn.close;
  let baseSource: EffectiveDayWindowSource = nonPark ? "default" : "park";

  if (tl && !nonPark) {
    baseOpen = tl.open;
    baseClose = tl.close;
    baseSource = "park";
  }

  const ua = user?.arrival?.trim();
  const ud = user?.departure?.trim();

  if (ua || ud) {
    const start = ua ?? baseOpen;
    const end = ud ?? baseClose;
    const sm = dayTimeToMinutes(start);
    const em = dayTimeToMinutes(end);
    if (sm != null && em != null && sm < em) {
      return { start, end, source: "user" };
    }
  }

  return { start: baseOpen, end: baseClose, source: baseSource };
}

/** Helper line for UI: "09:00–22:00" */
export function formatWindowLabel(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function minutesBetweenHHmm(start: string, end: string): number | null {
  const a = dayTimeToMinutes(start);
  const b = dayTimeToMinutes(end);
  if (a == null || b == null || b <= a) return null;
  return b - a;
}

/** Multi-line block for Smart Plan user message (full trip). */
export function formatDayConstraintsBlockForSmartPlan(
  trip: Trip,
  parkById: ReadonlyMap<string, Park>,
): string {
  const lines: string[] = [
    "DAY AT-PARK CONSTRAINTS (hard — do not schedule guest activities outside these windows; treat as not in-park before start or after end):",
  ];
  for (const dk of eachDateKeyInRange(trip.start_date, trip.end_date)) {
    const w = getEffectiveDayWindow(trip, dk, parkById);
    const src =
      w.source === "user"
        ? "user-set"
        : w.source === "park"
          ? "typical-park-day-fallback-or-prior-AI-timeline-hours"
          : "full-day-fallback-non-theme-park-day";
    lines.push(
      `- ${dk}: arrival at park ${w.start}, departure from park ${w.end} (source: ${src}).`,
    );
  }
  lines.push(
    "If departure is before typical evening shows or fireworks, omit them or suggest another night. If the window is under ~4 hours at a theme park, prioritise top must-rides with efficient routing.",
  );
  return lines.join("\n");
}

/** Single-day block for timeline / strategy prompts. */
export function formatDayConstraintBlockForDate(
  trip: Trip,
  dateKey: string,
  parkById: ReadonlyMap<string, Park>,
): string {
  const w = getEffectiveDayWindow(trip, dateKey, parkById);
  const src =
    w.source === "user"
      ? "user-set"
      : w.source === "park"
        ? "typical-park-day-fallback-or-prior-AI-timeline-hours"
        : "full-day-fallback-non-theme-park-day";
  return [
    "DAY CONSTRAINTS — HARD RULES:",
    `Arrival at park: ${w.start}`,
    `Departure from park: ${w.end}`,
    `Source: ${src}`,
    "",
    "Do not schedule any activity before arrival or after departure. If departure is before typical fireworks or evening spectaculars, omit them or note catching them another night. If the in-park window is under ~4 hours, prioritise the guest's top must-rides with efficient routing.",
  ].join("\n");
}
