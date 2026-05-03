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
 * Tile IDs that represent immovable travel anchors (flights and cruise embark/disembark).
 * Identified by `parks.park_group = 'travel'` in the seed; we hardcode the
 * subset the model must NEVER move even in overwrite mode. Flexible cruise days
 * (`sea`, `port`) are intentionally omitted so the model can re-place them.
 */
export const MANDATORY_ANCHOR_TILE_IDS: ReadonlySet<string> = new Set([
  "flyout",
  "flyhome",
  "embark",
  "disemb",
  "portmia",
  "portmiad",
]);

export function isMandatoryAnchorTileId(id: string | null | undefined): boolean {
  return !!id && MANDATORY_ANCHOR_TILE_IDS.has(id);
}

type AssignmentLine = { dateKey: string; segs: string[] };

function collectAssignmentLines(
  trip: Trip,
  parksById: Map<string, Park>,
  filter?: (parkId: string) => boolean,
): AssignmentLine[] {
  const dateKeys = sortedTripDateKeys(trip.start_date, trip.end_date);
  const lines: AssignmentLine[] = [];
  for (const dateKey of dateKeys) {
    const day = trip.assignments[dateKey];
    if (!day || typeof day !== "object") continue;
    const segs: string[] = [];
    for (const slot of SLOT_ORDER) {
      const raw = day[slot] as SlotAssignmentValue | undefined;
      const pid = getParkIdFromSlotValue(raw);
      if (!pid) continue;
      if (filter && !filter(pid)) continue;
      const name = parksById.get(pid)?.name?.trim() ?? pid;
      segs.push(`${SLOT_ABBR[slot]}=${name}`);
    }
    if (segs.length > 0) {
      lines.push({ dateKey, segs });
    }
  }
  return lines;
}

/**
 * Human-readable lines for `trips.assignments` (full trip) — one line per day that has at least one slot.
 * Used in PRESERVE mode (default — Smart Plan fills empty slots only).
 *
 * @param prioritiesBlock Optional pre-built USER PRIORITIES block to inject between
 *                        the assignment lines and the Rules section. This positions
 *                        priorities high in the prompt so the model weights them
 *                        when filling empty slots.
 */
export function formatCurrentTripAssignmentsBlock(
  trip: Trip,
  parksById: Map<string, Park>,
  prioritiesBlock?: string | null,
): string {
  const lines = collectAssignmentLines(trip, parksById).map(
    (l) => `${l.dateKey}: ${l.segs.join(", ")}`,
  );
  if (lines.length === 0) return "";

  const header = [
    "CURRENT TRIP ASSIGNMENTS (the user has already set these — respect them)",
    "",
    ...lines,
  ].join("\n");

  const priorities = prioritiesBlock?.trim();
  const prioritiesSection = priorities ? `\n\n${priorities}` : "";

  const rules = [
    "Rules:",
    "- You must NEVER change the park on a slot the user has assigned.",
    "- You may fill EMPTY slots with your recommendations, choosing parks from the region's catalogue.",
    "- All day_notes, crowd_reasoning, and day_crowd_notes MUST describe the park actually assigned to that date, not a different park you might prefer.",
    "- If you think the user's assignment is suboptimal (e.g. a headline park on a busy day), say so in planner_day_notes for that date as a tip — never by writing notes for a different park than the one assigned.",
  ].join("\n");

  return `${header}${prioritiesSection}\n\n${rules}`;
}

/**
 * MANDATORY ANCHORS block for OVERWRITE mode — only travel anchors (flights,
 * cruise embark/disembark) survive the wipe. Everything else the user had
 * (rest days, dining, park picks) is intentionally omitted so the model
 * generates a fresh plan based on USER PRIORITIES.
 */
export function formatMandatoryAnchorsBlock(
  trip: Trip,
  parksById: Map<string, Park>,
): string {
  const lines = collectAssignmentLines(trip, parksById, (id) =>
    isMandatoryAnchorTileId(id),
  ).map((l) => `${l.dateKey}: ${l.segs.join(", ")}`);
  if (lines.length === 0) return "";
  return [
    "MANDATORY ANCHORS (do not change — these are flights or cruise embark/disembark dates):",
    "",
    ...lines,
  ].join("\n");
}
