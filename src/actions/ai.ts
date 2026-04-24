"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getCustomTilesForRegion } from "@/lib/db/custom-tiles";
import { getParksForRegion } from "@/lib/db/parks";
import { getRegionById } from "@/lib/db/regions";
import { getTripById } from "@/lib/db/trips";
import {
  applyArrivalDayNoThemeParks,
  enforceAiPlanGuardrails,
  requiresCruiseSegment,
  sortDateKeysFromSet,
} from "@/lib/ai-plan-guardrails";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  formatDayRidePicksForPrompt,
  formatDaySlotLinesWithTimesForPrompt,
} from "@/lib/ai-day-prompt-context";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { applyAiTimelineToAssignmentSlotTimes } from "@/lib/ai-timeline-to-slot-times";
import type {
  Assignment,
  Assignments,
  AiDayTimeline,
  AiDayTimelineBlock,
  AiDayTimelineModelId,
  AiDayTimelineRowTag,
  CustomTile,
  Park,
  SlotType,
  Trip,
} from "@/lib/types";
import { customTileToPark } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { awardAchievementAction } from "@/actions/achievements";
import { currentUserCanGenerateAI } from "@/lib/entitlements";
import {
  isTierLoadFailure,
  tierLoadFailureUserMessage,
} from "@/lib/supabase/tier-load-error";
import { getSuccessfulAiGenerationCountForTrip } from "@/lib/db/ai-generations";
import { getCrowdPatternsForParkIds } from "@/lib/data/crowd-patterns";
import { getMonthlyConditions } from "@/data/destination-conditions";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { softTruncateToMax } from "@/lib/truncate-text";
import { formatRegionalDiningForPrompt } from "@/data/regional-dining";
import { formatPlanningPreferencesForPrompt } from "@/lib/planning-preferences-prompt";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import { getRidePrioritiesForDay } from "@/actions/ride-priorities";
import { assertTierAllows, tierErrorToClientPayload } from "@/lib/tier";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  filterMustDosToAssignedParks,
  mergeMustDosMap,
  normaliseMustDoItems,
  parseMustDosMapFromAI,
  readMustDosMap,
} from "@/lib/must-dos";
import type { ParkMustDo, TripMustDosMap } from "@/types/must-dos";
import { buildAiParkIdResolver, type AiParkIdResolver } from "@/lib/ai-park-id-coerce";
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const SMART_PLAN_MODEL = "claude-haiku-4-5-20251001";
/** Paid tiers — use a stronger model for per-park must-dos. */
const SMART_PLAN_PREMIUM_MODEL = "claude-sonnet-4-6";

function smartPlanModelForProfileTier(
  tier: string | null | undefined,
): string {
  if (
    tier === "pro" ||
    tier === "family" ||
    tier === "premium" ||
    tier === "concierge" ||
    tier === "agent_admin" ||
    tier === "agent_staff"
  ) {
    return SMART_PLAN_PREMIUM_MODEL;
  }
  return SMART_PLAN_MODEL;
}
const AI_GEN_DEBUG =
  process.env.AI_GEN_DEBUG === "1" || process.env.NODE_ENV !== "production";

type AiGenLogMeta = {
  step: string;
  tripId?: string;
  dateKey?: string | null;
  userId?: string;
  tier?: string | null;
  regionId?: string | null;
  parksCount?: number;
  hasPrompt?: boolean;
  mode?: "smart" | "custom";
  preserveExistingSlots?: boolean;
  promptLength?: number;
  details?: Record<string, unknown>;
};

function logAiGen(meta: AiGenLogMeta): void {
  if (!AI_GEN_DEBUG) return;
  console.info("[ai-gen]", {
    ...meta,
    at: new Date().toISOString(),
  });
}

async function reportDaySmartPlanParseError(params: {
  message: string;
  context: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const contextText = JSON.stringify(params.context).slice(0, 2000);
    await admin.from("feedback").insert({
      user_id: null,
      anonymous_email: "noreply@triptiles.app",
      category: "bug",
      message: `[AUTO-ERROR][day-smart-plan-parse] ${params.message.slice(0, 1800)}\n\nContext:\n${contextText}`,
      page_url: null,
      user_agent: null,
    });
  } catch (error) {
    console.warn("[ai-gen] failed to report day-smart-plan-parse", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

function describeAssignmentsParseFailure(
  parsed: unknown,
  dateAllow: Set<string>,
): string {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "parsed_not_object";
  }
  const obj = parsed as Record<string, unknown>;
  const inner = obj.assignments;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) {
    return `missing_or_invalid_assignments; top_level_keys=${Object.keys(obj).slice(0, 20).join(",")}`;
  }
  const innerKeys = Object.keys(inner as Record<string, unknown>);
  const notAllowed = innerKeys.filter((k) => !dateAllow.has(k));
  return `assignment_day_keys=${JSON.stringify(innerKeys)}; keys_rejected_not_in_trip_window=${JSON.stringify(notAllowed)}; allowed_date_sample=${[...dateAllow].slice(0, 3).join(",")}`;
}

async function reportAiGenAutoError(params: {
  message: string;
  stack?: string;
  context: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const stackText = params.stack ?? "";
    const contextText = JSON.stringify(params.context).slice(0, 2000);
    await admin.from("feedback").insert({
      user_id: null,
      anonymous_email: "noreply@triptiles.app",
      category: "bug",
      message: `[AUTO-ERROR][ai-gen] ${params.message.slice(0, 2000)}\n\nStack:\n${stackText.slice(0, 8000)}\n\nContext:\n${contextText}`,
      page_url: null,
      user_agent: null,
    });
  } catch (error) {
    console.warn("[ai-gen] failed to report AUTO-ERROR", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

const SYSTEM_PROMPT = `You are Smart Plan, TripTiles' warm and practical theme park planner. Output ONLY valid JSON — no markdown, no preamble, no text outside the JSON object.

Shape:
{ "assignments": { "2026-07-09": { "am": "mk", "pm": "mk", "lunch": "owl", "dinner": "tsr" } }, "crowd_reasoning": "…", "day_crowd_notes": { "2026-07-14": "…" }, "planner_day_notes": { "2026-07-09": "…" }, "skip_line_return_echo": { "2026-07-09": [ { "attraction_id": "id_from_ride_list", "hhmm": "14:15" } ] }, "must_dos": { "2026-07-09": { "mk": [ { "id": "any-uuid", "title": "Seven Dwarfs Mine Train", "timing": "morning", "why": "Shorter queues before 11:00 on lighter crowd days.", "done": false } ] } } }

Optional skip_line_return_echo: ONLY if the user message already lists guest BOOKED return times. Repeat those times here as structured { attraction_id, hhmm } for the correct trip date. Use the exact attraction_id strings from the ride list in the user message. Never invent return times, attraction ids, or hhmm values that the guest did not supply.

MUST_DOS (full-trip mode):
- For each date key under "must_dos", include an entry ONLY for each park id you place in that day's am/pm/lunch/dinner slots (the same id strings as in "assignments").
- Each park: 4–6 objects in rough chronological order (rope drop → morning → … → evening). "timing" must be one of: rope_drop, morning, midday, afternoon, evening.
- "title": a real, specific attraction or show name at that park. Do not invent attractions that are not in that park.
- "why": one short UK-English sentence (≤120 chars) on crowd or timing; no score arithmetic.
- "id": a unique string per row; "done": always false in your output.
- If you cannot name concrete attractions, omit that park from must_dos.

Limits: crowd_reasoning ≤400 chars, one paragraph. Each day_crowd_notes value ≤150 chars, one sentence.
Each planner_day_notes value ≤350 chars: practical tips for THAT day only (hours, virtual queues, rest-day ideas). Omit keys with no specific tip.

DAY NOTES RULES (CRITICAL):
- Sound like a knowledgeable friend. NEVER raw crowd scores, arithmetic, formulas, bracketed maths, "score N", "crowd index N", or how you calculated anything.
- Good: "Arrive early — Magic Kingdom is quietest before 10am on weekdays." Bad: "Tuesday (score 6+7=13/2=6.5)."

CROWD_PATTERNS (when in user message): 0–10 heuristics per park/weekday/month — use internally only. Never put numeric score workings in user-facing strings. Never claim live waits or exact attendance.

Rules:
- Date keys in assignments, day_crowd_notes, and planner_day_notes MUST be YYYY-MM-DD with zero-padded month and day (e.g. 2026-07-19), matching the trip dates in the user message. Park IDs must be the exact "id" strings in the second system message (numbered list). Do not use display names, natural language, or invent IDs. Do not use IDs for other regions.
- Slots: am, pm, lunch, dinner optional; rest days OK. Rest every 3–4 park days with young children.
- Day 1 arrival: no theme/water parks in AM/PM (resort/flyout/dining only; slots may be empty). day_crowd_notes must not contradict day-1 assignments.
- flyout: day 1 only, one AM or PM. flyhome: last day only, one slot — not both same calendar day unless trip is one day.
- Cruise tiles only between embark/disembark when cruise=yes.
- No same headline park on consecutive calendar days.
- True rest = restful tiles in AM and PM both; no half-rest + full park split.
- Dining: owl, tsr, char, specd, villa as documented.
- Honour family notes (young children / teens / queue patience).
- When the user message includes a day’s slot **block start times** (~HH:mm) and/or a **ride pick list** for a single date: use them only to shape a *rough* plan. Those times are informal pacing (which park when), not exact show, restaurant, or attraction times. The ride list is a wish list with guest ordering — put suggested touring order in **planner_day_notes** as a flexible draft, never in JSON "assignments" (assignments are park/dining slot IDs only). Do not state times as Lightning Lane, Genie+, Virtual Queue, or ADR bookings.

Return ONLY the JSON.`;

const SLOT_SET = new Set<SlotType>(["am", "pm", "lunch", "dinner"]);

/** Incoming overwrites the same day/slot keys (full overlay). */
function mergeAssignmentsOverlay(
  base: Assignments,
  incoming: Assignments,
): Assignments {
  const out: Assignments = { ...base };
  for (const [day, slots] of Object.entries(incoming)) {
    if (!slots || typeof slots !== "object") continue;
    out[day] = { ...(out[day] ?? {}), ...slots };
  }
  return out;
}

/**
 * Merges AI output into the trip calendar.
 * - `preserveExisting: true` (default): only fills slots that are still empty —
 *   never overwrites a park/dining tile the user already placed.
 * - `false`: same as overlay — AI rewrites any slot it outputs (full regenerate).
 */
function mergeAiIntoTrip(
  base: Assignments,
  incoming: Assignments,
  preserveExisting: boolean,
): Assignments {
  if (!preserveExisting) {
    return mergeAssignmentsOverlay(base, incoming);
  }
  const out: Assignments = { ...base };
  for (const [day, slots] of Object.entries(incoming)) {
    if (!slots || typeof slots !== "object") continue;
    const dayOut: Assignment = { ...(out[day] ?? {}) };
    for (const [slot, pid] of Object.entries(slots)) {
      if (!SLOT_SET.has(slot as SlotType)) continue;
      if (typeof pid !== "string") continue;
      const cur = dayOut[slot as SlotType];
      const curId = getParkIdFromSlotValue(cur);
      if (curId !== undefined && curId !== "") continue;
      dayOut[slot as SlotType] = pid;
    }
    if (Object.keys(dayOut).length > 0) out[day] = dayOut;
    else delete out[day];
  }
  return out;
}

function stripCodeFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/m, "");
  }
  return t.trim();
}

function allowedDateKeys(startIso: string, endIso: string): Set<string> {
  const keys = new Set<string>();
  let d = parseDate(startIso);
  const end = parseDate(endIso);
  while (d.getTime() <= end.getTime()) {
    keys.add(formatDateKey(d));
    d = addDays(d, 1);
  }
  return keys;
}

/**
 * Resolves each slot to a canonical catalogue id. Unknown strings are dropped.
 */
function sanitizeAssignments(
  raw: unknown,
  allowedDates: Set<string>,
  resolver: AiParkIdResolver,
): Assignments | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const inner = obj.assignments;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) return null;

  const out: Assignments = {};
  for (const [day, slots] of Object.entries(inner as Record<string, unknown>)) {
    if (!allowedDates.has(day)) continue;
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) continue;
    const dayOut: Partial<Record<SlotType, string>> = {};
    for (const [slot, pid] of Object.entries(slots)) {
      if (!SLOT_SET.has(slot as SlotType)) continue;
      if (typeof pid !== "string") continue;
      const canon = resolver.resolve(pid);
      if (canon == null) continue;
      dayOut[slot as SlotType] = canon;
    }
    if (Object.keys(dayOut).length > 0) out[day] = dayOut;
  }
  return out;
}

