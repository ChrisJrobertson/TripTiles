import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import type { Park, SlotAssignmentValue, Trip } from "@/lib/types";

/**
 * Gathers all freeform text the guest may have entered, for the USER CONSTRAINTS block.
 * No length gating here — the model receives the full string.
 */
export function collectUserBrief(
  trip: Trip,
  opts?: { inlineUserPrompt?: string },
): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  const add = (s: string | null | undefined) => {
    const t = s?.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(t);
  };

  add(trip.notes);
  add(trip.planning_preferences?.additionalNotes ?? null);
  add(opts?.inlineUserPrompt);

  const rawPrefs = trip.preferences;
  if (rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)) {
    const ub = (rawPrefs as Record<string, unknown>).user_brief;
    if (typeof ub === "string") add(ub);
  }

  return parts.join("\n\n").trim();
}

function sortedTripDateKeys(startIso: string, endIso: string): string[] {
  const keys: string[] = [];
  let d = parseDate(startIso);
  const end = parseDate(endIso);
  while (d.getTime() <= end.getTime()) {
    keys.push(formatDateKey(d));
    d = addDays(d, 1);
  }
  return keys;
}

const SLOT_ORDER = ["am", "pm", "lunch", "dinner"] as const;
const SLOT_ABBR: Record<(typeof SLOT_ORDER)[number], string> = {
  am: "AM",
  pm: "PM",
  lunch: "LUN",
  dinner: "DIN",
};

/**
 * Human-readable lines for `trips.assignments` (full trip) — one line per day that has at least one slot.
 */
export function formatCurrentTripAssignmentsBlock(
  trip: Trip,
  parksById: Map<string, Park>,
): string {
  const dateKeys = sortedTripDateKeys(trip.start_date, trip.end_date);
  const lines: string[] = [];
  for (const dateKey of dateKeys) {
    const day = trip.assignments[dateKey];
    if (!day || typeof day !== "object") continue;
    const segs: string[] = [];
    for (const slot of SLOT_ORDER) {
      const raw = day[slot] as SlotAssignmentValue | undefined;
      const pid = getParkIdFromSlotValue(raw);
      if (!pid) continue;
      const name = parksById.get(pid)?.name?.trim() ?? pid;
      segs.push(`${SLOT_ABBR[slot]}=${name}`);
    }
    if (segs.length > 0) {
      lines.push(`${dateKey}: ${segs.join(", ")}`);
    }
  }
  if (lines.length === 0) return "";
  return [
    "CURRENT TRIP ASSIGNMENTS (the user has already set these — respect them)",
    "",
    ...lines,
    "",
    "Rules:",
    "- You must NEVER change the park on a slot the user has assigned.",
    "- You may fill EMPTY slots with your recommendations, choosing parks from the region's catalogue.",
    "- All day_notes, crowd_reasoning, and day_crowd_notes MUST describe the park actually assigned to that date, not a different park you might prefer.",
    "- If you think the user's assignment is suboptimal (e.g. a headline park on a busy day), say so in planner_day_notes for that date as a tip — never by writing notes for a different park than the one assigned.",
  ].join("\n");
}
