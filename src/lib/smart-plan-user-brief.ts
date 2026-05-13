import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import type { Park, SlotAssignmentValue, Trip } from "@/lib/types";

/** Telemetry for `ai_generations.prompt_data_quality_summary` (Smart Plan paths). */
export type PromptDataQualitySummary = {
  custom_text_provided: boolean;
  custom_text_length: number;
  custom_text_reached_prompt: boolean;
  custom_text_deduped_against: string | null;
  user_brief_sources: string[];
};

export type CollectUserBriefResult = {
  brief: string;
  quality: PromptDataQualitySummary;
};

/**
 * Gathers all freeform text the guest may have entered, for the USER CONSTRAINTS block.
 * No length gating here — the model receives the full string.
 *
 * Duplicate text (case-insensitive) is merged once; when the Smart Plan inline
 * prompt duplicates an earlier field, `quality.custom_text_deduped_against` records
 * which source already contained that text.
 */
export function collectUserBrief(
  trip: Trip,
  opts?: { inlineUserPrompt?: string },
): CollectUserBriefResult {
  const parts: string[] = [];
  const seen = new Set<string>();
  const sourceByKey = new Map<string, string>();
  const sourcesInBrief: string[] = [];

  const inlineRaw = opts?.inlineUserPrompt?.trim() ?? "";
  const inlineLen = inlineRaw.length;

  const add = (s: string | null | undefined, sourceLabel: string) => {
    const t = s?.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sourceByKey.set(key, sourceLabel);
    parts.push(t);
    sourcesInBrief.push(sourceLabel);
  };

  add(trip.notes, "trip.notes");
  add(trip.planning_preferences?.additionalNotes ?? null, "planning_preferences.additionalNotes");

  let dedupedAgainst: string | null = null;
  if (inlineLen > 0) {
    const key = inlineRaw.toLowerCase();
    if (seen.has(key)) {
      dedupedAgainst = sourceByKey.get(key) ?? "existing_brief";
    } else {
      seen.add(key);
      sourceByKey.set(key, "inlineUserPrompt");
      parts.push(inlineRaw);
      sourcesInBrief.push("inlineUserPrompt");
    }
  }

  const rawPrefs = trip.preferences;
  if (rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)) {
    const ub = (rawPrefs as Record<string, unknown>).user_brief;
    if (typeof ub === "string") add(ub, "preferences.user_brief");
  }

  const brief = parts.join("\n\n").trim();
  const quality: PromptDataQualitySummary = {
    custom_text_provided: inlineLen > 0,
    custom_text_length: inlineLen,
    custom_text_reached_prompt: inlineLen > 0,
    custom_text_deduped_against: dedupedAgainst,
    user_brief_sources: sourcesInBrief,
  };

  return { brief, quality };
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