/** Unique raw model strings in assignments for allowed dates that did not resolve. */
function collectUnresolvedAssignmentPids(
  raw: unknown,
  allowedDates: Set<string>,
  resolver: AiParkIdResolver,
): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  const inner = obj.assignments;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [day, slots] of Object.entries(inner as Record<string, unknown>)) {
    if (!allowedDates.has(day)) continue;
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) continue;
    for (const [slot, pid] of Object.entries(slots)) {
      if (!SLOT_SET.has(slot as SlotType)) continue;
      if (typeof pid !== "string" || pid.length === 0) continue;
      if (resolver.resolve(pid) != null) continue;
      if (seen.has(pid)) continue;
      seen.add(pid);
      out.push(pid);
    }
  }
  return out;
}

const MAX_RETRY_INVALID_IDS = 25;

function buildSmartPlanValidationRetryUserSuffix(
  parseDetail: string,
  invalidRawIds: string[],
): string {
  const list =
    invalidRawIds.length > 0
      ? invalidRawIds
          .slice(0, MAX_RETRY_INVALID_IDS)
          .map((s) => JSON.stringify(s))
          .join(", ")
      : "(none after coercion — check assignments shape and YYYY-MM-DD date keys; see detail below.)";
  return `

RETRY: Your last JSON was rejected. Fix it and return ONLY valid JSON.

Detail: ${parseDetail}

These park_id values in assignments did not match our catalogue for this trip: ${list}. You MUST use only the id strings in the numbered list in the system message (e.g. mk, ep, not "Magic Kingdom" or magic_kingdom). Do not invent ids or use other regions' ids.`;
}

const HHMM_ECHO = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function parseCrowdMetadata(
  raw: unknown,
  allowedDates: Set<string>,
): {
  crowd_reasoning?: string;
  day_crowd_notes?: Record<string, string>;
  planner_day_notes?: Record<string, string>;
  /** Echo only — validated structured returns from the model. */
  skip_line_return_echo?: Record<
    string,
    Array<{ attraction_id: string; hhmm: string }>
  >;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  let crowd_reasoning: string | undefined;
  if (typeof obj.crowd_reasoning === "string") {
    const t = obj.crowd_reasoning.trim();
    if (t) crowd_reasoning = sanitizeDayNote(softTruncateToMax(t, 400));
  }
  const day_crowd_notes: Record<string, string> = {};
  const notes = obj.day_crowd_notes;
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    for (const [k, v] of Object.entries(notes as Record<string, unknown>)) {
      if (!allowedDates.has(k)) continue;
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (s) day_crowd_notes[k] = sanitizeDayNote(softTruncateToMax(s, 150));
    }
  }
  const planner_day_notes: Record<string, string> = {};
  const pNotes = obj.planner_day_notes;
  if (pNotes && typeof pNotes === "object" && !Array.isArray(pNotes)) {
    for (const [k, v] of Object.entries(pNotes as Record<string, unknown>)) {
      if (!allowedDates.has(k)) continue;
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (s) planner_day_notes[k] = sanitizeDayNote(softTruncateToMax(s, 350));
    }
  }
  const skip_line_return_echo: Record<
    string,
    Array<{ attraction_id: string; hhmm: string }>
  > = {};
  const echoTop = obj.skip_line_return_echo;
  if (echoTop && typeof echoTop === "object" && !Array.isArray(echoTop)) {
    for (const [k, val] of Object.entries(echoTop as Record<string, unknown>)) {
      if (!allowedDates.has(k)) continue;
      if (!Array.isArray(val)) continue;
      const rows: { attraction_id: string; hhmm: string }[] = [];
      for (const item of val) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const rec = item as Record<string, unknown>;
        if (typeof rec.attraction_id !== "string" || !rec.attraction_id.trim())
          continue;
        if (typeof rec.hhmm !== "string" || !HHMM_ECHO.test(rec.hhmm.trim()))
          continue;
        rows.push({
          attraction_id: rec.attraction_id.trim().slice(0, 200),
          hhmm: rec.hhmm.trim(),
        });
      }
      if (rows.length > 0) skip_line_return_echo[k] = rows;
    }
  }
  return {
    crowd_reasoning,
    day_crowd_notes:
      Object.keys(day_crowd_notes).length > 0 ? day_crowd_notes : undefined,
    planner_day_notes:
      Object.keys(planner_day_notes).length > 0 ? planner_day_notes : undefined,
    skip_line_return_echo:
      Object.keys(skip_line_return_echo).length > 0
        ? skip_line_return_echo
        : undefined,
  };
}

type AnthropicMessageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type GenerateAIPlanInput = {
  tripId: string;
  mode: "smart" | "custom";
  userPrompt: string;
  /** Optional day-scoped generation key (YYYY-MM-DD). */
  dateKey?: string;
  /**
   * When false, AI output overwrites existing tiles where both specify a slot.
   * Default true: only empty slots are filled (manual picks kept).
   */
  preserveExistingSlots?: boolean;
};

export type GenerateAIPlanResult =
  | {
      ok: true;
      assignments: Assignments;
      tokensUsed: number;
      model: string;
      newAchievements: string[];
      crowdSummary: string | null;
      dayCrowdNotes: Record<string, string> | null;
      /** Successful AI runs for this trip after this request (for UI counter). */
      generationsUsedForTrip: number;
      /** Same as DB `previous_assignments_snapshot_at` for optimistic UI. */
      undoSnapshotAt: string;
      /** Merged \`preferences.must_dos\` after this run (ride-level suggestions). */
      mustDos: TripMustDosMap | null;
    }
  | {
      ok: false;
      error:
        | "NOT_AUTHED"
        | "TRIP_NOT_FOUND"
        | "TIER_LIMIT"
        | "TIER_AI_DISABLED"
        | "AI_ERROR";
      message: string;
      partialResponse?: string;
      stoppedEarly?: boolean;
    };

type GenerateAIPlanOptions = {
  onTextDelta?: (deltaText: string) => void | Promise<void>;
};

function inputTokensFromUsage(usage: AnthropicMessageUsage | undefined): number {
  const u = usage ?? {};
  return (
    (u.input_tokens ?? 0) +
    (u.cache_creation_input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0)
  );
}

