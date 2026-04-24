import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { Assignments, Park } from "@/lib/types";

const SLOT_ROLL: ("am" | "pm" | "lunch" | "dinner")[] = [
  "am",
  "pm",
  "lunch",
  "dinner",
];

/**
 * Heuristic: if planner_day_notes for a date name-checks a catalogue park the guest did not assign
 * for that day, log a warning (does not block save).
 */
export function validateDayNotesAgainstAssignments(
  plannerDayNotes: Record<string, string> | undefined,
  userAssignments: Assignments,
  parks: Park[],
  allowedDates: Set<string>,
): {
  ok: boolean;
  mismatches: Array<{ date: string; assigned: string[]; mentioned: string[] }>;
  warningText: string | null;
} {
  if (!plannerDayNotes || Object.keys(plannerDayNotes).length === 0) {
    return { ok: true, mismatches: [], warningText: null };
  }

  const mismatchList: Array<{
    date: string;
    assigned: string[];
    mentioned: string[];
  }> = [];

  for (const [dateKey, noteRaw] of Object.entries(plannerDayNotes)) {
    if (!allowedDates.has(dateKey)) continue;
    const day = userAssignments[dateKey];
    if (!day || typeof day !== "object") continue;
    const expectedIds = new Set<string>();
    for (const slot of SLOT_ROLL) {
      const pid = getParkIdFromSlotValue(day[slot]);
      if (pid) expectedIds.add(pid);
    }
    if (expectedIds.size === 0) continue;

    const noteLower = noteRaw.toLowerCase();
    const mentioned: string[] = [];
    for (const p of parks) {
      if (expectedIds.has(p.id)) continue;
      const nm = p.name.trim();
      if (nm.length < 4) continue;
      if (noteLower.includes(nm.toLowerCase())) {
        mentioned.push(nm);
      }
    }
    if (mentioned.length > 0) {
      const assignedNames = [...expectedIds]
        .map((id) => parks.find((x) => x.id === id)?.name ?? id)
        .filter(Boolean);
      mismatchList.push({
        date: dateKey,
        assigned: assignedNames,
        mentioned: [...new Set(mentioned)].slice(0, 6),
      });
    }
  }

  if (mismatchList.length === 0) {
    return { ok: true, mismatches: [], warningText: null };
  }
  return {
    ok: false,
    mismatches: mismatchList,
    warningText: `planner_day_notes_park_mismatch: ${JSON.stringify(
      mismatchList.slice(0, 8),
    )}`,
  };
}
