import { getParkIdFromSlotValue, getSlotTimeFromValue } from "@/lib/assignment-slots";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import type { Park, SlotAssignmentValue, SlotType, Trip } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";

const DAY_PROMPT_SLOTS: SlotType[] = ["am", "pm", "lunch", "dinner"];
const DAY_PROMPT_SLOT_LABEL: Record<SlotType, string> = {
  am: "AM",
  pm: "PM",
  lunch: "Lunch",
  dinner: "Dinner",
};

function slotHasCustomTime(raw: SlotAssignmentValue | undefined): boolean {
  if (raw == null || raw === "" || typeof raw === "string") return false;
  if (typeof raw === "object" && raw && typeof raw.time === "string") {
    return raw.time.trim() !== "";
  }
  return false;
}

/**
 * Per-slot park tiles on a day, with ~HH:mm block start for pacing (planner default or guest override).
 */
export function formatDaySlotLinesWithTimesForPrompt(
  trip: Trip,
  dateKey: string | null,
  parksById: Map<string, Park>,
): string | null {
  if (!dateKey?.trim()) return null;
  const day = trip.assignments[dateKey];
  if (!day || typeof day !== "object") return null;
  const lines: string[] = [];
  for (const slot of DAY_PROMPT_SLOTS) {
    const raw = day[slot];
    const pid = getParkIdFromSlotValue(raw);
    if (!pid) continue;
    const name = parksById.get(pid)?.name ?? pid;
    const hhmm = getSlotTimeFromValue(slot, raw);
    const timeNote = slotHasCustomTime(raw)
      ? ` — block start ~${hhmm} (guest set this in the day timeline)`
      : ` — block start ~${hhmm} (planner default; guest can adjust in day view)`;
    lines.push(`- ${DAY_PROMPT_SLOT_LABEL[slot]}: ${name} (park id ${pid})${timeNote}`);
  }
  if (lines.length === 0) return null;
  return lines.join("\n");
}

/**
 * Guest must-do / if-time list for the day, in planner sort order.
 */
export function formatDayRidePicksForPrompt(rows: TripRidePriority[]): string | null {
  const sorted = sortPrioritiesForDay(rows);
  const withNames = sorted.filter((r) => r.attraction?.name);
  if (withNames.length === 0) return null;
  return withNames
    .map((r) => {
      const tag = r.priority === "must_do" ? "must-do" : "if time";
      const n = r.attraction!.name;
      const park = r.attraction!.park_id;
      const note = r.notes?.trim() ? ` — guest note: ${r.notes.trim()}` : "";
      const ret = r.skip_line_return_hhmm?.trim()
        ? ` — BOOKED skip-line return ${r.skip_line_return_hhmm.trim()} (honour in pacing; do not plan conflicting heavy experiences here)`
        : "";
      const wait =
        r.pasted_queue_minutes != null && r.pasted_queue_minutes > 0
          ? ` — guest pasted wait ~${r.pasted_queue_minutes} min (snapshot, not live; use as a soft hint only)`
          : "";
      return `  - [${tag}] ${n} (park id ${park})${ret}${wait}${note}`;
    })
    .join("\n");
}