/** Cached with the system prompt — exact park ids the model may use (built-in + custom). */
function buildParksListSystemText(
  regionName: string,
  parksForPrompt: Park[],
  customTiles: CustomTile[],
  hasCruise: boolean,
): string {
  const numbered = parksForPrompt
    .map((p, i) => `${i + 1}. ${p.id} — ${p.name}`)
    .join("\n");
  const customBlock =
    customTiles.length > 0
      ? `\n\nCustom tiles (use these id strings in JSON, same as built-in tiles):\n${customTiles
          .map(
            (t, j) =>
              `${parksForPrompt.length + j + 1}. ${t.id} — ${t.name}${t.notes ? ` (${t.notes})` : ""}`,
          )
          .join("\n")}`
      : "";
  const cruiseLine = hasCruise
    ? "\nCruise/ship and shore tiles appear only in this list when allowed for the trip: use their ids; do not invent cruise tiles."
    : "\nThis trip is not a cruise. Do not place cruise-ship, at-sea, or shore-only tile ids — they are not in this list.";

  return `Allowed park_id values for ${regionName} (you MUST use only these id strings in JSON slots am, pm, lunch, and dinner, exactly as shown — not display names, not underscores, not ids from other regions):

${numbered}${customBlock}
${cruiseLine}`;
}

function buildPlannerUserMessage(params: {
  mode: "smart" | "custom";
  userPrompt: string;
  dateKey?: string;
  regionName: string;
  trip: Trip;
  cruiseInstruction: string;
  childAges: string;
  crowdJson: string;
  /** Structured wizard answers (optional). */
  wizardContext: string | null;
  /** Nearby dining names for day-note hints only (optional). */
  diningHint: string | null;
  /** Named assignable restaurant tiles for this region (optional). */
  namedRestaurantHint: string | null;
  /** Lines describing slots already on the calendar for `dateKey` (day scope). */
  existingDayPlanLines: string | null;
  /** Must-do / if-time ride list for the day (day scope). */
  dayRidePicksLines: string | null;
  preserveExistingSlots: boolean;
}): string {
  const {
    mode,
    userPrompt,
    dateKey,
    regionName,
    trip,
    cruiseInstruction,
    childAges,
    crowdJson,
    wizardContext,
    diningHint,
    namedRestaurantHint,
    existingDayPlanLines,
    dayRidePicksLines,
    preserveExistingSlots,
  } = params;

  const crowdSection =
    crowdJson === "{}"
      ? "CROWD_PATTERNS: {} (no hand-tuned rows for these park IDs — still favour mid-week for headline parks when possible.)"
      : `CROWD_PATTERNS (relative scores — not real-time crowds):\n${crowdJson}`;

  const coreTrip = `Trip details:
- Region: ${regionName}
- Dates: ${trip.start_date} to ${trip.end_date}
- Family: ${trip.adults} adults, ${trip.children} children${childAges}
- Cruise: ${trip.has_cruise ? `yes, embark ${trip.cruise_embark} disembark ${trip.cruise_disembark}` : "no"}
- ${cruiseInstruction}`;

  const wiz = wizardContext?.trim();
  const wizBlock = wiz ? `\n${wiz}\n` : "";
  const dine = diningHint?.trim();
  const dineBlock = dine ? `\n${dine}\n` : "";
  const namedRest = namedRestaurantHint?.trim();
  const namedRestBlock = namedRest ? `\n${namedRest}\n` : "";
  const dayScopeBlock =
    dateKey && dateKey.trim().length > 0
      ? `\nDAY-SCOPED MODE: Plan ONLY for calendar date ${dateKey}. Your JSON MUST have a top-level "assignments" object (same shape as full-trip Smart Plan). Under "assignments" include exactly ONE date entry: the key must be "${dateKey}" character-for-character (YYYY-MM-DD, zero-padded). The value is that day's slots object using lowercase keys only: am, pm, lunch, dinner — each a park ID from the list or omit empty slots. Do NOT return a bare slots object at the root; do NOT use other date keys under "assignments".\n\nUnder "must_dos", include at most ONE date key ("${dateKey}") with 4–6 specific attractions per park you assign in that day's slots (same shape as the system prompt). Omit must_dos if you cannot name real attractions.\n`
      : "";
  const calendarAlreadyBlock =
    dateKey &&
    existingDayPlanLines &&
    existingDayPlanLines.trim().length > 0
      ? `\nCALENDAR ALREADY SET FOR ${dateKey} — the guest chose these tiles on their trip calendar (each line includes the ~block start time for that slot — 24h, for pacing, not individual ride times):\n${existingDayPlanLines}\n${
          preserveExistingSlots
            ? `These slots are LOCKED for this run: keep the SAME park IDs in those keys in your JSON output (repeat them exactly). Only add or change slots that are still empty on the guest's calendar. In crowd_reasoning, day_crowd_notes, and planner_day_notes, ONLY discuss parks that match this day after merge — the headline parks above plus any parks you assign in empty slots. Do NOT recommend a different headline water park or theme park for AM/PM when those slots are already filled. Dining tips must match the dining tiles if lunch/dinner are already set. Use the block start times to reason about *order* of the day and when to be in which park, as a draft plan.\n`
            : `The guest enabled overwrite — you may replace slots, but their current picks and times above reflect intent; only change a filled slot if your plan clearly improves their day while respecting their notes.\n`
        }`
      : "";
  const hasDaySlots = Boolean(
    dateKey &&
      existingDayPlanLines &&
      existingDayPlanLines.trim().length > 0,
  );
  const hasDayRides = Boolean(
    dateKey && dayRidePicksLines && dayRidePicksLines.trim().length > 0,
  );
  const dayPacingAndRidesBlock =
    dateKey && (hasDaySlots || hasDayRides)
      ? `\nDAY PACING & RIDE DRAFT (rough plan — not a fixed schedule, not reservations):\n${
          hasDayRides
            ? `GUEST RIDE/SHOW PICKS for ${dateKey} — list order is the guest’s order in the planner; tags show must-do vs if-time:\n${dayRidePicksLines}\n\n`
            : ""
        }${
          hasDaySlots
            ? `The ~HH:mm times are in "CALENDAR ALREADY SET" above. They are *block* start times (AM / lunch / PM / dinner) for pacing and which park when — not exact ride, show, or meal times.\n`
            : "Park slot tiles for this day are not filled (or all empty) — you may place parks in empty slots; use the ride list to infer which parks to assign and a reasonable flow in planner_day_notes.\n"
        }- Use CROWD_PATTERNS in **planner_day_notes** for ${dateKey} to suggest a *rough* touring order when helpful (especially when ride picks exist: e.g. which must-dos to hit first, or a land-by-land flow). Keep wording flexible; suggest swaps if waits spike. JSON "assignments" must stay park/dining slot IDs only — all ride order detail lives in planner_day_notes.\n`
      : "";
  const cruiseTilePolicy = trip.has_cruise
    ? "CRUISE TILES: This trip includes a cruise segment. Include cruise embark/disembark and ship activities where appropriate when they fit the dates."
    : "CRUISE TILES: This trip does not include a cruise. Do not suggest or assign cruise-only, ship-only, or port-excursion tiles (for example at sea, ship pool, shore excursion) unless the traveller has explicitly asked for them in their notes.";

  if (mode === "smart") {
    const extra = userPrompt.trim();
    return `${coreTrip}

${crowdSection}
${wizBlock}${dineBlock}${namedRestBlock}${cruiseTilePolicy}${dayScopeBlock}${calendarAlreadyBlock}${dayPacingAndRidesBlock}

${
  dateKey
    ? "DAY-SCOPED SMART PLAN — refine this single calendar day using crowd patterns, slot block times, and (if any) the guest ride list. Respect locked calendar slots and notes above. Treat the day as a draft plan from historic patterns, not a guarantee."
    : "SMART PLAN MODE — build a full itinerary using crowd patterns to place busier parks on historically lighter days within this window. The user did not write a long custom brief."
}
${extra ? `Optional family notes from the user:\n${extra}\n` : ""}
${dateKey ? `For this date only (${dateKey}), add planner_day_notes with 1–2 practical tips tied to that date and assigned parks.` : "For each trip day, add planner_day_notes with 1–2 practical tips tied to that date and the parks you assign (rope drop times, virtual queues, rest-day ideas, dining). Keep each value concise. Skip generic advice that applies to every day."}

Generate the itinerary JSON now (include crowd_reasoning, day_crowd_notes, and planner_day_notes when possible).`;
  }

  return `${coreTrip}

${crowdSection}
${wizBlock}${dineBlock}${namedRestBlock}${cruiseTilePolicy}${dayScopeBlock}${calendarAlreadyBlock}${dayPacingAndRidesBlock}

CUSTOM PROMPT MODE — apply the traveller's preferences first, then use crowd patterns to improve date choices.

Traveller's own words:
${userPrompt.trim() || "(empty — rely on trip defaults only.)"}

${dateKey ? `For this date only (${dateKey}), add planner_day_notes with 1–2 practical tips tied to that date and assigned parks.` : "For each trip day, add planner_day_notes with 1–2 practical tips tied to that date and the parks you assign. Keep each value concise."}

