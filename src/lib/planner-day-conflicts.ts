import {
  getParkIdFromSlotValue,
  getSlotTimeFromValue,
  timeToMinutes,
} from "@/lib/assignment-slots";
import { getMustDosForDayPark, readMustDosMap } from "@/lib/must-dos";
import { isThemePark } from "@/lib/park-categories";
import type { Assignment, Park, SlotType, Trip } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";

const SLOT_ORDER: SlotType[] = ["am", "pm", "lunch", "dinner"];

export type DayConflictTimeOverlap = {
  type: "time_overlap";
  slotA: string;
  slotB: string;
  time: string;
  level: "amber";
};

export type DayConflictDayOverrun = {
  type: "day_overrun";
  estimatedMinutes: number;
  level: "amber";
};

export type DayConflictEmptyMustDo = {
  type: "empty_must_do";
  parkName: string;
  parkId: string;
  level: "grey";
};

export type DayConflict =
  | DayConflictTimeOverlap
  | DayConflictDayOverrun
  | DayConflictEmptyMustDo;

/** Stable key for session dismiss + React keys. */
export function dayConflictDismissKey(c: DayConflict): string {
  switch (c.type) {
    case "time_overlap":
      return `time_overlap:${c.slotA}:${c.slotB}`;
    case "day_overrun":
      return "day_overrun";
    case "empty_must_do":
      return `empty_must_do:${c.parkId}`;
    default:
      return "unknown";
  }
}

function slotLabel(slot: SlotType): string {
  switch (slot) {
    case "am":
      return "AM";
    case "pm":
      return "PM";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    default:
      return slot;
  }
}

function formatTimeForCopy(slot: SlotType, v: Assignment[SlotType]): string {
  const hhmm = getSlotTimeFromValue(slot, v);
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Planner warnings for a single day (slots, ride list, durations).
 * Pure function — safe on server and client. UK copy.
 */
export function computeDayConflicts(
  trip: Trip,
  dateKey: string,
  priorities: TripRidePriority[],
  rideCountsFallback: { total: number; mustDo: number } | undefined,
  parkById: Map<string, Park>,
): DayConflict[] {
  const out: DayConflict[] = [];
  const ass: Assignment = trip.assignments[dateKey] ?? {};

  const timedSlots: {
    slot: SlotType;
    mins: number;
    label: string;
    timeLabel: string;
  }[] = [];
  for (const slot of SLOT_ORDER) {
    const v = ass[slot];
    if (
      v != null &&
      typeof v === "object" &&
      typeof v.time === "string" &&
      v.time.trim()
    ) {
      const mins = timeToMinutes(getSlotTimeFromValue(slot, v));
      timedSlots.push({
        slot,
        mins,
        label: slotLabel(slot),
        timeLabel: formatTimeForCopy(slot, v),
      });
    }
  }

  for (let i = 0; i < timedSlots.length; i += 1) {
    for (let j = i + 1; j < timedSlots.length; j += 1) {
      const a = timedSlots[i]!;
      const b = timedSlots[j]!;
      if (Math.abs(a.mins - b.mins) <= 60) {
        const slotA = a.label;
        const slotB = b.label;
        const time = a.timeLabel;
        out.push({
          type: "time_overlap",
          slotA,
          slotB,
          time,
          level: "amber",
        });
      }
    }
  }

  let rideMinutes = 0;
  for (const p of priorities) {
    const dm = p.attraction?.duration_minutes;
    if (typeof dm === "number" && dm > 0) rideMinutes += dm;
  }

  let parkSlotCount = 0;
  for (const slot of SLOT_ORDER) {
    const id = getParkIdFromSlotValue(ass[slot]);
    if (id) parkSlotCount += 1;
  }
  const bufferMinutes = 45 * parkSlotCount;
  const totalPlanned = rideMinutes + bufferMinutes;
  if (totalPlanned > 840) {
    out.push({
      type: "day_overrun",
      estimatedMinutes: totalPlanned,
      level: "amber",
    });
  }

  const mustDoCount = priorities.filter((p) => p.priority === "must_do").length;
  const mustFallback = rideCountsFallback?.mustDo ?? 0;
  const effectiveMust = priorities.length > 0 ? mustDoCount : mustFallback;

  const parkIdsInSlots = new Set<string>();
  for (const slot of SLOT_ORDER) {
    const id = getParkIdFromSlotValue(ass[slot]);
    if (id) parkIdsInSlots.add(id);
  }

  const mustMap = readMustDosMap(trip.preferences);
  if (parkIdsInSlots.size > 0 && effectiveMust === 0) {
    for (const parkId of parkIdsInSlots) {
      const group = parkById.get(parkId)?.park_group;
      if (!isThemePark(group)) continue;
      const hasAiMustDos =
        getMustDosForDayPark(mustMap, dateKey, parkId).length > 0;
      if (hasAiMustDos) continue;
      const name = parkById.get(parkId)?.name?.trim() || "this park";
      out.push({
        type: "empty_must_do",
        parkName: name,
        parkId,
        level: "grey",
      });
    }
  }

  return out;
}

/** @deprecated Use {@link computeDayConflicts} */
export const computePlannerDayConflicts = computeDayConflicts;

export function conflictDotForDayConflicts(
  conflicts: DayConflict[],
): "amber" | "grey" | null {
  if (conflicts.length === 0) return null;
  const amber = conflicts.some((c) => c.level === "amber");
  if (amber) return "amber";
  return "grey";
}

export function conflictDotForDay(
  conflicts: DayConflict[],
): "amber" | "grey" | null {
  return conflictDotForDayConflicts(conflicts);
}
