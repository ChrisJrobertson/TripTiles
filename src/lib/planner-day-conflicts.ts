import {
  getParkIdFromSlotValue,
  getSlotTimeFromValue,
  timeToMinutes,
} from "@/lib/assignment-slots";
import type { Assignment, Park, SlotType, Trip } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";

const SLOT_ORDER: SlotType[] = ["am", "pm", "lunch", "dinner"];

export type PlannerConflictKind =
  | "time_overlap"
  | "day_overrun"
  | "empty_must_do";

export type PlannerDayConflict = {
  kind: PlannerConflictKind;
  /** Stable key for session dismiss. */
  dismissKey: string;
  message: string;
};

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
 * UK copy; Tripp is the advisor name in UI strings that reference them.
 */
export function computePlannerDayConflicts(
  trip: Trip,
  dateKey: string,
  priorities: TripRidePriority[],
  rideCountsFallback: { total: number; mustDo: number } | undefined,
  parkById: Map<string, Park>,
): PlannerDayConflict[] {
  const out: PlannerDayConflict[] = [];
  const ass: Assignment = trip.assignments[dateKey] ?? {};

  const timedSlots: { slot: SlotType; mins: number; label: string; timeLabel: string }[] =
    [];
  for (const slot of SLOT_ORDER) {
    const v = ass[slot];
    if (v != null && typeof v === "object" && typeof v.time === "string" && v.time.trim()) {
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
        out.push({
          kind: "time_overlap",
          dismissKey: `time_overlap:${a.slot}:${b.slot}`,
          message: `Time overlap — ${a.label} and ${b.label} both planned around ${a.timeLabel}.`,
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
    const hours = Math.round((totalPlanned / 60) * 10) / 10;
    out.push({
      kind: "day_overrun",
      dismissKey: "day_overrun",
      message: `This day looks packed — around ${hours} h of planned activity (over 14 h).`,
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
  if (parkIdsInSlots.size > 0 && effectiveMust === 0) {
    const names = [...parkIdsInSlots]
      .map((id) => parkById.get(id)?.name)
      .filter(Boolean) as string[];
    const parkName = names.length === 0 ? "this park" : names.join(" · ");
    out.push({
      kind: "empty_must_do",
      dismissKey: "empty_must_do",
      message: `No must-dos set for ${parkName}. Tripp can suggest some.`,
    });
  }

  return out;
}

export function conflictDotForDay(
  conflicts: PlannerDayConflict[],
): "amber" | "grey" | null {
  if (conflicts.length === 0) return null;
  const amber = conflicts.some(
    (c) => c.kind === "time_overlap" || c.kind === "day_overrun",
  );
  if (amber) return "amber";
  return "grey";
}