Generate the itinerary JSON now (include crowd_reasoning, day_crowd_notes, and planner_day_notes when possible).`;
}

export async function runGenerateAIPlan(
  input: GenerateAIPlanInput,
  options: GenerateAIPlanOptions = {},
): Promise<GenerateAIPlanResult> {
  const normalizedDateKey =
    input.dateKey && input.dateKey.trim().length > 0
      ? formatDateKey(parseDate(`${input.dateKey}T12:00:00`))
      : null;
  logAiGen({
    step: "action_enter",
    tripId: input.tripId,
    dateKey: normalizedDateKey,
    mode: input.mode,
    hasPrompt: Boolean(input.userPrompt.trim()),
    preserveExistingSlots: input.preserveExistingSlots !== false,
    promptLength: input.userPrompt.trim().length,
  });
  const user = await getCurrentUser();
  if (!user) {
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      details: { ok: false, error: "NOT_AUTHED" },
    });
    return { ok: false, error: "NOT_AUTHED", message: "Not signed in." };
  }

  try {
    logAiGen({
      step: "entitlement_check_start",
      tripId: input.tripId,
      userId: user.id,
      mode: input.mode,
      hasPrompt: Boolean(input.userPrompt.trim()),
      preserveExistingSlots: input.preserveExistingSlots !== false,
    });
    await assertTierAllows(user.id, "ai");
    logAiGen({
      step: "entitlement_check_result",
      tripId: input.tripId,
      userId: user.id,
      details: { allowed: true, source: "assertTierAllows" },
    });
  } catch (e) {
    const mapped = tierErrorToClientPayload(e);
    if (mapped?.code === "TIER_AI_DISABLED") {
      logAiGen({
        step: "action_exit_result",
        tripId: input.tripId,
        userId: user.id,
        details: { ok: false, error: "TIER_AI_DISABLED" },
      });
      return {
        ok: false,
        error: "TIER_AI_DISABLED",
        message:
          "Smart Plan is not available on your current plan. Upgrade on Pricing.",
      };
    }
    throw e;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      details: { ok: false, error: "AI_ERROR", reason: "missing_anthropic_key" },
    });
    return {
      ok: false,
      error: "AI_ERROR",
      message: "ANTHROPIC_API_KEY is not configured.",
    };
  }

  const trip = await getTripById(input.tripId);
  if (!trip || trip.owner_id !== user.id) {
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      details: { ok: false, error: "TRIP_NOT_FOUND" },
    });
    return { ok: false, error: "TRIP_NOT_FOUND", message: "Trip not found." };
  }

  const rid =
    trip.region_id ??
    (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) {
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      details: { ok: false, error: "AI_ERROR", reason: "missing_region" },
    });
    return {
      ok: false,
      error: "AI_ERROR",
      message:
        "This trip needs a destination region. Use Edit Trip to choose one.",
    };
  }

  logAiGen({
    step: "region_lookup_start",
    tripId: input.tripId,
    userId: user.id,
    regionId: rid,
  });
  const region = await getRegionById(rid);
  if (!region) {
    logAiGen({
      step: "region_lookup_result",
      tripId: input.tripId,
      userId: user.id,
      regionId: rid,
      details: { found: false },
    });
    return {
      ok: false,
      error: "AI_ERROR",
      message: "Could not load destination region for this trip.",
    };
  }
  logAiGen({
    step: "region_lookup_result",
    tripId: input.tripId,
    userId: user.id,
    regionId: rid,
    details: { found: true },
  });

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_generations_lifetime")
    .eq("id", user.id)
    .maybeSingle();

  let canGenerateAi: boolean;
  try {
    canGenerateAi = await currentUserCanGenerateAI();
    logAiGen({
      step: "entitlement_check_result",
      tripId: input.tripId,
      userId: user.id,
      details: { allowed: canGenerateAi, source: "currentUserCanGenerateAI" },
    });
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        error: "AI_ERROR",
        message: tierLoadFailureUserMessage(),
      };
    }
    throw e;
  }

  if (!canGenerateAi) {
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      details: { ok: false, error: "TIER_LIMIT" },
    });
    return {
      ok: false,
      error: "TIER_LIMIT",
      message: "Smart Plan is not available on your current plan.",
    };
  }

  const builtInParks = await getParksForRegion(rid);
  const customTileRows = await getCustomTilesForRegion(user.id, rid);
  const customAsParks = customTileRows.map(customTileToPark);

  const builtFiltered = trip.has_cruise
    ? builtInParks
    : builtInParks.filter((p) => !requiresCruiseSegment(p));
  const customFiltered = trip.has_cruise
    ? customAsParks
    : customAsParks.filter((p) => !requiresCruiseSegment(p));

  const parksForPrompt = [...builtFiltered, ...customFiltered];
  logAiGen({
    step: "parks_lookup_result",
    tripId: input.tripId,
    userId: user.id,
    regionId: rid,
    parksCount: parksForPrompt.length,
    details: {
      builtInCount: builtInParks.length,
      builtFilteredCount: builtFiltered.length,
      customCount: customAsParks.length,
      customFilteredCount: customFiltered.length,
    },
  });

  if (parksForPrompt.length === 0) {
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      regionId: rid,
      parksCount: 0,
      details: { ok: false, error: "AI_ERROR", reason: "no_parks_for_prompt" },
    });
    return {
      ok: false,
      error: "AI_ERROR",
      message:
        "No parks or custom tiles available for this region. Add built-in parks in the catalog or create custom tiles.",
    };
  }

  const parkResolver = buildAiParkIdResolver(parksForPrompt, input.tripId);
  const allowedParkIds = parkResolver.allowedSet;
  const fullDateAllow = allowedDateKeys(trip.start_date, trip.end_date);
  const dateAllow = normalizedDateKey
    ? new Set(fullDateAllow.has(normalizedDateKey) ? [normalizedDateKey] : [])
    : fullDateAllow;
  if (normalizedDateKey && !dateAllow.has(normalizedDateKey)) {
    return {
      ok: false,
      error: "AI_ERROR",
      message: "Selected day is outside your trip dates.",
    };
  }
  const sortedDateKeys = sortDateKeysFromSet(dateAllow);
  const parksById = new Map(parksForPrompt.map((p) => [p.id, p]));

  const childAges = trip.child_ages?.length
    ? ` (ages ${trip.child_ages.join(", ")})`
    : "";

  const cruiseInstruction = trip.has_cruise
    ? `Cruise segment: YES — only schedule ship/cruise-line tiles on days from embark (${trip.cruise_embark}) through disembark (${trip.cruise_disembark}), inclusive.`
    : `Cruise segment: NO — do not use any cruise ship, at-sea, port-day, or cruise-excursion tiles.`;

  const crowdPatterns = getCrowdPatternsForParkIds(
    builtFiltered.map((p) => p.id),
  );
  const crowdJson = JSON.stringify(crowdPatterns, null, 2);

  const parksSystemText = buildParksListSystemText(
    `${region.name} (${region.country})`,
    parksForPrompt,
    customTileRows,
    trip.has_cruise,
  );

  const parkIdToName = new Map(parksForPrompt.map((p) => [p.id, p.name]));
  const wizardContext =
    trip.planning_preferences != null
      ? formatPlanningPreferencesForPrompt(
          trip.planning_preferences,
          parkIdToName,
        )
      : null;

  const diningHint = formatRegionalDiningForPrompt(trip.region_id);

  const namedRestaurantNames = builtFiltered
    .filter(isNamedRestaurantPark)
    .map((p) => p.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const namedRestaurantHint =
    namedRestaurantNames.length > 0
      ? `NAMED_RESTAURANT_TILES: The following named restaurants are available as dining tiles for this region: ${namedRestaurantNames.join(", ")}. You may assign 1–2 of these to Lunch or Dinner slots where appropriate, using their exact names. Prefer named restaurants over generic "Table Service" or "Quick Service" tiles where a specific restaurant fits the day's location and vibe.`
      : null;

  let dayRidePicksLines: string | null = null;
  if (normalizedDateKey) {
    const rideRows = await getRidePrioritiesForDay(
      input.tripId,
      normalizedDateKey,
    );
    dayRidePicksLines = formatDayRidePicksForPrompt(rideRows);
  }

  const composedUserMessage = buildPlannerUserMessage({
    mode: input.mode,
    userPrompt: input.userPrompt,
    dateKey: normalizedDateKey ?? undefined,
    regionName: `${region.name} (${region.country})`,
    trip,
    cruiseInstruction,
    childAges,
    crowdJson,
    wizardContext,
    diningHint,
    namedRestaurantHint,
    existingDayPlanLines: formatDaySlotLinesWithTimesForPrompt(
      trip,
      normalizedDateKey,
      parksById,
    ),
    dayRidePicksLines,
    preserveExistingSlots: input.preserveExistingSlots !== false,
  });
  logAiGen({
    step: "prompt_build_result",
    tripId: input.tripId,
    userId: user.id,
    regionId: rid,
    parksCount: parksForPrompt.length,
    mode: input.mode,
    hasPrompt: Boolean(input.userPrompt.trim()),
    preserveExistingSlots: input.preserveExistingSlots !== false,
    promptLength: composedUserMessage.length,
  });

  const model = SMART_PLAN_MODEL;

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    type MetaShape = ReturnType<typeof parseCrowdMetadata>;
    let currentUserMessage = composedUserMessage;
    let lastMeta: MetaShape = {};
    let finalParsed: unknown;
    let finalSanitized: Assignments | null = null;
    let lastRawText = "";

    planAttempts: for (let planAttempt = 0; planAttempt < 2; planAttempt++) {
      const t0 = Date.now();
      let rawText = "";
      let localInputTokens = 0;
      let localOutputTokens = 0;
      let streamStoppedEarly = false;

      try {
        logAiGen({
          step: "anthropic_call_start",
          tripId: input.tripId,
          userId: user.id,
          regionId: rid,
          mode: input.mode,
          parksCount: parksForPrompt.length,
          details: { planAttempt },
        });
        const stream = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          stream: true,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: parksSystemText,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: currentUserMessage }],
        });

        for await (const event of stream) {
          if (event.type === "message_start") {
            const usage = event.message.usage as
              | AnthropicMessageUsage
              | undefined;
            localInputTokens = inputTokensFromUsage(usage);
            localOutputTokens = usage?.output_tokens ?? localOutputTokens;
            continue;
          }
          if (event.type === "message_delta") {
            const usage = event.usage as AnthropicMessageUsage | undefined;
            localOutputTokens = usage?.output_tokens ?? localOutputTokens;
            continue;
          }
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const delta = event.delta.text;
            if (!delta) continue;
            rawText += delta;
            if (options.onTextDelta) {
              await options.onTextDelta(delta);
            }
          }
        }
        logAiGen({
          step: "anthropic_call_success",
          tripId: input.tripId,
          userId: user.id,
          details: {
            inputTokens: localInputTokens,
            outputTokens: localOutputTokens,
            latencyMs: Date.now() - t0,
            planAttempt,
          },
        });
      } catch (streamError) {
        streamStoppedEarly = rawText.trim().length > 0;
        logAiGen({
          step: "anthropic_call_fail",
          tripId: input.tripId,
          userId: user.id,
          details: {
            streamStoppedEarly,
            partialChars: rawText.trim().length,
            message:
              streamError instanceof Error
                ? streamError.message
                : "unknown_stream_error",
            planAttempt,
          },
        });
        await reportAiGenAutoError({
          message: `${normalizedDateKey ? "[day-smart-plan] " : ""}${
            streamError instanceof Error
              ? streamError.message
              : "Unknown error while streaming Anthropic response"
          }`,
          stack: streamError instanceof Error ? streamError.stack : undefined,
          context: {
            tripId: input.tripId,
            mode: input.mode,
            phase: "anthropic_stream",
            streamStoppedEarly,
            partialChars: rawText.trim().length,
            planAttempt,
          },
        });
        if (!streamStoppedEarly) {
          throw new Error("AI stream failed before output");
        }
      }

      if (streamStoppedEarly) {
        inputTokens = localInputTokens;
        outputTokens = localOutputTokens;
        await supabase.from("ai_generations").insert({
          user_id: user.id,
          trip_id: input.tripId,
          prompt: currentUserMessage,
          model,
          input_tokens: localInputTokens,
          output_tokens: localOutputTokens,
          cost_gbp_pence: null,
          success: false,
          status: "failed",
          error: "AI stream stopped early",
        });

        return {
          ok: false,
          error: "AI_ERROR",
          message: "Stopped early — retry?",
          partialResponse: rawText,
          stoppedEarly: true,
        };
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[ai] anthropic usage", {
          input_tokens: localInputTokens,
          output_tokens: localOutputTokens,
          latency_ms: Date.now() - t0,
          planAttempt,
        });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripCodeFences(rawText));
      } catch {
        inputTokens = localInputTokens;
        outputTokens = localOutputTokens;
        if (rawText.trim().length > 0) {
          await supabase.from("ai_generations").insert({
            user_id: user.id,
            trip_id: input.tripId,
            prompt: currentUserMessage,
            model,
            input_tokens: localInputTokens,
            output_tokens: localOutputTokens,
            cost_gbp_pence: null,
            success: false,
            status: "failed",
            error: "AI stream incomplete (invalid JSON)",
          });
          return {
            ok: false,
            error: "AI_ERROR",
            message: "Stopped early — retry?",
            partialResponse: rawText,
            stoppedEarly: true,
          };
        }
        await supabase.from("ai_generations").insert({
          user_id: user.id,
          trip_id: input.tripId,
          prompt: currentUserMessage,
          model,
          input_tokens: localInputTokens,
          output_tokens: localOutputTokens,
          cost_gbp_pence: null,
          success: false,
          status: "failed",
          error: "Invalid JSON from model",
        });

        return {
          ok: false,
          error: "AI_ERROR",
          message: "Smart Plan returned something we couldn't read. Try again.",
        };
      }

      if (normalizedDateKey && AI_GEN_DEBUG) {
        console.log("[ai-gen][day] raw response preview", {
          tripId: input.tripId,
          dateKey: normalizedDateKey,
          planAttempt,
          preview: String(rawText).slice(0, 2000),
          length: String(rawText).length,
        });
      }

      const meta = parseCrowdMetadata(parsed, dateAllow);
      const sanitized = sanitizeAssignments(parsed, dateAllow, parkResolver);
      logAiGen({
        step: "assignment_parse_result",
        tripId: input.tripId,
        userId: user.id,
        details: {
          parsed: Boolean(parsed),
          assignmentDays: sanitized ? Object.keys(sanitized).length : 0,
          planAttempt,
        },
      });

      if (sanitized && Object.keys(sanitized).length > 0) {
        lastMeta = meta;
        finalParsed = parsed;
        finalSanitized = sanitized;
        lastRawText = rawText;
        inputTokens = localInputTokens;
        outputTokens = localOutputTokens;
        break planAttempts;
      }

      const parseDetail = describeAssignmentsParseFailure(parsed, dateAllow);
      const invalidIds = collectUnresolvedAssignmentPids(
        parsed,
        dateAllow,
        parkResolver,
      );
      const errDetail =
        planAttempt === 0
          ? `No valid assignments after validation (pre-retry: ${parseDetail})`
          : `No valid assignments after validation (after retry: ${parseDetail})`;
      if (planAttempt === 0) {
        await supabase.from("ai_generations").insert({
          user_id: user.id,
          trip_id: input.tripId,
          prompt: currentUserMessage,
          model,
          input_tokens: localInputTokens,
          output_tokens: localOutputTokens,
          cost_gbp_pence: null,
          success: false,
          status: "failed",
          error: errDetail,
        });
        currentUserMessage =
          composedUserMessage +
          buildSmartPlanValidationRetryUserSuffix(parseDetail, invalidIds);
        continue;
      }

      if (normalizedDateKey) {
        await reportDaySmartPlanParseError({
          message: `${errDetail}; invalid_raw=${JSON.stringify(invalidIds)}`,
          context: {
            tripId: input.tripId,
            dateKey: normalizedDateKey,
            mode: input.mode,
            parseDetail,
            responsePreview: String(rawText).slice(0, 1500),
          },
        });
      } else {
        await reportAiGenAutoError({
          message: `No valid assignments (full trip): ${errDetail}; invalid_raw=${JSON.stringify(
            invalidIds,
          )}`,
          context: {
            tripId: input.tripId,
            mode: input.mode,
            parseDetail,
            responsePreview: String(rawText).slice(0, 1500),
          },
        });
      }
      inputTokens = localInputTokens;
      outputTokens = localOutputTokens;
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: currentUserMessage,
        model,
        input_tokens: localInputTokens,
        output_tokens: localOutputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: errDetail,
      });

      return {
        ok: false,
        error: "AI_ERROR",
        message:
          "Smart Plan didn't quite work this time — try again, or build the plan manually.",
      };
    }

    if (!finalSanitized || Object.keys(finalSanitized).length === 0) {
      return {
        ok: false,
        error: "AI_ERROR",
        message:
          "Smart Plan didn't quite work this time — try again, or build the plan manually.",
      };
    }

    const meta = lastMeta;
    const parsed = finalParsed;
    const sanitized = finalSanitized;
    if (AI_GEN_DEBUG && lastRawText.length > 0) {
      logAiGen({
        step: "plan_validate_success",
        tripId: input.tripId,
        userId: user.id,
        details: { outputChars: lastRawText.length },
      });
    }

    const guarded = enforceAiPlanGuardrails(sanitized, {
      trip,
      parksById,
      sortedDateKeys,
    });
    if (Object.keys(guarded).length === 0) {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: currentUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: "Plan failed guardrail validation (empty after cleanup)",
      });

      return {
        ok: false,
        error: "AI_ERROR",
        message:
          "The plan could not be applied after safety checks. Try generating again.",
      };
    }

    const preserve =
      input.preserveExistingSlots !== false;
    const mergedRaw = mergeAiIntoTrip(trip.assignments, guarded, preserve);
    /** After overwrite mode, strip headline parks from day 1 AM/PM. In preserve
     * mode, do not run this on the merged calendar — it would remove the guest's
     * manual day-1 picks even when they asked not to overwrite. */
    const merged = preserve
      ? mergedRaw
      : applyArrivalDayNoThemeParks(
          mergedRaw,
          sortedDateKeys,
          parksById,
        );

    const rawMustTop = (parsed as Record<string, unknown>).must_dos;
    const parsedMust = parseMustDosMapFromAI(
      rawMustTop,
      dateAllow,
      allowedParkIds,
      parkResolver.resolve,
    );
    const filteredMust = filterMustDosToAssignedParks(
      parsedMust,
      merged,
      dateAllow,
    );
    const existingMust = readMustDosMap(trip.preferences);
    const nextMustMap = mergeMustDosMap(existingMust, filteredMust);

    const now = new Date().toISOString();

    const nextPrefs: Record<string, unknown> = {
      ...(trip.preferences ?? {}),
    };
    if (meta.crowd_reasoning) nextPrefs.ai_crowd_summary = meta.crowd_reasoning;
    if (meta.day_crowd_notes) nextPrefs.ai_day_crowd_notes = meta.day_crowd_notes;
    nextPrefs.ai_crowd_updated_at = now;
    if (meta.planner_day_notes) {
      const prevDn = trip.preferences?.day_notes;
      const baseDn =
        prevDn && typeof prevDn === "object" && !Array.isArray(prevDn)
          ? { ...(prevDn as Record<string, string>) }
          : {};
      nextPrefs.day_notes = { ...baseDn, ...meta.planner_day_notes };
    }
    if (meta.skip_line_return_echo) {
      (nextPrefs as Record<string, unknown>).ai_skip_line_return_echo =
        meta.skip_line_return_echo;
    }
    if (Object.keys(nextMustMap).length > 0) {
      nextPrefs.must_dos = nextMustMap;
    }

    logAiGen({
      step: "db_write_start",
      tripId: input.tripId,
      userId: user.id,
      details: {
        assignmentDays: Object.keys(merged).length,
      },
    });
    const { error: upErr } = await supabase
      .from("trips")
      .update({
        previous_assignments_snapshot: trip.assignments,
        previous_preferences_snapshot: trip.preferences ?? {},
        previous_assignments_snapshot_at: now,
        assignments: merged,
        preferences: nextPrefs,
        updated_at: now,
        last_opened_at: now,
      })
      .eq("id", input.tripId)
      .eq("owner_id", user.id);
    logAiGen({
      step: "db_write_result",
      tripId: input.tripId,
      userId: user.id,
      details: {
        ok: !upErr,
        updatedAssignmentDays: Object.keys(merged).length,
        error: upErr?.message ?? null,
      },
    });

    if (upErr) {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: currentUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: upErr.message,
      });

      return { ok: false, error: "AI_ERROR", message: upErr.message };
    }

    const { error: genInsertErr } = await supabase.from("ai_generations").insert({
      user_id: user.id,
      trip_id: input.tripId,
      prompt: currentUserMessage,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_gbp_pence: null,
      success: true,
      status: "success",
      error: null,
    });

    if (genInsertErr) {
      return {
        ok: false,
        error: "AI_ERROR",
        message: `Could not log usage: ${genInsertErr.message}. Your plan may have saved — refresh the page.`,
      };
    }

    let generationsUsedForTrip = 1;
    try {
      const n = await getSuccessfulAiGenerationCountForTrip(
        input.tripId,
        user.id,
      );
      generationsUsedForTrip = Math.max(1, n);
    } catch {
      /* count query failed; insert succeeded so at least 1 */
    }

    const prevLifetime = Number(
      (profile as { ai_generations_lifetime?: number } | null)
        ?.ai_generations_lifetime ?? 0,
    );
    await supabase
      .from("profiles")
      .update({ ai_generations_lifetime: prevLifetime + 1 })
      .eq("id", user.id);

    const newAchievements: string[] = [];
    const firstAi = await awardAchievementAction("first_ai_plan");
    if (firstAi.ok && firstAi.justEarned) newAchievements.push("first_ai_plan");

    revalidatePath("/planner");
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      details: { ok: true, generationsUsedForTrip },
    });

    return {
      ok: true,
      assignments: merged,
      tokensUsed: inputTokens + outputTokens,
      model,
      newAchievements,
      crowdSummary: meta.crowd_reasoning ?? null,
      dayCrowdNotes: meta.day_crowd_notes ?? null,
      generationsUsedForTrip,
      undoSnapshotAt: now,
      mustDos: Object.keys(nextMustMap).length > 0 ? nextMustMap : null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const stack = e instanceof Error ? e.stack : undefined;
    await reportAiGenAutoError({
      message: `${normalizedDateKey ? "[day-smart-plan] " : ""}${msg}`,
      stack,
      context: {
        tripId: input.tripId,
        mode: input.mode,
        preserveExistingSlots: input.preserveExistingSlots !== false,
        hasPrompt: Boolean(input.userPrompt.trim()),
      },
    });
    logAiGen({
      step: "action_exit_result",
      tripId: input.tripId,
      userId: user.id,
      details: { ok: false, error: "AI_ERROR", message: msg },
    });
    const supabase2 = await createClient();
    await supabase2.from("ai_generations").insert({
      user_id: user.id,
      trip_id: input.tripId,
      prompt: composedUserMessage,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_gbp_pence: null,
      success: false,
      status: "failed",
      error: msg,
    });

    return { ok: false, error: "AI_ERROR", message: msg };
  }
}

