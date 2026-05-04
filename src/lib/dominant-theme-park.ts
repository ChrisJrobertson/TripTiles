import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { isThemePark } from "@/lib/park-categories";
import type { Assignments, Park } from "@/lib/types";

/** First theme-park tile on a day (AM, PM, then meals). */
export function dominantThemeParkForAssignments(
  assignments: Assignments,
  dateKey: string,
  parkById: Map<string, Park>,
): Park | null {
  const ass = assignments[dateKey] ?? {};
  for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
    const id = getParkIdFromSlotValue(ass[slot]);
    if (!id) continue;
    const p = parkById.get(id);
    if (p && isThemePark(p.park_group)) return p;
  }
  return null;
}
