import type {
  Assignment,
  Assignments,
  SlotAssignmentValue,
  SlotType,
} from "@/lib/types";

/** Optional per-slot start time (24h HH:mm). Coexists with legacy string park ids. */
export type SlotTime = string;

export const SLOT_DEFAULT_TIMES: Record<SlotType, string> = {
  am: "09:00",
  lunch: "12:00",
  pm: "14:00",
  dinner: "18:00",
};

/** Default block heights for timeline (minutes). */
export const SLOT_DEFAULT_DURATION_MIN: Record<SlotType, number> = {
  am: 180,
  lunch: 60,
  pm: 180,
  dinner: 90,
};

export function getParkIdFromSlotValue(
  v: SlotAssignmentValue | undefined,
): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && typeof v.parkId === "string") {
    return v.parkId.trim() || undefined;
  }
  return undefined;
}

export function getSlotTimeFromValue(
  slot: SlotType,
  v: SlotAssignmentValue | undefined,
): string {
  if (v != null && typeof v === "object" && v && typeof v.time === "string") {
    const t = v.time.trim();
    if (/^\d{1,2}:\d{2}$/.test(t)) return normaliseHHmm(t);
  }
  return SLOT_DEFAULT_TIMES[slot];
}

function normaliseHHmm(t: string): string {
  const [a, b] = t.split(":");
  const h = Math.min(23, Math.max(0, parseInt(a ?? "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(b ?? "0", 10) || 0));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes from midnight for sorting / layout. */
export function timeToMinutes(hhmm: string): number {
  const n = normaliseHHmm(hhmm);
  const [h, m] = n.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function snapMinutesToHalfHour(totalMin: number): number {
  const snapped = Math.round(totalMin / 30) * 30;
  return Math.min(23 * 60 + 30, Math.max(0, snapped));
}

export function minutesToHHmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Persist: plain string if no custom time, else object. */
export function slotValueWithOptionalTime(
  parkId: string,
  time: string | undefined,
  slot: SlotType,
): SlotAssignmentValue {
  const def = SLOT_DEFAULT_TIMES[slot];
  const t = time?.trim();
  if (!t || normaliseHHmm(t) === normaliseHHmm(def)) return parkId;
  return { parkId, time: normaliseHHmm(t) };
}

export function assignmentWithUpdatedSlotTime(
  assignments: Assignments,
  dateKey: string,
  slot: SlotType,
  timeHHmm: string,
): Assignments {
  const day = { ...(assignments[dateKey] ?? {}) };
  const cur = day[slot];
  const pid = getParkIdFromSlotValue(cur);
  if (!pid) return assignments;
  const nextDay: Assignment = { ...day, [slot]: slotValueWithOptionalTime(pid, timeHHmm, slot) };
  const nextAss: Assignments = { ...assignments, [dateKey]: nextDay };
  return nextAss;
}

export function countFilledSlots(assignments: Assignments): number {
  let n = 0;
  for (const slots of Object.values(assignments)) {
    if (!slots || typeof slots !== "object") continue;
    for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
      if (getParkIdFromSlotValue(slots[slot])) n += 1;
    }
  }
  return n;
}