export async function generateAIPlanAction(
  input: GenerateAIPlanInput,
): Promise<GenerateAIPlanResult> {
  return runGenerateAIPlan(input);
}

const MUST_DOS_PARK_SYSTEM = `You are a theme park touring expert for TripTiles. Output ONLY valid JSON — no markdown, no preamble.

Shape: { "must_dos": [ { "id": "string", "title": "string", "timing": "rope_drop" | "morning" | "midday" | "afternoon" | "evening", "why": "string", "done": false } ] }

Rules:
- 4 to 6 items in rough chronological order (rope drop through evening).
- Only name real attractions, rides, or shows that exist at this park. Do not invent.
- "why": one short UK-English sentence (≤120 characters) on crowds or timing. No score arithmetic.
- "done" must be false. "id" must be unique per row.`;

export type GenerateMustDosForParkResult =
  | {
      ok: true;
      mustDos: ParkMustDo[];
      /** Full `trips.preferences` after save (for optimistic client patch). */
      nextPreferences: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
      code?:
        | "NOT_AUTHED"
        | "TRIP_NOT_FOUND"
        | "TIER_LIMIT"
        | "TIER_AI_DISABLED"
        | "AI_ERROR";
    };

export async function generateMustDosForPark(input: {
  tripId: string;
  dateISO: string;
  parkId: string;
}): Promise<GenerateMustDosForParkResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Not signed in.", code: "NOT_AUTHED" };
  }

  try {
    await assertTierAllows(user.id, "ai");
  } catch (e) {
    const mapped = tierErrorToClientPayload(e);
    if (mapped?.code === "TIER_AI_DISABLED") {
      return {
        ok: false,
        error:
          "Smart Plan is not available on your current plan. Upgrade on Pricing.",
        code: "TIER_AI_DISABLED",
      };
    }
    throw e;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY is not configured.",
      code: "AI_ERROR",
    };
  }

  let canGenerateAi: boolean;
  try {
    canGenerateAi = await currentUserCanGenerateAI();
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return { ok: false, error: tierLoadFailureUserMessage(), code: "AI_ERROR" };
    }
    throw e;
  }
  if (!canGenerateAi) {
    return {
      ok: false,
      error: "You have used your Smart Plan allowance on the Free plan.",
      code: "TIER_LIMIT",
    };
  }

  const trip = await getTripById(input.tripId);
  if (!trip || trip.owner_id !== user.id) {
    return { ok: false, error: "Trip not found.", code: "TRIP_NOT_FOUND" };
  }

  const rid = trip.region_id ?? (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) {
    return {
      ok: false,
      error: "This trip needs a destination region.",
      code: "AI_ERROR",
    };
  }

  const region = await getRegionById(rid);
  if (!region) {
    return { ok: false, error: "Could not load region.", code: "AI_ERROR" };
  }

  const dateKey = formatDateKey(parseDate(`${input.dateISO}T12:00:00`));
  const allowed = allowedDateKeys(trip.start_date, trip.end_date);
  if (!allowed.has(dateKey)) {
    return { ok: false, error: "That date is outside this trip.", code: "AI_ERROR" };
  }

  const builtInParks = await getParksForRegion(rid);
  const customTileRows = await getCustomTilesForRegion(user.id, rid);
  const customAsParks = customTileRows.map(customTileToPark);
  const parksForPrompt = [
    ...builtInParks.filter((p) =>
      trip.has_cruise ? true : !requiresCruiseSegment(p),
    ),
    ...customAsParks.filter((p) =>
      trip.has_cruise ? true : !requiresCruiseSegment(p),
    ),
  ];
  const park = parksForPrompt.find((p) => p.id === input.parkId);
  if (!park) {
    return { ok: false, error: "Park not found for this trip.", code: "AI_ERROR" };
  }

  const childAges = trip.child_ages?.length
    ? `ages ${trip.child_ages.join(", ")}`
    : "not specified";
  const d = parseDate(`${dateKey}T12:00:00`);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });

  const wizardContext =
    trip.planning_preferences != null
      ? formatPlanningPreferencesForPrompt(
          trip.planning_preferences,
          new Map(parksForPrompt.map((p) => [p.id, p.name])),
        )
      : null;

  const userBlock = `Park: ${park.name} (${region.country}).
Resort/region: ${region.name}.
Calendar date: ${dateKey} (${weekday}, ${month}).
Family: ${trip.adults} adults, ${trip.children} children (${childAges}).
${wizardContext ? `Planning notes:\n${wizardContext}\n` : ""}
Produce 4–6 specific named attractions in rough chronological order for a full day at this park. Return JSON only.`;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_generations_lifetime, tier")
    .eq("id", user.id)
    .maybeSingle();

  const model = smartPlanModelForProfileTier(
    (profile as { tier?: string } | null)?.tier,
  );
  let rawText = "";
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 2500,
      system: [
        {
          type: "text",
          text: MUST_DOS_PARK_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `Park name for grounding: ${park.name}. ID: ${park.id}.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userBlock }],
    });
    const block = msg.content[0];
    if (block?.type === "text") {
      rawText = block.text;
    }
    const usage = msg.usage as AnthropicMessageUsage | undefined;
    const inputTokens = inputTokensFromUsage(usage);
    const outputTokens = usage?.output_tokens ?? 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawText));
    } catch {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: `must_dos:${input.parkId}\n${userBlock}`,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: "Invalid JSON (must_dos single park)",
      });
      return {
        ok: false,
        error: "We could not read the AI response. Please try again.",
        code: "AI_ERROR",
      };
    }
    const root = parsed as Record<string, unknown>;
    const items = normaliseMustDoItems(root.must_dos);
    if (items.length === 0) {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: `must_dos:${input.parkId}\n${userBlock}`,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: "empty must_dos",
      });
      return {
        ok: false,
        error: "No attractions were returned. Try again.",
        code: "AI_ERROR",
      };
    }

    const prevPrefs = trip.preferences ?? {};
    const mustMap = readMustDosMap(prevPrefs);
    const snap = JSON.parse(JSON.stringify(mustMap)) as TripMustDosMap;
    const nextMap: TripMustDosMap = {
      ...mustMap,
      [dateKey]: { ...(mustMap[dateKey] ?? {}), [input.parkId]: items },
    };
    const nextPreferences: Record<string, unknown> = {
      ...prevPrefs,
      must_dos: nextMap,
      must_dos_snapshot: snap,
    };

    const { error: upErr } = await supabase
      .from("trips")
      .update({
        preferences: nextPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (upErr) {
      return { ok: false, error: upErr.message, code: "AI_ERROR" };
    }

    const { error: genInsertErr } = await supabase.from("ai_generations").insert({
      user_id: user.id,
      trip_id: input.tripId,
      prompt: `must_dos:${input.parkId}\n${userBlock}`,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_gbp_pence: null,
      success: true,
      status: "success",
      error: null,
    });
    if (genInsertErr) {
      return {
        ok: false,
        error: `Could not log usage: ${genInsertErr.message}`,
        code: "AI_ERROR",
      };
    }

    const prevLifetime = Number(
      (profile as { ai_generations_lifetime?: number } | null)
        ?.ai_generations_lifetime ?? 0,
    );
    await supabase
      .from("profiles")
      .update({ ai_generations_lifetime: prevLifetime + 1 })
      .eq("id", user.id);

    revalidatePath("/planner");
    return {
      ok: true,
      mustDos: items,
      nextPreferences: nextPreferences as Record<string, unknown>,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg, code: "AI_ERROR" };
  }
}

const DAY_TIMELINE_SYSTEM = `You are a theme-park day planner for TripTiles. You produce realistic, time-accurate day itineraries for UK and US families on holiday.

Rules:
- Use UK English spelling throughout (colour, favourite, organise).
- Use 24-hour times in "HH:MM" format.
- Never include scoring logic, point tallies, or reasoning artefacts in user-facing text.
- Keep subtitles to one short sentence with a concrete, useful tip. No fluff.
- Priorities: mark the single most wait-sensitive attraction of the day with tag "priority". Mark live shows with "show". Mark reserved meals with "adr". Mark long walks or transit with "transport" if notable. Mark scheduled rest with "break".
- Respect park operating hours. Rope drop arrival is 30 min before open.
- Families with young children need rest breaks in peak heat (>= 30°C) and shorter evenings.
- Do not invent attractions. Only use the park names provided in the context.

Output format: a single JSON object, no markdown fences, no prose outside the JSON, matching this TypeScript type:

{
  "park_hours": { "open": "HH:MM", "close": "HH:MM" },
  "timeline": [{ "time": "HH:MM", "block": "morning"|"lunch"|"afternoon"|"dinner"|"evening", "title": "...", "subtitle": "..."?, "tag": "priority"|"show"|"adr"|"break"|"transport"? }],
  "heat_plan": "one sentence" | null,
  "transport": "one sentence" | null,
  "must_do": ["...", "...", "..."]
}`;

const AI_DAY_TIMELINE_BLOCKS: ReadonlySet<string> = new Set([
  "morning",
  "lunch",
  "afternoon",
  "dinner",
  "evening",
]);

const AI_DAY_TIMELINE_TAGS: ReadonlySet<string> = new Set([
  "priority",
  "show",
  "adr",
  "break",
  "transport",
]);

function buildTripMetadataForDayTimelineCache(trip: Trip, regionName: string): string {
  const childAges =
    trip.child_ages.length > 0
      ? trip.child_ages.join(", ")
      : "not specified";
  const cruise = trip.has_cruise
    ? `Cruise: yes. Embark ${trip.cruise_embark ?? "—"}, disembark ${trip.cruise_disembark ?? "—"}.`
    : "Cruise: no.";
  return `Trip metadata (read-only; do not output this block):
- Adventure name: ${trip.adventure_name}
- Destination: ${trip.destination}
- Region label: ${regionName}
- region_id: ${trip.region_id ?? "null"}
- Dates: ${trip.start_date} to ${trip.end_date}
- Party: ${trip.adults} adults, ${trip.children} children; ages: ${childAges}
- ${cruise}`;
}

function buildDayTimelineUserMessage(params: {
  trip: Trip;
  dateKey: string;
  amName: string;
  lunchName: string;
  pmName: string;
  dinnerName: string;
  crowdLevel: string;
  tempC: number;
  weatherSummary: string;
  skipLineOn: boolean;
}): string {
  const d = parseDate(`${params.dateKey}T12:00:00`);
  const w = d.toLocaleDateString("en-GB", { weekday: "long" });
  const childAges =
    params.trip.child_ages.length > 0
      ? params.trip.child_ages.join(", ")
      : "n/a";
  return `Trip: ${params.trip.adventure_name} — ${params.trip.destination} — ${params.trip.adults} adults, ${params.trip.children} children (ages ${childAges}).
Date: ${params.dateKey} (${w}).
Weather: ${params.tempC}°C, ${params.weatherSummary}.
Crowd level for this day: ${params.crowdLevel}.
Skip-the-line passes: ${params.skipLineOn ? "on" : "off"}.

Parks assigned to slots today (user may have set these):
- AM: ${params.amName || ""}
- Lunch: ${params.lunchName || ""}
- PM: ${params.pmName || ""}
- Dinner: ${params.dinnerName || ""}

If a slot is empty, you may recommend a park from the region's catalogue. Otherwise respect the user's choice.

Return the JSON only.`;
}

function mapApiModelToAiDayModelId(anthropicModel: string): AiDayTimelineModelId {
  return anthropicModel.includes("sonnet") ? "sonnet-4.6" : "haiku-4.5";
}

function parseAndValidateDayTimelineJson(
  raw: unknown,
): { ok: true; value: AiDayTimeline } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "root_not_object" };
  }
  const o = raw as Record<string, unknown>;
  const ph = o.park_hours;
  if (!ph || typeof ph !== "object" || Array.isArray(ph)) {
    return { ok: false, reason: "invalid_park_hours" };
  }
  const op = (ph as { open?: unknown }).open;
  const cl = (ph as { close?: unknown }).close;
  if (typeof op !== "string" || typeof cl !== "string") {
    return { ok: false, reason: "park_hours_not_strings" };
  }
  if (!/^\d{2}:\d{2}$/.test(op) || !/^\d{2}:\d{2}$/.test(cl)) {
    return { ok: false, reason: "park_hours_hhmm" };
  }
  if (!Array.isArray(o.timeline)) {
    return { ok: false, reason: "timeline_not_array" };
  }
  if (o.timeline.length < 3) {
    return { ok: false, reason: "timeline_too_short" };
  }
  const timeline: AiDayTimeline["timeline"] = [];
  for (const row of o.timeline) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, reason: "bad_timeline_row" };
    }
    const r = row as Record<string, unknown>;
    if (typeof r.time !== "string" || !/^\d{2}:\d{2}$/.test(r.time)) {
      return { ok: false, reason: "bad_time" };
    }
    if (typeof r.block !== "string" || !AI_DAY_TIMELINE_BLOCKS.has(r.block)) {
      return { ok: false, reason: "bad_block" };
    }
    if (typeof r.title !== "string" || !r.title.trim()) {
      return { ok: false, reason: "bad_title" };
    }
    let subtitle: string | undefined;
    if (r.subtitle != null) {
      if (typeof r.subtitle !== "string") return { ok: false, reason: "bad_subtitle" };
      const s = r.subtitle.trim();
      if (s) subtitle = sanitizeDayNote(s);
    }
    let tag: AiDayTimelineRowTag | undefined;
    if (r.tag != null) {
      if (typeof r.tag !== "string" || !AI_DAY_TIMELINE_TAGS.has(r.tag)) {
        return { ok: false, reason: "bad_tag" };
      }
      tag = r.tag as AiDayTimelineRowTag;
    }
    timeline.push({
      time: r.time,
      block: r.block as AiDayTimelineBlock,
      title: r.title.trim(),
      subtitle,
      tag,
    });
  }
  let heat: string | undefined;
  if (o.heat_plan != null) {
    if (typeof o.heat_plan !== "string") return { ok: false, reason: "bad_heat" };
    const h = o.heat_plan.trim();
    if (h) heat = sanitizeDayNote(h);
  }
  let transport: string | undefined;
  if (o.transport != null) {
    if (typeof o.transport !== "string") return { ok: false, reason: "bad_transport" };
    const t = o.transport.trim();
    if (t) transport = sanitizeDayNote(t);
  }
  if (!Array.isArray(o.must_do)) {
    return { ok: false, reason: "must_do_not_array" };
  }
  if (o.must_do.length < 3 || o.must_do.length > 5) {
    return { ok: false, reason: "must_do_count" };
  }
  const must_do: string[] = [];
  for (const m of o.must_do) {
    if (typeof m !== "string" || !m.trim()) {
      return { ok: false, reason: "bad_must_do" };
    }
    must_do.push(sanitizeDayNote(m.trim()));
  }
  const value: AiDayTimeline = {
    generated_at: "",
    model: "haiku-4.5",
    park_hours: { open: op, close: cl },
    timeline,
    heat_plan: heat,
    transport,
    must_do,
  };
  return { ok: true, value };
}

export type GenerateDayTimelineResult =
  | {
      ok: true;
      timeline: AiDayTimeline;
      /** Full `assignments` after syncing slot start times from the AI timeline (Pro drag strip + calendar). */
      assignments: Assignments;
    }
  | {
      ok: false;
      error: string;
      code: "rate_limit" | "tier_limit" | "invalid_day" | "ai_failure";
    };

export async function generateDayTimeline(
  tripId: string,
  date: string, // ISO yyyy-mm-dd
): Promise<GenerateDayTimelineResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Not signed in.", code: "ai_failure" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "AI is not configured.",
      code: "ai_failure",
    };
  }

  let dateKey: string;
  try {
    dateKey = formatDateKey(parseDate(`${date}T12:00:00`));
  } catch {
    return { ok: false, error: "Invalid date.", code: "invalid_day" };
  }

  try {
    await assertTierAllows(user.id, "ai");
  } catch (e) {
    const mapped = tierErrorToClientPayload(e);
    if (mapped?.code === "TIER_AI_DISABLED") {
      return {
        ok: false,
        error:
          mapped.error ||
          "Smart Plan is not available on your current plan. Upgrade on Pricing.",
        code: "tier_limit",
      };
    }
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        error: tierLoadFailureUserMessage(),
        code: "ai_failure",
      };
    }
    throw e;
  }

  let canGenerateAi: boolean;
  try {
    canGenerateAi = await currentUserCanGenerateAI();
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        error: tierLoadFailureUserMessage(),
        code: "ai_failure",
      };
    }
    throw e;
  }
  if (!canGenerateAi) {
    return {
      ok: false,
      error: "You have used your Smart Plan allowance on the Free plan.",
      code: "tier_limit",
    };
  }

  const trip = await getTripById(tripId);
  if (!trip || trip.owner_id !== user.id) {
    return { ok: false, error: "Trip not found.", code: "invalid_day" };
  }

  const rid =
    trip.region_id ??
    (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) {
    return {
      ok: false,
      error: "This trip needs a destination region.",
      code: "ai_failure",
    };
  }

  const region = await getRegionById(rid);
  if (!region) {
    return { ok: false, error: "Could not load region.", code: "ai_failure" };
  }

  const allowed = allowedDateKeys(trip.start_date, trip.end_date);
  if (!allowed.has(dateKey)) {
    return {
      ok: false,
      error: "This date is outside your trip dates.",
      code: "invalid_day",
    };
  }

  const dayDate = parseDate(`${dateKey}T12:00:00`);
  const month = dayDate.getMonth() + 1;
  const mc = getMonthlyConditions(rid, month);
  const tempC = mc ? Math.round(mc.tempHighC) : 22;
  const weatherSummary = mc
    ? `${mc.weatherEmoji} typical monthly high, ${mc.rainChance} chance of rain`
    : "seasonal average";

  const builtInParks = await getParksForRegion(rid);
  const customTileRows = await getCustomTilesForRegion(user.id, rid);
  const customAsParks = customTileRows.map(customTileToPark);
  const builtFiltered = trip.has_cruise
    ? builtInParks
    : builtInParks.filter((p) => !requiresCruiseSegment(p));
  const customFiltered = trip.has_cruise
    ? customAsParks
    : customAsParks.filter((p) => !requiresCruiseSegment(p));
  const parksForPrompt = [...builtFiltered, ...customFiltered];

  if (parksForPrompt.length === 0) {
    return {
      ok: false,
      error: "No parks are available for this region.",
      code: "ai_failure",
    };
  }

  const parkIdToName = new Map(
    parksForPrompt.map((p) => [p.id, p.name] as const),
  );
  const ass = trip.assignments[dateKey] ?? {};
  const amName = (() => {
    const id = getParkIdFromSlotValue(ass.am);
    return id ? (parkIdToName.get(id) ?? "") : "";
  })();
  const lunchName = (() => {
    const id = getParkIdFromSlotValue(ass.lunch);
    return id ? (parkIdToName.get(id) ?? "") : "";
  })();
  const pmName = (() => {
    const id = getParkIdFromSlotValue(ass.pm);
    return id ? (parkIdToName.get(id) ?? "") : "";
  })();
  const dinnerName = (() => {
    const id = getParkIdFromSlotValue(ass.dinner);
    return id ? (parkIdToName.get(id) ?? "") : "";
  })();

  const rawCrowd = (() => {
    const m = trip.preferences?.ai_day_crowd_notes;
    if (
      m &&
      typeof m === "object" &&
      !Array.isArray(m) &&
      typeof (m as Record<string, unknown>)[dateKey] === "string"
    ) {
      return sanitizeDayNote(
        String((m as Record<string, string>)[dateKey]).trim(),
      );
    }
    return "";
  })();
  const crowdLevel =
    rawCrowd.length > 0 ? rawCrowd : mc?.crowdLevel ?? "moderate";

  const skipDisney = trip.planning_preferences?.includeDisneySkipTips !== false;
  const skipUniversal =
    trip.planning_preferences?.includeUniversalSkipTips !== false;
  const skipLineOn = skipDisney || skipUniversal;

  const userBlock = buildDayTimelineUserMessage({
    trip,
    dateKey,
    amName,
    lunchName,
    pmName,
    dinnerName,
    crowdLevel,
    tempC,
    weatherSummary,
    skipLineOn,
  });

  const parksSystemText = buildParksListSystemText(
    `${region.name} (${region.country})`,
    parksForPrompt,
    customTileRows,
    trip.has_cruise,
  );
  const tripMetaCache = buildTripMetadataForDayTimelineCache(
    trip,
    `${region.name} (${region.country})`,
  );

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_generations_lifetime, tier")
    .eq("id", user.id)
    .maybeSingle();

  const model = smartPlanModelForProfileTier(
    (profile as { tier?: string } | null)?.tier,
  );

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: DAY_TIMELINE_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: tripMetaCache,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: parksSystemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userBlock }],
    });
    const block0 = msg.content[0];
    const rawText = block0?.type === "text" ? block0.text : "";
    const usage = msg.usage as AnthropicMessageUsage | undefined;
    inputTokens = inputTokensFromUsage(usage);
    outputTokens = usage?.output_tokens ?? 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawText));
    } catch {
      console.warn("[ai] day_timeline json_parse_failed", { tripId, dateKey });
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: tripId,
        prompt: `day_timeline:${dateKey}\n${userBlock}`,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: "Invalid JSON (day_timeline)",
      });
      return {
        ok: false,
        error: "The plan could not be read. Try again.",
        code: "ai_failure",
      };
    }

    const validated = parseAndValidateDayTimelineJson(parsed);
    if (!validated.ok) {
      console.warn("[ai] day_timeline validate_failed", {
        tripId,
        dateKey,
        reason: validated.reason,
      });
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: tripId,
        prompt: `day_timeline:${dateKey}\n${userBlock}`,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        status: "failed",
        error: `day_timeline validation: ${validated.reason}`,
      });
      return {
        ok: false,
        error: "The plan was incomplete. Try again.",
        code: "ai_failure",
      };
    }

    const { value: v } = validated;
    const value: AiDayTimeline = {
      ...v,
      generated_at: new Date().toISOString(),
      model: mapApiModelToAiDayModelId(model),
    };

    const parkIdToNameForSync = new Map(
      parksForPrompt.map((p) => [p.id, p.name] as const),
    );
    const nextAssignments = applyAiTimelineToAssignmentSlotTimes(
      trip.assignments,
      dateKey,
      value,
      parkIdToNameForSync,
    );

    const prevPrefs =
      trip.preferences && typeof trip.preferences === "object"
        ? { ...trip.preferences }
        : ({} as Record<string, unknown>);
    const existingDayMap = prevPrefs.ai_day_timeline;
    const dayMap: Record<string, AiDayTimeline> =
      existingDayMap &&
      typeof existingDayMap === "object" &&
      !Array.isArray(existingDayMap)
        ? { ...(existingDayMap as Record<string, AiDayTimeline>) }
        : {};
    dayMap[dateKey] = value;

    const { error: upErr } = await supabase
      .from("trips")
      .update({
        preferences: { ...prevPrefs, ai_day_timeline: dayMap },
        assignments: nextAssignments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("owner_id", user.id);

    if (upErr) {
      return { ok: false, error: upErr.message, code: "ai_failure" };
    }

    const { error: genInsertErr } = await supabase.from("ai_generations").insert(
      {
        user_id: user.id,
        trip_id: tripId,
        prompt: `day_timeline:${dateKey}\n${userBlock}`,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: true,
        status: "success",
        error: null,
      },
    );
    if (genInsertErr) {
      return {
        ok: false,
        error: `Could not log usage: ${genInsertErr.message}`,
        code: "ai_failure",
      };
    }

    const prevLifetime = Number(
      (profile as { ai_generations_lifetime?: number } | null)
        ?.ai_generations_lifetime ?? 0,
    );
    await supabase
      .from("profiles")
      .update({ ai_generations_lifetime: prevLifetime + 1 })
      .eq("id", user.id);

    revalidatePath("/planner");
    revalidatePath(`/trip/${tripId}`);
    return { ok: true, timeline: value, assignments: nextAssignments };
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 429) {
      return {
        ok: false,
        error: "Rate limited. Try again shortly.",
        code: "rate_limit",
      };
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.warn("[ai] day_timeline request_failed", { tripId, dateKey, msg });
    return { ok: false, error: msg, code: "ai_failure" };
  }
}
