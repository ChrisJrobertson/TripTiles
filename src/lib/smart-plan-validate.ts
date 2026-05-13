import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { Assignments, Park } from "@/lib/types";

const SLOT_ROLL: ("am" | "pm" | "lunch" | "dinner")[] = [
  "am",
  "pm",
  "lunch",
  "dinner",
];

/**
 * Heuristic: if day-level notes for a date name-check a catalogue park the guest did not assign
 * for that day, log a warning (does not block save). Used for `planner_day_notes` and
 * `day_crowd_notes`.
 */
export function validateDayNotesAgainstAssignments(
  dayNotes: Record<string, string> | undefined,
  userAssignments: Assignments,
  parks: Park[],
  allowedDates: Set<string>,
  options?: { mismatchLabel?: string },
): {
  ok: boolean;
  mismatches: Array<{ date: string; assigned: string[]; mentioned: string[] }>;
  warningText: string | null;
} {
  const mismatchLabel = options?.mismatchLabel ?? "day_notes";

  if (!dayNotes || Object.keys(dayNotes).length === 0) {
    return { ok: true, mismatches: [], warningText: null };
  }

  const mismatchList: Array<{
    date: string;
    assigned: string[];
    mentioned: string[];
  }> = [];

  for (const [dateKey, noteRaw] of Object.entries(dayNotes)) {
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
    warningText: `${mismatchLabel}_park_mismatch: ${JSON.stringify(
      mismatchList.slice(0, 8),
    )}`,
  };
}

/**
 * For single-park AI paths: if the blob mentions another catalogue park by display name
 * (length ≥ 4), the output may be misaligned with the guest's chosen park.
 */
export function inferSingleParkOutputMatch(
  textBlob: string,
  primaryParkId: string | null,
  parks: Park[],
): boolean | null {
  const t = textBlob.trim();
  if (!t || !primaryParkId) return null;
  const expected = new Set<string>([primaryParkId]);
  const lower = t.toLowerCase();
  for (const p of parks) {
    if (expected.has(p.id)) continue;
    const nm = p.name.trim();
    if (nm.length < 4) continue;
    if (lower.includes(nm.toLowerCase())) return false;
  }
  return true;
}
