export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** @deprecated Use {@link formatDateISO} for planner keys and SQL dates (zero-padded `YYYY-MM-DD`). */
export function formatDateKey(d: Date): string {
  return formatDateISO(d);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Monday of the calendar week containing `d` (local time). */
export function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = copy.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

/** Sunday of the calendar week containing `d` (local time). */
export function endOfWeekSunday(d: Date): Date {
  const mon = startOfWeekMonday(d);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return sun;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Inclusive list of planner date keys between trip dates. */
export function eachDateKeyInRange(startIso: string, endIso: string): string[] {
  const a = parseDate(startIso);
  const b = parseDate(endIso);
  const out: string[] = [];
  for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
    out.push(formatDateISO(d));
  }
  return out;
}

/** Tooltip copy for Smart Plan undo (UK-style time when older than ~24h). */
export function formatUndoSnapshotHint(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "last generation";
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return min <= 1 ? "1 minute ago" : `${min} minutes ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  }
  const days = Math.floor(hr / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
