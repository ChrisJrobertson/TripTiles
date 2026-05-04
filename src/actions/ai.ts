"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getCustomTilesForRegion } from "@/lib/db/custom-tiles";
import { getParksForRegion } from "@/lib/db/parks";
import { getRegionById } from "@/lib/db/regions";
import { getTripById, mapTripRow } from "@/lib/db/trips";
import {
  applyArrivalDayNoThemeParks,
  enforceAiPlanGuardrails,
  requiresCruiseSegment,
  sortDateKeysFromSet,
} from "@/lib/ai-plan-guardrails";
import {
  addDays,
  eachDateKeyInRange,
  formatDateKey,
  parseDate,
} from "@/lib/date-helpers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  formatDayRidePicksForPrompt,
  formatDaySlotLinesWithTimesForPrompt,
} from "@/lib/ai-day-prompt-context";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { applyAiTimelineToAssignmentSlotTimes } from "@/lib/ai-timeline-to-slot-times";
import type {
  AIDayStrategy,
  Assignment,
  Assignments,
  AiDayTimeline,
  AiDayTimelineBlock,
  AiDayTimelineModelId,
  AiDayTimelineRowTag,
  CustomTile,
  DaySnapshot,
  DaySnapshotPreferencesSubset,
  DaySnapshotSource,
  Park,
  SlotType,
  Trip,
} from "@/lib/types";
import { customTileToPark } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { awardAchievementAction } from "@/actions/achievements";
import { currentUserCanGenerateAI, currentUserCanGenerateDayStrategy } from "@/lib/entitlements";
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
import {
  formatPlanningPreferencesForPrompt,
  formatUserPrioritiesBlock,
} from "@/lib/planning-preferences-prompt";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import { getRidePrioritiesForDay, getAttractionsForPark } from "@/actions/ride-priorities";
import {
  assertTierAllows,
  tierErrorToClientPayload,
} from "@/lib/tier";
import { missingDayStrategyPlanningFields } from "@/lib/day-strategy-planning";
import { classifyThemeParkLine } from "@/lib/wizard-queue-step-region";
import { isThemePark } from "@/lib/park-categories";
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
import {
  collectUserBrief,
  formatCurrentTripAssignmentsBlock,
  formatMandatoryAnchorsBlock,
} from "@/lib/smart-plan-user-brief";
import { validateDayNotesAgainstAssignments } from "@/lib/smart-plan-validate";
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const SMART_PLAN_MODEL = "claude-haiku-4-5-20251001";
const AI_GENERATIONS_TOTAL_COLUMN =
  `ai_generations_${"life"}${"time"}` as const;

function smartPlanModelForProfileTier(
  tier: string | null | undefined,
): string {
  void tier;
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

BOOKED RETURN CONSTRAINTS

Rides prefixed with "🔒 BOOKED RETURN HH:MM" have confirmed real-world return windows. These are immovable:

- DO NOT suggest removing, replacing, or rescheduling a booked ride.
- DO sequence other activities around the booked return time. The guest must be physically able to reach the ride for the window.
- DO acknowledge each booked return in the "skip_line_return_echo" field of your JSON response, matching the exact HH:mm and the same ride as in the user list (use the "attraction_id" from the ride list for that date, plus "hhmm").
- If a booked return conflicts with the rest of the plan (e.g. a dining reservation at the same time), raise it in "planner_day_notes" for that date so the guest can decide — do not silently resolve it.

Booked returns are often paid (Single Pass / Individual Lightning Lane) or time-limited (Multi Pass / Genie+). Protecting them is the single most important job of this plan.

USER CONSTRAINTS RULES

- The "USER CONSTRAINTS" user-message block (when present) contains the guest's own words about bookings, preferences, and commitments.
- Treat every time-specific statement as an immovable anchor, equivalent in importance to a booked Lightning Lane return. Example: a stated time for a named attraction must be sequenced to match that window, not shuffled to generic rope drop unless the note allows flexibility.
- Treat every park-specific preference as a hard requirement. Example: "We want to do Hollywood Studios on Tuesday" means Tuesday must match that request for AM/PM slots.
- If a user constraint conflicts with your crowd-pattern reasoning, the guest's constraint wins. Mention the tradeoff in planner_day_notes so they can decide.
- You may echo honoured constraints in "skip_line_return_echo" and/or a short "user_constraints_echo" string (UK English) listing what you respected.

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
const SLOT_TYPES: SlotType[] = ["am", "pm", "lunch", "dinner"];

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
        | "AI_ERROR"
        | "SMART_PLAN_TRUNCATED";
      message: string;
      partialResponse?: string;
      stoppedEarly?: boolean;
    };

type GenerateAIPlanOptions = {
  onTextDelta?: (deltaText: string) => void | Promise<void>;
  signal?: AbortSignal;
};

const DAY_TWEAK_SYSTEM = `You are tweaking ONE DAY of an existing theme park trip plan.
You MUST only modify the day specified.
You MUST NOT suggest changes to other days.
Output JSON only - no markdown, no commentary, no scoring leakage.

Schema:
{
  "assignments_for_day": {
    "AM": "<parkId or null>",
    "PM": "<parkId or null>",
    "LUN": "<parkId or null>",
    "DIN": "<parkId or null>"
  },
  "day_note": "<short tip, <=120 chars, UK English>",
  "crowd_level": "<quiet|moderate|busy>"
}`;

type DayTweakMode = "smart_suggest" | "freetext";

export type DayTweakProposed = {
  assignments_for_day: Assignment;
  preferences_subset: DaySnapshotPreferencesSubset;
  note?: string;
};

export type DayTweakResult =
  | {
      status: "preview";
      proposed: DayTweakProposed;
      model: string;
      generationsUsedForTrip: number;
    }
  | {
      status: "applied";
      proposed: DayTweakProposed;
      assignments: Assignments;
      preferences: Record<string, unknown>;
      daySnapshots: DaySnapshot[];
      model: string;
      generationsUsedForTrip: number;
    }
  | { status: "error"; error: string; code?: "tier_limit" | "invalid_day" | "ai_failure" }
  | { status: "cancelled" };

function readDateStringMapValue(
  prefs: Record<string, unknown>,
  key: string,
  date: string,
): unknown {
  const raw = prefs[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return (raw as Record<string, unknown>)[date];
}

function readDayPreferencesSubset(
  prefs: Record<string, unknown>,
  date: string,
): DaySnapshotPreferencesSubset {
  const timeline = readDateStringMapValue(prefs, "ai_day_timeline", date);
  const crowd = readDateStringMapValue(prefs, "ai_day_crowd_notes", date);
  const note = readDateStringMapValue(prefs, "day_notes", date);
  const strategy = readDateStringMapValue(prefs, "ai_day_strategy", date);
  return {
    ...(timeline !== undefined ? { ai_day_timeline: timeline } : {}),
    ...(typeof crowd === "string" ? { ai_day_crowd_notes: crowd } : {}),
    ...(typeof note === "string" ? { day_notes: note } : {}),
    ...(strategy !== undefined
      ? { ai_day_strategy: strategy as AIDayStrategy | null }
      : {}),
  };
}

function setMapValueForDate(
  prefs: Record<string, unknown>,
  key: string,
  date: string,
  value: unknown,
): void {
  const raw = prefs[key];
  const map =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (value === undefined || value === null || value === "") {
    delete map[date];
  } else {
    map[date] = value;
  }
  if (Object.keys(map).length === 0) delete prefs[key];
  else prefs[key] = map;
}

function mergeDayPreferencesSubset(
  base: Record<string, unknown>,
  date: string,
  subset: DaySnapshotPreferencesSubset,
): Record<string, unknown> {
  const next = { ...base };
  setMapValueForDate(next, "ai_day_timeline", date, subset.ai_day_timeline);
  setMapValueForDate(next, "ai_day_crowd_notes", date, subset.ai_day_crowd_notes);
  setMapValueForDate(next, "day_notes", date, subset.day_notes);
  setMapValueForDate(next, "ai_day_strategy", date, subset.ai_day_strategy);
  return next;
}

function buildAssignmentsWithDay(
  base: Assignments,
  date: string,
  day: Assignment,
): Assignments {
  const next = { ...base };
  const cleaned: Assignment = {};
  for (const slot of SLOT_TYPES) {
    const val = day[slot];
    if (typeof val === "string" && val.trim()) cleaned[slot] = val.trim();
    else if (val && typeof val === "object") cleaned[slot] = val;
  }
  if (Object.keys(cleaned).length > 0) next[date] = cleaned;
  else delete next[date];
  return next;
}

function parseDayTweakJson(
  parsed: unknown,
  resolver: AiParkIdResolver,
): DayTweakProposed | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const rawAssignments = obj.assignments_for_day;
  if (
    !rawAssignments ||
    typeof rawAssignments !== "object" ||
    Array.isArray(rawAssignments)
  ) {
    return null;
  }
  const source = rawAssignments as Record<string, unknown>;
  const aliases: Record<SlotType, string[]> = {
    am: ["AM", "am"],
    pm: ["PM", "pm"],
    lunch: ["LUN", "lunch", "LUNCH"],
    dinner: ["DIN", "dinner", "DINNER"],
  };
  const assignments_for_day: Assignment = {};
  for (const slot of SLOT_TYPES) {
    let raw: unknown;
    for (const key of aliases[slot]) {
      if (key in source) {
        raw = source[key];
        break;
      }
    }
    if (raw == null || raw === "") continue;
    if (typeof raw !== "string") return null;
    const canon = resolver.resolve(raw);
    if (canon == null) return null;
    assignments_for_day[slot] = canon;
  }
  const dayNote =
    typeof obj.day_note === "string"
      ? sanitizeDayNote(softTruncateToMax(obj.day_note.trim(), 120))
      : "";
  const crowd =
    obj.crowd_level === "quiet" ||
    obj.crowd_level === "moderate" ||
    obj.crowd_level === "busy"
      ? `Crowds look ${obj.crowd_level} for this adjusted day.`
      : undefined;
  return {
    assignments_for_day,
    preferences_subset: {
      ...(crowd ? { ai_day_crowd_notes: crowd } : {}),
      ...(dayNote ? { day_notes: dayNote } : {}),
    },
    ...(dayNote ? { note: dayNote } : {}),
  };
}

function normaliseDaySnapshots(raw: unknown): DaySnapshot[] {
  return Array.isArray(raw)
    ? (raw.filter(
        (snap) => snap && typeof snap === "object" && !Array.isArray(snap),
      ) as DaySnapshot[])
    : [];
}

function nextDaySnapshots(
  existing: unknown,
  date: string,
  before: DaySnapshot["before"],
  after: DaySnapshot["after"],
  source: DaySnapshotSource,
  model: string,
): DaySnapshot[] {
  const snap: DaySnapshot = {
    date,
    before,
    after,
    model,
    created_at: new Date().toISOString(),
    source,
  };
  return [...normaliseDaySnapshots(existing), snap]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
}

async function fetchOwnedTripForAi(
  tripId: string,
  userId: string,
): Promise<Trip | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapTripRow(data as Record<string, unknown>);
}

export async function pushDaySnapshot(
  tripId: string,
  date: string,
  before: DaySnapshot["before"],
  after: DaySnapshot["after"],
  source: DaySnapshotSource,
  model: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("trips")
    .select("day_snapshots")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return;
  await admin
    .from("trips")
    .update({
      day_snapshots: nextDaySnapshots(
        (data as { day_snapshots?: unknown }).day_snapshots,
        date,
        before,
        after,
        source,
        model,
      ),
    })
    .eq("id", tripId)
    .eq("owner_id", user.id);
}

export async function popDaySnapshot(
  tripId: string,
  date: string,
): Promise<
  | {
      restored: true;
      assignments: Assignments;
      preferences: Record<string, unknown>;
      daySnapshots: DaySnapshot[];
      snapshot: { before: DaySnapshot["before"] };
    }
  | { restored: false; error?: string }
> {
  const user = await getCurrentUser();
  if (!user) return { restored: false, error: "Not signed in." };
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("trips")
    .select("assignments, preferences, day_snapshots")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !data) return { restored: false, error: "Trip not found." };

  const snapshots = normaliseDaySnapshots(
    (data as { day_snapshots?: unknown }).day_snapshots,
  );
  const match = snapshots
    .filter((snap) => snap.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!match) return { restored: false, error: "Nothing to undo." };

  const remaining = snapshots.filter((snap) => snap !== match);
  const baseAssignments =
    data.assignments && typeof data.assignments === "object"
      ? (data.assignments as Assignments)
      : {};
  const basePrefs =
    data.preferences && typeof data.preferences === "object"
      ? (data.preferences as Record<string, unknown>)
      : {};
  const assignments = buildAssignmentsWithDay(
    baseAssignments,
    date,
    match.before.assignments_for_day,
  );
  const preferences = mergeDayPreferencesSubset(
    basePrefs,
    date,
    match.before.preferences_subset,
  );
  const { error: upErr } = await admin
    .from("trips")
    .update({
      assignments,
      preferences,
      day_snapshots: remaining,
      updated_at: new Date().toISOString(),
      last_opened_at: new Date().toISOString(),
    })
    .eq("id", tripId)
    .eq("owner_id", user.id);
  if (upErr) return { restored: false, error: upErr.message };
  revalidatePath("/planner");
  revalidatePath(`/trip/${tripId}`);
  return {
    restored: true,
    assignments,
    preferences,
    daySnapshots: remaining,
    snapshot: { before: match.before },
  };
}

async function applyDayTweakProposal(params: {
  trip: Trip;
  userId: string;
  date: string;
  proposed: DayTweakProposed;
  source: DaySnapshotSource;
  model: string;
}): Promise<Extract<DayTweakResult, { status: "applied" }> | { status: "error"; error: string }> {
  const { trip, userId, date, proposed, source, model } = params;
  const admin = createServiceRoleClient();
  const before = {
    assignments_for_day: trip.assignments[date] ?? {},
    preferences_subset: readDayPreferencesSubset(trip.preferences ?? {}, date),
  };
  const after = {
    assignments_for_day: proposed.assignments_for_day,
    preferences_subset: proposed.preferences_subset,
  };
  const assignments = buildAssignmentsWithDay(
    trip.assignments,
    date,
    proposed.assignments_for_day,
  );
  const preferences = mergeDayPreferencesSubset(
    trip.preferences ?? {},
    date,
    proposed.preferences_subset,
  );
  const daySnapshots = nextDaySnapshots(
    trip.day_snapshots,
    date,
    before,
    after,
    source,
    model,
  );
  const now = new Date().toISOString();
  const { error } = await admin
    .from("trips")
    .update({
      assignments,
      preferences,
      day_snapshots: daySnapshots,
      updated_at: now,
      last_opened_at: now,
    })
    .eq("id", trip.id)
    .eq("owner_id", userId);
  if (error) return { status: "error", error: error.message };

  revalidatePath("/planner");
  revalidatePath(`/trip/${trip.id}`);
  return {
    status: "applied",
    proposed,
    assignments,
    preferences,
    daySnapshots,
    model,
    generationsUsedForTrip: 0,
  };
}

async function incrementAiGenerationCounter(
  userId: string,
  previousProfile: Record<string, number | undefined> | null,
): Promise<void> {
  const supabase = await createClient();
  const prevTotal = Number(previousProfile?.[AI_GENERATIONS_TOTAL_COLUMN] ?? 0);
  await supabase
    .from("profiles")
    .update({ [AI_GENERATIONS_TOTAL_COLUMN]: prevTotal + 1 })
    .eq("id", userId);
}

type AiGenerationStatus = "pending" | "success" | "failed" | "cancelled";

type AiGenerationInsertResult = {
  error: { message: string } | null;
};

async function recordAiGeneration(params: {
  userId: string;
  tripId: string;
  prompt: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  success?: boolean;
  status: AiGenerationStatus;
  error: string | null;
}): Promise<AiGenerationInsertResult> {
  try {
    const admin = createServiceRoleClient();
    const { error } = await admin.from("ai_generations").insert({
      user_id: params.userId,
      trip_id: params.tripId,
      prompt: params.prompt,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost_gbp_pence: null,
      success: params.success ?? params.status === "success",
      status: params.status,
      error: params.error,
    });
    if (!error) return { error: null };
    console.error("[ai] ai_generations insert failed", {
      tripId: params.tripId,
      status: params.status,
      message: error.message,
    });
    return { error: { message: error.message } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[ai] ai_generations insert crashed", {
      tripId: params.tripId,
      status: params.status,
      message,
    });
    return { error: { message } };
  }
}

async function successfulAiGenerationCount(
  tripId: string,
  userId: string,
): Promise<number> {
  try {
    return Math.max(1, await getSuccessfulAiGenerationCountForTrip(tripId, userId));
  } catch {
    return 1;
  }
}

function dayTweakSourceForMode(mode: DayTweakMode): DaySnapshotSource {
  return mode === "freetext" ? "ai_day_freetext" : "ai_day_smart_suggest";
}

export async function tweakDay(input: {
  tripId: string;
  date: string;
  mode: DayTweakMode;
  freetext?: string;
  preview: boolean;
}): Promise<DayTweakResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "Not signed in.", code: "ai_failure" };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "error", error: "AI is not configured.", code: "ai_failure" };
  }
  if (input.mode === "freetext" && !input.freetext?.trim()) {
    return { status: "error", error: "Tell the AI what to change.", code: "invalid_day" };
  }
  if (input.freetext && input.freetext.length > 500) {
    return { status: "error", error: "Keep requests to 500 characters.", code: "invalid_day" };
  }

  try {
    await assertTierAllows(user.id, "ai");
    if (!(await currentUserCanGenerateAI())) {
      return {
        status: "error",
        error: "You have used your Smart Plan allowance on the Free plan.",
        code: "tier_limit",
      };
    }
  } catch (e) {
    const mapped = tierErrorToClientPayload(e);
    if (mapped?.code === "TIER_AI_DISABLED") {
      return {
        status: "error",
        error:
          mapped.error ||
          "Smart Plan is not available on your current plan. Upgrade on Pricing.",
        code: "tier_limit",
      };
    }
    if (isTierLoadFailure(e)) {
      return {
        status: "error",
        error: tierLoadFailureUserMessage(),
        code: "ai_failure",
      };
    }
    throw e;
  }

  let dateKey: string;
  try {
    dateKey = formatDateKey(parseDate(`${input.date}T12:00:00`));
  } catch {
    return { status: "error", error: "Invalid date.", code: "invalid_day" };
  }

  const trip = await fetchOwnedTripForAi(input.tripId, user.id);
  if (!trip) return { status: "error", error: "Trip not found.", code: "invalid_day" };
  const allowed = allowedDateKeys(trip.start_date, trip.end_date);
  if (!allowed.has(dateKey)) {
    return {
      status: "error",
      error: "This date is outside your trip dates.",
      code: "invalid_day",
    };
  }

  const rid = trip.region_id ?? (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) {
    return {
      status: "error",
      error: "This trip needs a destination region.",
      code: "ai_failure",
    };
  }
  const region = await getRegionById(rid);
  if (!region) return { status: "error", error: "Could not load region.", code: "ai_failure" };

  const builtInParks = await getParksForRegion(rid);
  const customTileRows = await getCustomTilesForRegion(user.id, rid);
  const customAsParks = customTileRows.map(customTileToPark);
  const parksForPrompt = [
    ...(trip.has_cruise ? builtInParks : builtInParks.filter((p) => !requiresCruiseSegment(p))),
    ...(trip.has_cruise ? customAsParks : customAsParks.filter((p) => !requiresCruiseSegment(p))),
  ];
  const parkResolver = buildAiParkIdResolver(parksForPrompt, input.tripId);
  const parkNameById = new Map(parksForPrompt.map((p) => [p.id, p.name] as const));
  const sortedDates = [...allowed].sort();
  const dayNumber = sortedDates.indexOf(dateKey) + 1;
  const currentDay = trip.assignments[dateKey] ?? {};
  const otherDays = sortedDates
    .filter((d) => d !== dateKey)
    .map((d) => `${d}: ${JSON.stringify(trip.assignments[d] ?? {})}`)
    .join("\n");
  const model = smartPlanModelForProfileTier(undefined);
  const tripPrefs = trip.planning_preferences
    ? formatPlanningPreferencesForPrompt(trip.planning_preferences, parkNameById)
    : "";
  const parksSystemText = buildParksListSystemText(
    `${region.name} (${region.country})`,
    parksForPrompt,
    customTileRows,
    trip.has_cruise,
  );
  const userPrompt = `Trip: ${trip.family_name}, ${region.name}, ${trip.start_date}-${trip.end_date}, ${trip.adults} adults / ${trip.children} children aged ${(trip.child_ages ?? []).join(", ") || "none"}
Day to tweak: ${dateKey} (Day ${dayNumber} of ${sortedDates.length})
Current day state: ${JSON.stringify(currentDay)}
Current day labels: ${SLOT_TYPES.map((slot) => {
    const id = getParkIdFromSlotValue(currentDay[slot]);
    return `${slot}: ${id ? (parkNameById.get(id) ?? id) : "empty"}`;
  }).join(", ")}
Other days assigned (DO NOT MODIFY):
${otherDays || "None"}
User trip preferences:
${tripPrefs || "No saved Smart Plan preferences."}
${input.mode === "freetext" ? `\nUSER REQUEST: ${input.freetext?.trim()}` : ""}`;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(`${AI_GENERATIONS_TOTAL_COLUMN}, tier`)
    .eq("id", user.id)
    .maybeSingle();

  let inputTokens = 0;
  let outputTokens = 0;
  let aiGenStatus: AiGenerationStatus = "pending";
  let aiGenError: string | null = null;
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: [
        { type: "text", text: DAY_TWEAK_SYSTEM },
        {
          type: "text",
          text: parksSystemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const usage = msg.usage as AnthropicMessageUsage | undefined;
    inputTokens = inputTokensFromUsage(usage);
    outputTokens = usage?.output_tokens ?? 0;
    const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const proposed = parseDayTweakJson(
      JSON.parse(stripCodeFences(rawText)),
      parkResolver,
    );
    if (!proposed) throw new Error("AI returned an invalid day plan.");
    aiGenStatus = "success";
    await incrementAiGenerationCounter(
      user.id,
      profile as Record<string, number | undefined> | null,
    );
    const generationsUsedForTrip = await successfulAiGenerationCount(
      input.tripId,
      user.id,
    );
    if (input.preview) {
      return { status: "preview", proposed, model, generationsUsedForTrip };
    }
    const applied = await applyDayTweakProposal({
      trip,
      userId: user.id,
      date: dateKey,
      proposed,
      source: dayTweakSourceForMode(input.mode),
      model,
    });
    if (applied.status === "applied") {
      return { ...applied, generationsUsedForTrip };
    }
    aiGenStatus = "failed";
    aiGenError = applied.error.slice(0, 1000);
    return { status: "error", error: applied.error, code: "ai_failure" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    aiGenStatus = isAbortLikeError(e) ? "cancelled" : "failed";
    aiGenError = msg.slice(0, 1000);
    return { status: "error", error: msg, code: "ai_failure" };
  } finally {
    if (aiGenStatus !== "pending") {
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: `tweakDay:${input.mode}:${dateKey}:preview=${input.preview ? "on" : "off"}`,
        model,
        inputTokens,
        outputTokens,
        status: aiGenStatus,
        error: aiGenError,
      });
    }
  }
}

export async function confirmTweakDay(input: {
  tripId: string;
  date: string;
  mode: DayTweakMode;
  proposed: DayTweakProposed;
  model?: string;
}): Promise<DayTweakResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "Not signed in.", code: "ai_failure" };
  try {
    await assertTierAllows(user.id, "ai");
  } catch (e) {
    const mapped = tierErrorToClientPayload(e);
    return {
      status: "error",
      error: mapped?.error || "Smart Plan is not available on your current plan.",
      code: "tier_limit",
    };
  }
  const dateKey = formatDateKey(parseDate(`${input.date}T12:00:00`));
  const trip = await fetchOwnedTripForAi(input.tripId, user.id);
  if (!trip) return { status: "error", error: "Trip not found.", code: "invalid_day" };
  const applied = await applyDayTweakProposal({
    trip,
    userId: user.id,
    date: dateKey,
    proposed: input.proposed,
    source: dayTweakSourceForMode(input.mode),
    model: input.model ?? smartPlanModelForProfileTier(undefined),
  });
  if (applied.status === "error") {
    return { status: "error", error: applied.error, code: "ai_failure" };
  }
  return applied;
}

class SmartPlanAbortError extends Error {
  constructor() {
    super("Smart Plan cancelled");
    this.name = "AbortError";
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
}

/**
 * Region IDs whose primary value is theme parks. Used by the post-Smart-Plan
 * sanity check to detect rest-day-dominated plans on park trips. Other region
 * IDs (e.g. London, Bath, Edinburgh) are sights/dining-led and would
 * legitimately produce few `disney`/`universal` slots.
 */
const PARK_HEAVY_REGION_IDS: ReadonlySet<string> = new Set([
  "orlando",
  "cali",
  "paris",
  "tokyo",
  "osaka",
  "hongkong",
  "shanghai",
  "florida_combo",
  "miami",
  "uae",
  "spain",
  "denmark",
  "germany",
  "netherlands",
  "sweden",
  "goldcoast",
]);

const PARK_LIKE_GROUPS: ReadonlySet<string> = new Set([
  "disney",
  "disneyextra",
  "universal",
  "seaworld",
  "attractions",
]);

/**
 * Post-merge sanity check: detect plans dominated by rest/dining/transit slots
 * on park-heavy regions. Log-only — never blocks the response. The warning
 * text is also appended to `ai_generations.error` (with a `low_park_density:`
 * prefix) so we can grep production data for repeat occurrences.
 */
function checkPlanQuality(args: {
  tripId: string;
  regionId: string | null;
  assignments: Assignments;
  parksById: Map<string, Park>;
  days: number;
}): string | null {
  const { tripId, regionId, assignments, parksById, days } = args;
  if (days < 5) return null;
  if (!regionId || !PARK_HEAVY_REGION_IDS.has(regionId)) return null;

  let parkSlots = 0;
  let restSlots = 0;
  let totalAssigned = 0;
  for (const day of Object.values(assignments)) {
    if (!day || typeof day !== "object") continue;
    for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
      const raw = day[slot];
      const pid = getParkIdFromSlotValue(raw);
      if (!pid) continue;
      totalAssigned += 1;
      const group = parksById.get(pid)?.park_group;
      if (group && PARK_LIKE_GROUPS.has(group)) {
        parkSlots += 1;
      } else if (pid === "rest" || pid === "pool") {
        restSlots += 1;
      }
    }
  }

  if (parkSlots >= days / 2) return null;

  const warning = `low_park_density: parkSlots=${parkSlots}, restSlots=${restSlots}, totalAssigned=${totalAssigned}, days=${days}, region=${regionId}`;
  console.warn("[smart-plan] low-park-density-warning", {
    tripId,
    regionId,
    days,
    parkSlots,
    restSlots,
    totalAssigned,
  });
  return warning;
}

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
  /** Collected `collectUserBrief` output (empty if none). */
  userBrief: string;
  /** Preformatted `formatCurrentTripAssignmentsBlock` (empty for day scope, or
   * empty in OVERWRITE mode where we use `mandatoryAnchorsBlock` instead). */
  fullTripAssignmentsBlock: string;
  /** Preformatted `formatMandatoryAnchorsBlock` — non-empty only in OVERWRITE
   * mode (full trip). Used as the surviving anchor list when assignments are
   * intentionally wiped. */
  mandatoryAnchorsBlock: string;
  /** Concise USER PRIORITIES block in OVERWRITE-mode framing — emitted at the
   * very top of the prompt because in overwrite mode priorities ARE the plan.
   * Empty string when the trip has no `planning_preferences` or when not in
   * overwrite mode. The PRESERVE-mode equivalent is built by the caller and
   * inlined into `fullTripAssignmentsBlock` between the assignment lines and
   * the Rules section, so does not need a separate field here. */
  userPrioritiesBlockOverwrite: string;
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
    dateKey,
    regionName,
    trip,
    cruiseInstruction,
    childAges,
    crowdJson,
    userBrief,
    fullTripAssignmentsBlock,
    mandatoryAnchorsBlock,
    userPrioritiesBlockOverwrite,
    wizardContext,
    diningHint,
    namedRestaurantHint,
    existingDayPlanLines,
    dayRidePicksLines,
    preserveExistingSlots,
  } = params;

  const userConstraintsBlock =
    userBrief.trim().length > 0
      ? `USER CONSTRAINTS (verbatim — treat as immovable)

${userBrief.trim()}

END USER CONSTRAINTS

`
      : "";

  const isFullTrip = !dateKey;
  // Overwrite mode (full trip only): the "CURRENT TRIP ASSIGNMENTS … respect
  // them" + "NEVER change" block is intentionally omitted. The USER PRIORITIES
  // block + an OVERWRITE MODE directive replace it so Claude generates a
  // fresh plan rather than annotating prior rest/pool slots.
  const overwriteMode = isFullTrip && !preserveExistingSlots;
  const overwritePriorities = userPrioritiesBlockOverwrite.trim();
  const overwriteAnchors = mandatoryAnchorsBlock.trim();
  const overwriteIntro = overwriteMode
    ? `${overwritePriorities ? `${overwritePriorities}\n\n` : ""}OVERWRITE MODE — IGNORE PRIOR PLAN
The user has explicitly asked you to replace ANY existing assignments with a fresh plan based on their priorities above. Disregard any rest/pool slots, dining slots, or park assignments that may already be on the calendar — those were temporary and the user wants you to overwrite them.

Generate a complete fresh itinerary that:
- Honours the user's family priorities above (e.g. if "Thrill rides" is listed, prioritise theme parks with thrill attractions across the trip)
- Distributes rest days sensibly (typically 1 rest day per 4-5 park days, NOT consecutive blocks of rest)
- Uses crowd patterns to choose which park on which day
- Respects mandatory anchors only: arrival day (fly in), departure day (fly out), and any cruise embark/disembark dates${
        overwriteAnchors ? `\n\n${overwriteAnchors}` : ""
      }\n\n`
    : "";
  // Preserve mode (default): the assignments block already has the priorities
  // block injected between the lines and the Rules section by `runGenerateAIPlan`.
  const fullTripBlock =
    isFullTrip &&
    !overwriteMode &&
    fullTripAssignmentsBlock.trim().length > 0
      ? `${fullTripAssignmentsBlock.trim()}\n\n`
      : "";

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
    const smartIntro = dateKey
      ? "DAY-SCOPED SMART PLAN — refine this single calendar day using crowd patterns, slot block times, and (if any) the guest ride list. Respect locked calendar slots and notes above. Treat the day as a draft plan from historic patterns, not a guarantee."
      : overwriteMode
      ? `SMART PLAN MODE — FRESH GENERATION

Your job is to design a fresh itinerary from scratch based on the USER PRIORITIES above. Do not preserve or annotate prior rest/pool/dining assignments — replace them with park days where appropriate. Anchor only the arrival, departure, and cruise dates if present. For every other slot, choose what best serves the user's priorities.`
      : `SMART PLAN MODE

Your job is to annotate and complete the guest's existing plan:
- For dates with assigned parks: generate day_crowd_notes, planner_day_notes, and must_dos for THOSE parks.
- For dates with empty slots: recommend parks using crowd patterns and the guest's stated preferences, then write matching notes.
- Generate a trip-wide crowd_reasoning summary that accounts for the actual assignments.
- Populate must_dos from the parks the guest has assigned, not an idealised plan of your own.`;

    return `${userConstraintsBlock}${overwriteIntro}${fullTripBlock}${coreTrip}

${crowdSection}
${wizBlock}${dineBlock}${namedRestBlock}${cruiseTilePolicy}${dayScopeBlock}${calendarAlreadyBlock}${dayPacingAndRidesBlock}

${smartIntro}
${dateKey ? `For this date only (${dateKey}), add planner_day_notes with 1–2 practical tips tied to that date and the parks in CALENDAR / assignments.` : "For each trip day, add planner_day_notes with 1–2 practical tips tied to that date and the parks you use in assignments (rope drop, virtual queues, rest-day ideas, dining). Keep each value concise. Skip generic advice that applies to every day."}

Generate the itinerary JSON now (include crowd_reasoning, day_crowd_notes, and planner_day_notes when possible).`;
  }

  return `${userConstraintsBlock}${overwriteIntro}${fullTripBlock}${coreTrip}

${crowdSection}
${wizBlock}${dineBlock}${namedRestBlock}${cruiseTilePolicy}${dayScopeBlock}${calendarAlreadyBlock}${dayPacingAndRidesBlock}

CUSTOM PROMPT MODE — apply the USER CONSTRAINTS block and TRIP WIZARD PREFERENCES first, then use crowd patterns to improve date choices.
${!userConstraintsBlock.trim() ? `\n(The guest did not add a freeform brief — use structured preferences above and trip defaults.)\n` : ""}
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

  if (options.signal?.aborted) {
    return {
      ok: false,
      error: "AI_ERROR",
      message: "Smart Plan cancelled",
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
    .select(AI_GENERATIONS_TOTAL_COLUMN)
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
  const userBrief = collectUserBrief(trip, {
    inlineUserPrompt: input.userPrompt,
  });
  // PART 1 + PART 2: build USER PRIORITIES block(s).
  //
  // `userPrioritiesBlock` is the version inlined into the assignments block
  // (PRESERVE mode) — it sits between the assignment lines and the Rules
  // section so priorities are read BEFORE the rules. Header suffix matches
  // the preserve framing.
  //
  // `userPrioritiesBlockOverwrite` is the version emitted at the very top in
  // OVERWRITE mode with stronger language, since priorities ARE the plan in
  // that mode (no prior assignments to honour).
  const overwriteFlag =
    !normalizedDateKey && input.preserveExistingSlots === false;
  const userPrioritiesBlock = formatUserPrioritiesBlock(
    trip.planning_preferences,
    parkIdToName,
  );
  const userPrioritiesBlockOverwrite = overwriteFlag
    ? formatUserPrioritiesBlock(trip.planning_preferences, parkIdToName, {
        headerSuffix:
          "these are the most important inputs — design the plan around them",
      })
    : "";
  const fullTripAssignmentsBlock = normalizedDateKey
    ? ""
    : formatCurrentTripAssignmentsBlock(
        trip,
        parksById,
        userPrioritiesBlock || null,
      );
  // In OVERWRITE mode the full assignments list is intentionally omitted —
  // only mandatory anchors (flights, cruise embark/disembark) survive the
  // wipe so Claude generates a fresh plan based on USER PRIORITIES rather
  // than annotating prior rest days.
  const mandatoryAnchorsBlock = overwriteFlag
    ? formatMandatoryAnchorsBlock(trip, parksById)
    : "";
  const wizardContext =
    trip.planning_preferences != null
      ? formatPlanningPreferencesForPrompt(
          trip.planning_preferences,
          parkIdToName,
          { omitFreeformFamilyNotes: true },
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
    userBrief,
    fullTripAssignmentsBlock,
    mandatoryAnchorsBlock,
    userPrioritiesBlockOverwrite,
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
  // Diagnostic preview so we can verify in Vercel runtime logs that the
  // OVERWRITE branch is producing a different prompt structure than the
  // PRESERVE branch. Bounded to 300 chars to avoid log spam.
  console.log("[smart-plan-prompt] preview", {
    tripId: input.tripId,
    mode: input.mode,
    dateKey: normalizedDateKey,
    overwriteFlag,
    promptLength: composedUserMessage.length,
    opening: composedUserMessage.slice(0, 300),
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
        const SMART_MAIN_MAX = 16_384;
        const SMART_RETRY_MAX = 20_000;
        let lastStopReason: string | null = null;
        tokenTries: for (let tPass = 0; tPass < 2; tPass++) {
          const maxTok = tPass === 0 ? SMART_MAIN_MAX : SMART_RETRY_MAX;
          lastStopReason = null;
          rawText = "";
          logAiGen({
            step: "anthropic_call_start",
            tripId: input.tripId,
            userId: user.id,
            regionId: rid,
            mode: input.mode,
            parksCount: parksForPrompt.length,
            details: { planAttempt, tPass, maxTokens: maxTok },
          });
          const stream = await anthropic.messages.create(
            {
              model,
              max_tokens: maxTok,
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
            },
            options.signal ? { signal: options.signal } : undefined,
          );

          for await (const event of stream) {
            if (options.signal?.aborted) {
              throw new SmartPlanAbortError();
            }
            if (event.type === "message_start") {
              const usage = event.message.usage as
                | AnthropicMessageUsage
                | undefined;
              localInputTokens = inputTokensFromUsage(usage);
              localOutputTokens = usage?.output_tokens ?? localOutputTokens;
              continue;
            }
            if (event.type === "message_delta") {
              const md = event as {
                type: "message_delta";
                usage?: AnthropicMessageUsage;
                delta?: { stop_reason?: string | null };
              };
              const usage = md.usage;
              localOutputTokens = usage?.output_tokens ?? localOutputTokens;
              if (md.delta?.stop_reason) {
                lastStopReason = md.delta.stop_reason;
              }
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
          if (lastStopReason === "max_tokens" && tPass < 1) {
            logAiGen({
              step: "anthropic_max_tokens_retry",
              tripId: input.tripId,
              userId: user.id,
              details: { planAttempt, nextMax: SMART_RETRY_MAX },
            });
            continue tokenTries;
          }
          break tokenTries;
        }
        if (lastStopReason === "max_tokens") {
          inputTokens = localInputTokens;
          outputTokens = localOutputTokens;
          await recordAiGeneration({
            userId: user.id,
            tripId: input.tripId,
            prompt: currentUserMessage,
            model,
            inputTokens: localInputTokens,
            outputTokens: localOutputTokens,
            success: false,
            status: "failed",
            error: "truncated: stop_reason: max_tokens (after output budget increase)",
          });
          return {
            ok: false,
            error: "SMART_PLAN_TRUNCATED",
            message:
              "Your plan was too long to finish in one go. Please tap Regenerate to try again — we give the model more room on the next run. If that keeps happening, try shorter notes or email hello@triptiles.app.",
          };
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
            lastStopReason,
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
        await recordAiGeneration({
          userId: user.id,
          tripId: input.tripId,
          prompt: currentUserMessage,
          model,
          inputTokens: localInputTokens,
          outputTokens: localOutputTokens,
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
          await recordAiGeneration({
            userId: user.id,
            tripId: input.tripId,
            prompt: currentUserMessage,
            model,
            inputTokens: localInputTokens,
            outputTokens: localOutputTokens,
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
        await recordAiGeneration({
          userId: user.id,
          tripId: input.tripId,
          prompt: currentUserMessage,
          model,
          inputTokens: localInputTokens,
          outputTokens: localOutputTokens,
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
        await recordAiGeneration({
          userId: user.id,
          tripId: input.tripId,
          prompt: currentUserMessage,
          model,
          inputTokens: localInputTokens,
          outputTokens: localOutputTokens,
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
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: currentUserMessage,
        model,
        inputTokens: localInputTokens,
        outputTokens: localOutputTokens,
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
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: currentUserMessage,
        model,
        inputTokens,
        outputTokens,
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

    // Validate day notes against the post-generation, post-merge, post-sanitise
    // assignments — `merged` — not `trip.assignments` (the pre-generation state).
    // The previous comparison produced false-positive mismatch warnings on every run.
    const dayNoteAssignmentCheck = validateDayNotesAgainstAssignments(
      meta.planner_day_notes,
      merged,
      parksForPrompt,
      fullDateAllow,
    );
    if (dayNoteAssignmentCheck.warningText) {
      logAiGen({
        step: "planner_day_notes_park_mismatch",
        tripId: input.tripId,
        userId: user.id,
        details: { warning: dayNoteAssignmentCheck.warningText },
      });
    }

    // PART 3: post-merge sanity check. Logs and surfaces a warning in
    // `ai_generations.error` (prefixed `low_park_density:`) when a park-heavy
    // region produces a rest-day-dominated plan. Never blocks the response.
    const lowParkDensityWarning = checkPlanQuality({
      tripId: input.tripId,
      regionId: rid,
      assignments: merged,
      parksById,
      days: sortedDateKeys.length,
    });

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
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: currentUserMessage,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: "failed",
        error: upErr.message,
      });

      return { ok: false, error: "AI_ERROR", message: upErr.message };
    }

    const successWarnings = [
      dayNoteAssignmentCheck.warningText,
      lowParkDensityWarning,
    ]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join(" | ");
    const { error: genInsertErr } = await recordAiGeneration({
      userId: user.id,
      tripId: input.tripId,
      prompt: currentUserMessage,
      model,
      inputTokens,
      outputTokens,
      success: true,
      status: "success",
      error: successWarnings.length > 0 ? successWarnings : null,
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

    const prevTotal = Number(
      (profile as Record<string, number | undefined> | null)?.[
        AI_GENERATIONS_TOTAL_COLUMN
      ] ?? 0,
    );
    await supabase
      .from("profiles")
      .update({ [AI_GENERATIONS_TOTAL_COLUMN]: prevTotal + 1 })
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
    if (isAbortLikeError(e)) {
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: composedUserMessage,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: "cancelled",
        error: null,
      });
      return {
        ok: false,
        error: "AI_ERROR",
        message: "Smart Plan cancelled",
      };
    }
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
    await recordAiGeneration({
      userId: user.id,
      tripId: input.tripId,
      prompt: composedUserMessage,
      model,
      inputTokens,
      outputTokens,
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
    .select(`${AI_GENERATIONS_TOTAL_COLUMN}, tier`)
    .eq("id", user.id)
    .maybeSingle();

  const model = smartPlanModelForProfileTier(
    (profile as { tier?: string } | null)?.tier,
  );
  let rawText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let aiGenStatus: AiGenerationStatus = "pending";
  let aiGenError: string | null = null;
  // `recordAiGeneration` is invoked at most once per call: success and structured-failure
  // paths set this flag so the `finally` block doesn't double-write.
  let aiGenAlreadyLogged = false;
  const aiGenPrompt = `must_dos:${input.parkId}\n${userBlock}`;
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
    inputTokens = inputTokensFromUsage(usage);
    outputTokens = usage?.output_tokens ?? 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawText));
    } catch {
      aiGenStatus = "failed";
      aiGenError = "Invalid JSON (must_dos single park)";
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: aiGenStatus,
        error: aiGenError,
      });
      aiGenAlreadyLogged = true;
      return {
        ok: false,
        error: "We could not read the AI response. Please try again.",
        code: "AI_ERROR",
      };
    }
    const root = parsed as Record<string, unknown>;
    const items = normaliseMustDoItems(root.must_dos);
    if (items.length === 0) {
      aiGenStatus = "failed";
      aiGenError = "empty must_dos";
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: aiGenStatus,
        error: aiGenError,
      });
      aiGenAlreadyLogged = true;
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
      aiGenStatus = "failed";
      aiGenError = `trip update failed: ${upErr.message}`.slice(0, 1000);
      return { ok: false, error: upErr.message, code: "AI_ERROR" };
    }

    aiGenStatus = "success";
    const { error: genInsertErr } = await recordAiGeneration({
      userId: user.id,
      tripId: input.tripId,
      prompt: aiGenPrompt,
      model,
      inputTokens,
      outputTokens,
      success: true,
      status: aiGenStatus,
      error: null,
    });
    aiGenAlreadyLogged = true;
    if (genInsertErr) {
      return {
        ok: false,
        error: `Could not log usage: ${genInsertErr.message}`,
        code: "AI_ERROR",
      };
    }

    const prevTotal = Number(
      (profile as Record<string, number | undefined> | null)?.[
        AI_GENERATIONS_TOTAL_COLUMN
      ] ?? 0,
    );
    await supabase
      .from("profiles")
      .update({ [AI_GENERATIONS_TOTAL_COLUMN]: prevTotal + 1 })
      .eq("id", user.id);

    revalidatePath("/planner");
    return {
      ok: true,
      mustDos: items,
      nextPreferences: nextPreferences as Record<string, unknown>,
    };
  } catch (e) {
    aiGenStatus = isAbortLikeError(e) ? "cancelled" : "failed";
    const msg = e instanceof Error ? e.message : "Unknown error";
    aiGenError = aiGenStatus === "cancelled" ? null : msg.slice(0, 1000);
    return { ok: false, error: msg, code: "AI_ERROR" };
  } finally {
    if (!aiGenAlreadyLogged && aiGenStatus !== "pending") {
      // Always-write guarantee: if we reached the Anthropic call site we must record
      // the outcome (success/failed/cancelled) — never let an outer catch swallow logging.
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        status: aiGenStatus,
        error: aiGenError,
      });
    }
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
- When the user message includes "USER CONSTRAINTS", treat that block as immovable. Day notes, crowd hints, and timeline titles for this date must match the park(s) the guest has in their calendar for this day — not a different headline park.
- The guest's calendar slots for this date take precedence for park identity; nudge, never override silently.

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
  userConstraintsBlock: string;
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
  const uBlock = params.userConstraintsBlock.trim();
  return `${uBlock ? `${uBlock}\n\n` : ""}Trip: ${params.trip.adventure_name} — ${params.trip.destination} — ${params.trip.adults} adults, ${params.trip.children} children (ages ${childAges}).
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

  const brief = collectUserBrief(trip, {});
  const userConstraintsBlock = brief
    ? `USER CONSTRAINTS (verbatim — treat as immovable)

${brief}

END USER CONSTRAINTS`
    : "";
  const userBlock = buildDayTimelineUserMessage({
    userConstraintsBlock,
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
    .select(`${AI_GENERATIONS_TOTAL_COLUMN}, tier`)
    .eq("id", user.id)
    .maybeSingle();

  const model = smartPlanModelForProfileTier(
    (profile as { tier?: string } | null)?.tier,
  );

  let inputTokens = 0;
  let outputTokens = 0;
  let aiGenStatus: AiGenerationStatus = "pending";
  let aiGenError: string | null = null;
  // `recordAiGeneration` is invoked at most once per call: success and structured-failure
  // paths set this flag so the `finally` block doesn't double-write.
  let aiGenAlreadyLogged = false;
  const aiGenPrompt = `day_timeline:${dateKey}\n${userBlock}`;

  try {
    const DAY_TL_MAX = 8192;
    const DAY_TL_MAX_RETRY = 12_000;
    let msg: Awaited<ReturnType<typeof anthropic.messages.create>>;
    msg = await anthropic.messages.create({
      model,
      max_tokens: DAY_TL_MAX,
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
    if (msg.stop_reason === "max_tokens") {
      msg = await anthropic.messages.create({
        model,
        max_tokens: DAY_TL_MAX_RETRY,
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
    }
    if (msg.stop_reason === "max_tokens") {
      const uFail = msg.usage as AnthropicMessageUsage | undefined;
      inputTokens = inputTokensFromUsage(uFail);
      outputTokens = uFail?.output_tokens ?? 0;
      aiGenStatus = "failed";
      aiGenError = "truncated: stop_reason: max_tokens (day_timeline, after budget increase)";
      await recordAiGeneration({
        userId: user.id,
        tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: aiGenStatus,
        error: aiGenError,
      });
      aiGenAlreadyLogged = true;
      return {
        ok: false,
        error:
          "The day plan was cut off before it finished. Please try again — if it keeps happening, use shorter guest notes for this day.",
        code: "ai_failure",
      };
    }
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
      aiGenStatus = "failed";
      aiGenError = "Invalid JSON (day_timeline)";
      await recordAiGeneration({
        userId: user.id,
        tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: aiGenStatus,
        error: aiGenError,
      });
      aiGenAlreadyLogged = true;
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
      aiGenStatus = "failed";
      aiGenError = `day_timeline validation: ${validated.reason}`;
      await recordAiGeneration({
        userId: user.id,
        tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: aiGenStatus,
        error: aiGenError,
      });
      aiGenAlreadyLogged = true;
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
      aiGenStatus = "failed";
      aiGenError = `trip update failed: ${upErr.message}`.slice(0, 1000);
      return { ok: false, error: upErr.message, code: "ai_failure" };
    }

    aiGenStatus = "success";
    const { error: genInsertErr } = await recordAiGeneration({
      userId: user.id,
      tripId,
      prompt: aiGenPrompt,
      model,
      inputTokens,
      outputTokens,
      success: true,
      status: aiGenStatus,
      error: null,
    });
    aiGenAlreadyLogged = true;
    if (genInsertErr) {
      return {
        ok: false,
        error: `Could not log usage: ${genInsertErr.message}`,
        code: "ai_failure",
      };
    }

    const prevTotal = Number(
      (profile as Record<string, number | undefined> | null)?.[
        AI_GENERATIONS_TOTAL_COLUMN
      ] ?? 0,
    );
    await supabase
      .from("profiles")
      .update({ [AI_GENERATIONS_TOTAL_COLUMN]: prevTotal + 1 })
      .eq("id", user.id);

    revalidatePath("/planner");
    revalidatePath(`/trip/${tripId}`);
    return { ok: true, timeline: value, assignments: nextAssignments };
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    aiGenStatus = isAbortLikeError(e) ? "cancelled" : "failed";
    const msg = e instanceof Error ? e.message : "Unknown error";
    aiGenError = aiGenStatus === "cancelled" ? null : msg.slice(0, 1000);
    if (status === 429) {
      return {
        ok: false,
        error: "Rate limited. Try again shortly.",
        code: "rate_limit",
      };
    }
    console.warn("[ai] day_timeline request_failed", { tripId, dateKey, msg });
    return { ok: false, error: msg, code: "ai_failure" };
  } finally {
    if (!aiGenAlreadyLogged && aiGenStatus !== "pending") {
      // Always-write guarantee: if we reached the Anthropic call site we must record
      // the outcome (success/failed/cancelled) — never let an outer catch swallow logging.
      await recordAiGeneration({
        userId: user.id,
        tripId,
        prompt: aiGenPrompt,
        model,
        inputTokens,
        outputTokens,
        status: aiGenStatus,
        error: aiGenError,
      });
    }
  }
}

const DAY_STRATEGY_SYSTEM = `You are an expert theme park strategist creating a sequenced day plan for a family.

You have access to:
- Detailed information about every ride at the park
- The family's pass status (Lightning Lane Multi Pass, Express Pass, Single Rider preference)
- The family's mobility and height constraints
- Historical crowd patterns

Output JSON only — no commentary, no preamble.

Schema:
{
  "arrival_recommendation": "rope_drop" | "mid_morning" | "afternoon",
  "arrival_reason": "<one sentence why>",
  "ride_sequence": [
    {
      "time": "HH:MM",
      "type": "rope_drop" | "standby" | "lightning_lane" | "single_rider" | "meal" | "show" | "rest",
      "ride_or_event": "<exact ride name or event>",
      "notes": "<one sentence strategy>",
      "height_warning": "<only if min height applies, e.g. 'Min 40 inches'>"
    }
  ],
  "lightning_lane_strategy": {
    "multi_pass_bookings": [
      { "ride": "...", "book_for_time": "HH:MM", "reason": "..." }
    ],
    "single_pass_recommendations": ["..."]
  },
  "express_pass_strategy": {
    "priority_rides": ["..."],
    "skip_with_express": ["..."]
  },
  "warnings": ["..."]
}

Critical rules:
- Use realistic times: parks open ~09:00, close ~22:00
- Sequence rides geographically when possible (avoid backtracking)
- For Disney: respect Lightning Lane Multi Pass strategy (max 3 bookings, can book next after using one)
- For Universal: respect Express Pass status (if "no", recommend Single Rider for headliners)
- Flag any ride a child is too short for in height_warning
- If mobility says wheelchair/stroller, factor walking distances and accessible queues
- Do NOT recommend rides that don't exist at this park
- Output JSON only — no markdown, no commentary`;

function dominantThemeParkForDayStrategy(
  trip: Trip,
  dateKey: string,
  parkById: Map<string, Park>,
): { id: string; park: Park } | null {
  const ass = trip.assignments[dateKey] ?? {};
  for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
    const id = getParkIdFromSlotValue(ass[slot]);
    if (!id) continue;
    const p = parkById.get(id);
    if (p && isThemePark(p.park_group)) return { id, park: p };
  }
  return null;
}

function formatAttractionsBlockForDayStrategy(
  attractions: import("@/types/attractions").Attraction[],
): string {
  return attractions
    .map((a) => {
      const h =
        a.height_requirement_cm != null
          ? `${a.height_requirement_cm} cm min`
          : "no min height in catalogue";
      const sk = a.skip_line_system
        ? `${a.skip_line_system}${a.skip_line_tier ? ` (${a.skip_line_tier})` : ""}`
        : "standby/variable";
      return `- ${a.name} | ${h} | skip-line: ${sk}`;
    })
    .join("\n");
}

function buildOtherDaysStrategySummary(trip: Trip, excludeDate: string): string {
  const prefs = trip.preferences ?? {};
  const raw = prefs.ai_day_strategy;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "None recorded.";
  }
  const map = raw as Record<string, AIDayStrategy>;
  const lines: string[] = [];
  for (const dk of eachDateKeyInRange(trip.start_date, trip.end_date)) {
    if (dk === excludeDate) continue;
    const s = map[dk];
    if (!s?.ride_sequence?.length) continue;
    const bits = s.ride_sequence
      .slice(0, 5)
      .map((r) => r.ride_or_event)
      .join(", ");
    lines.push(`${dk}: ${bits}`);
  }
  return lines.length > 0 ? lines.join("\n") : "None recorded.";
}

const DAY_STRATEGY_STEP_TYPES = new Set<string>([
  "rope_drop",
  "standby",
  "lightning_lane",
  "single_rider",
  "meal",
  "show",
  "rest",
]);

function normaliseDayStrategyTime(
  raw: unknown,
  logTags: string[],
): string {
  if (typeof raw !== "string") {
    logTags.push("validation_warning:time_not_string");
    return "12:00";
  }
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    logTags.push(`validation_warning:time_unparsed:${t.slice(0, 12)}`);
    return "12:00";
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(min) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59
  ) {
    logTags.push(`validation_warning:time_out_of_range:${t.slice(0, 12)}`);
    return "12:00";
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normaliseLightningLaneStrategy(
  raw: unknown,
  logTags: string[],
): AIDayStrategy["lightning_lane_strategy"] | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    logTags.push("validation_warning:lightning_lane_invalid_shape");
    return undefined;
  }
  const l = raw as Record<string, unknown>;
  const mp = l.multi_pass_bookings;
  if (!Array.isArray(mp)) {
    logTags.push("validation_warning:lightning_lane_multi_pass_not_array");
    return undefined;
  }
  const multi_pass_bookings: NonNullable<
    AIDayStrategy["lightning_lane_strategy"]
  >["multi_pass_bookings"] = [];
  for (const b of mp) {
    if (!b || typeof b !== "object" || Array.isArray(b)) continue;
    const x = b as Record<string, unknown>;
    if (
      typeof x.ride === "string" &&
      typeof x.book_for_time === "string" &&
      typeof x.reason === "string"
    ) {
      multi_pass_bookings.push({
        ride: x.ride,
        book_for_time: normaliseDayStrategyTime(x.book_for_time, logTags),
        reason: x.reason,
      });
    }
  }
  const spr = l.single_pass_recommendations;
  const single_pass_recommendations = Array.isArray(spr)
    ? spr.filter((x): x is string => typeof x === "string")
    : undefined;
  return {
    multi_pass_bookings,
    ...(single_pass_recommendations?.length
      ? { single_pass_recommendations }
      : {}),
  };
}

function normaliseExpressPassStrategy(
  raw: unknown,
  logTags: string[],
): AIDayStrategy["express_pass_strategy"] | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    logTags.push("validation_warning:express_pass_invalid_shape");
    return undefined;
  }
  const e = raw as Record<string, unknown>;
  let pr: unknown = e.priority_rides;
  let sk: unknown = e.skip_with_express;
  if (typeof pr === "string") {
    logTags.push(
      "validation_warning:express_priority_rides_coerced_from_string",
    );
    pr = [pr];
  }
  if (typeof sk === "string") {
    logTags.push("validation_warning:express_skip_coerced_from_string");
    sk = [sk];
  }
  if (!Array.isArray(pr)) {
    logTags.push("validation_warning:express_priority_rides_defaulted_empty");
    pr = [];
  }
  if (!Array.isArray(sk)) {
    logTags.push("validation_warning:express_skip_defaulted_empty");
    sk = [];
  }
  const priority_rides = (pr as unknown[]).filter(
    (x): x is string => typeof x === "string",
  );
  const skip_with_express = (sk as unknown[]).filter(
    (x): x is string => typeof x === "string",
  );
  if (priority_rides.length === 0 && skip_with_express.length === 0) {
    return undefined;
  }
  return { priority_rides, skip_with_express };
}

/** Always returns a storable strategy after JSON parse — see `logTags` / `quality_warnings`. */
function validateAndNormaliseDayStrategy(
  parsed: unknown,
  ctx: {
    dateKey: string;
    parkId: string;
    model: string;
    parkLine: "disney" | "universal" | "other";
  },
): { strategy: AIDayStrategy; logTags: string[] } {
  const logTags: string[] = [];
  const qualityWarnings: string[] = [];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    logTags.push("validation_error:root_not_object");
    qualityWarnings.push(
      "The response was not a JSON object — this is a placeholder until you regenerate.",
    );
    return {
      strategy: {
        date: ctx.dateKey,
        park: ctx.parkId,
        generated_at: new Date().toISOString(),
        model: ctx.model,
        arrival_recommendation: "mid_morning",
        arrival_reason:
          "We could not read structured plan details from this response. Try Regenerate or plan manually.",
        ride_sequence: [
          {
            time: "09:00",
            type: "rest",
            ride_or_event: "Regenerate strategy",
            notes:
              "Open AI Day Strategy again for a fresh plan, or build the day manually.",
          },
        ],
        warnings: [],
        quality_warnings: qualityWarnings,
      },
      logTags,
    };
  }

  const o = parsed as Record<string, unknown>;

  let arrival: AIDayStrategy["arrival_recommendation"] = "mid_morning";
  const arRaw = o.arrival_recommendation;
  if (
    arRaw === "rope_drop" ||
    arRaw === "mid_morning" ||
    arRaw === "afternoon"
  ) {
    arrival = arRaw;
  } else if (arRaw != null && String(arRaw).trim() !== "") {
    logTags.push(
      `validation_warning:arrival_coerced:${String(arRaw).slice(0, 40)}`,
    );
    qualityWarnings.push(
      "Arrival timing was adjusted — the model returned an unrecognised label.",
    );
  } else {
    logTags.push("validation_warning:missing_arrival_recommendation");
    qualityWarnings.push("Arrival recommendation was missing — a default was used.");
  }

  let arrival_reason =
    typeof o.arrival_reason === "string" ? o.arrival_reason.trim() : "";
  if (!arrival_reason) {
    logTags.push("validation_error:missing_arrival_reason");
    arrival_reason =
      "Some narrative text was missing from the AI output — verify ride times and names on the day.";
    qualityWarnings.push("The short arrival explanation was missing or empty.");
  }

  const ride_sequence: AIDayStrategy["ride_sequence"] = [];
  const rawSeq = o.ride_sequence;
  if (!Array.isArray(rawSeq)) {
    logTags.push("validation_error:ride_sequence_not_array");
    qualityWarnings.push(
      "Ride sequence was missing or invalid — a placeholder step was added.",
    );
  } else {
    if (rawSeq.length === 0) {
      logTags.push("validation_warning:empty_ride_sequence");
      qualityWarnings.push(
        "The AI returned no ride steps — regenerate for a fuller plan.",
      );
    } else if (rawSeq.length < 3) {
      logTags.push(`validation_warning:short_ride_sequence:${rawSeq.length}`);
      qualityWarnings.push(
        `Only ${rawSeq.length} step(s) were returned — consider regenerating for a fuller day.`,
      );
    }

    for (let i = 0; i < rawSeq.length; i++) {
      const row = rawSeq[i];
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        logTags.push(`validation_warning:ride_step_skipped:${i}`);
        continue;
      }
      const r = row as Record<string, unknown>;
      let ride_or_event = "";
      if (typeof r.ride_or_event === "string" && r.ride_or_event.trim()) {
        ride_or_event = r.ride_or_event.trim();
      } else {
        ride_or_event = "Activity";
        logTags.push(`validation_warning:ride_or_event_defaulted:${i}`);
      }
      const typeRaw = r.type;
      let type: AIDayStrategy["ride_sequence"][number]["type"] = "standby";
      if (typeof typeRaw === "string" && DAY_STRATEGY_STEP_TYPES.has(typeRaw)) {
        type = typeRaw as AIDayStrategy["ride_sequence"][number]["type"];
      } else if (typeRaw != null && String(typeRaw).trim() !== "") {
        logTags.push(
          `validation_warning:unknown_ride_type:${String(typeRaw).slice(0, 32)}`,
        );
      }
      const time = normaliseDayStrategyTime(r.time, logTags);
      let notes = "";
      if (typeof r.notes === "string") {
        notes = r.notes;
      } else {
        logTags.push(`validation_warning:notes_defaulted_empty:${i}`);
      }
      const step: AIDayStrategy["ride_sequence"][number] = {
        time,
        type,
        ride_or_event,
        notes,
      };
      if (typeof r.height_warning === "string" && r.height_warning.trim()) {
        step.height_warning = r.height_warning.trim();
      }
      ride_sequence.push(step);
    }
  }

  if (ride_sequence.length === 0) {
    ride_sequence.push({
      time: "09:00",
      type: "rest",
      ride_or_event: "Plan your day",
      notes:
        "No valid ride steps were parsed — try Regenerate, or pick rides from your list below.",
    });
  }

  let lastMins = -1;
  for (const step of ride_sequence) {
    const [hh, mm] = step.time.split(":").map((x) => Number(x));
    const mins = hh * 60 + mm;
    if (lastMins >= 0 && mins < lastMins) {
      logTags.push("validation_warning:sequence_times_out_of_order");
      qualityWarnings.push(
        "Times may be out of order — double-check the sequence against park hours.",
      );
      break;
    }
    lastMins = mins;
  }

  const lightning_lane_strategy = normaliseLightningLaneStrategy(
    o.lightning_lane_strategy,
    logTags,
  );
  if (
    ctx.parkLine === "disney" &&
    o.lightning_lane_strategy != null &&
    !lightning_lane_strategy
  ) {
    logTags.push("validation_warning:lightning_lane_strategy_dropped_malformed");
    qualityWarnings.push(
      "Lightning Lane booking block could not be read — rope-drop and sequence advice may still help.",
    );
  } else if (ctx.parkLine === "disney" && !lightning_lane_strategy) {
    logTags.push("validation_warning:missing_lightning_lane_strategy");
  }

  const express_pass_strategy = normaliseExpressPassStrategy(
    o.express_pass_strategy,
    logTags,
  );
  if (
    ctx.parkLine === "universal" &&
    o.express_pass_strategy != null &&
    !express_pass_strategy
  ) {
    logTags.push("validation_warning:express_pass_strategy_dropped_malformed");
    qualityWarnings.push(
      "Express Pass strategy text could not be read — check ride order carefully.",
    );
  } else if (ctx.parkLine === "universal" && !express_pass_strategy) {
    logTags.push("validation_warning:missing_express_pass_strategy");
  }

  let topWarnings: string[] = [];
  if (Array.isArray(o.warnings)) {
    topWarnings = o.warnings.filter((x): x is string => typeof x === "string");
  } else if (o.warnings != null) {
    logTags.push("validation_warning:warnings_not_array");
    qualityWarnings.push(
      'The top-level "warnings" list was missing or invalid — AI caveats may be incomplete.',
    );
  }

  if (qualityWarnings.length > 0) {
    const unique = [...new Set(qualityWarnings)];
    qualityWarnings.length = 0;
    qualityWarnings.push(...unique);
  }

  const strategy: AIDayStrategy = {
    date: ctx.dateKey,
    park: ctx.parkId,
    generated_at: new Date().toISOString(),
    model: ctx.model,
    arrival_recommendation: arrival,
    arrival_reason,
    ride_sequence,
    warnings: topWarnings,
    ...(qualityWarnings.length > 0 ? { quality_warnings: qualityWarnings } : {}),
    ...(lightning_lane_strategy &&
    (lightning_lane_strategy.multi_pass_bookings.length > 0 ||
      (lightning_lane_strategy.single_pass_recommendations?.length ?? 0) > 0)
      ? { lightning_lane_strategy }
      : {}),
    ...(express_pass_strategy ? { express_pass_strategy } : {}),
  };

  return { strategy, logTags };
}

export async function generateDayStrategy(input: {
  tripId: string;
  date: string;
}): Promise<
  | {
      status: "success";
      strategy: AIDayStrategy;
    }
  | { status: "tier_blocked" }
  | { status: "missing_data"; missingDataFields: string[] }
  | { status: "no_park_assigned" }
  | { status: "error"; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "Not signed in." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "error", error: "AI is not configured." };
  }

  let dateKey: string;
  try {
    dateKey = formatDateKey(parseDate(`${input.date}T12:00:00`));
  } catch {
    return { status: "error", error: "Invalid date." };
  }

  const ent = await currentUserCanGenerateDayStrategy(input.tripId);
  if (ent === "tier_blocked") return { status: "tier_blocked" };

  const trip = await getTripById(input.tripId);
  if (!trip || trip.owner_id !== user.id) {
    return { status: "error", error: "Trip not found." };
  }

  const allowed = allowedDateKeys(trip.start_date, trip.end_date);
  if (!allowed.has(dateKey)) {
    return { status: "error", error: "Date outside trip." };
  }

  const rid =
    trip.region_id ??
    (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) return { status: "error", error: "Trip needs a region." };

  const region = await getRegionById(rid);
  if (!region) return { status: "error", error: "Could not load region." };

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
  const parkById = new Map(parksForPrompt.map((p) => [p.id, p] as const));

  const dom = dominantThemeParkForDayStrategy(trip, dateKey, parkById);
  if (!dom) return { status: "no_park_assigned" };

  const line = classifyThemeParkLine(dom.park);
  const missing = missingDayStrategyPlanningFields(trip.planning_preferences, line);
  if (missing.length > 0) {
    return { status: "missing_data", missingDataFields: missing };
  }

  const prefs = trip.planning_preferences;
  if (!prefs) {
    return { status: "missing_data", missingDataFields: ["mobility"] };
  }

  const attractions = await getAttractionsForPark(dom.id);
  const ridesBlock = formatAttractionsBlockForDayStrategy(attractions);
  const rideNamesLower = new Set(
    attractions.map((a) => a.name.trim().toLowerCase()),
  );

  const allDayKeys = eachDateKeyInRange(trip.start_date, trip.end_date);
  const dayIndex = allDayKeys.indexOf(dateKey) + 1;
  const totalDays = allDayKeys.length;
  const dow = parseDate(`${dateKey}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
  });

  const childBits =
    prefs.childHeights?.length && prefs.children > 0
      ? prefs.childHeights.map((h, i) => `child ${i + 1}: ~${h.heightCm} cm`).join("; ")
      : "no height data";

  let disneyPassSection = "";
  if (line === "disney" && prefs.disneyLightningLane) {
    const d = prefs.disneyLightningLane;
    disneyPassSection = `Disney — Multi Pass: ${d.multiPassStatus}; Single Pass willing to pay: ${d.singlePassWillingToPay}; Memory Maker: ${d.memoryMaker}`;
  }
  let universalPassSection = "";
  if (line === "universal" && prefs.universalExpress) {
    const u = prefs.universalExpress;
    universalPassSection = `Universal — Express: ${u.status}; Single rider OK: ${u.singleRiderOk}`;
  }
  const passSection =
    [disneyPassSection, universalPassSection].filter(Boolean).join("\n") ||
    "General theme park queues";

  const userMsg = [
    `PARK: ${dom.park.name} (${dom.id})`,
    `DATE: ${dateKey} (${dow})`,
    `DAY OF TRIP: Day ${dayIndex} of ${totalDays}`,
    "",
    "FAMILY:",
    `- ${prefs.adults} adult(s), ${prefs.children} child(ren); ${childBits}`,
    `- Mobility: ${prefs.mobility ?? "none"}`,
    "",
    "PASS STATUS:",
    passSection,
    "",
    "PRIORITIES:",
    `- Pace: ${prefs.pace}`,
    `- Family priorities: ${(prefs.priorities ?? []).join(", ") || "—"}`,
    `- Trip type: ${prefs.tripType ?? "—"}`,
    `- Must-do experiences: ${(prefs.mustDoExperiences ?? []).join(", ") || "—"}`,
    "",
    `ALL RIDES AT THIS PARK (with min heights and skip-line metadata):\n${ridesBlock}`,
    "",
    `ALREADY ASSIGNED ON OTHER DAYS (do not duplicate must-dos):\n${buildOtherDaysStrategySummary(trip, dateKey)}`,
    "",
    "Generate an optimal day strategy.",
  ].join("\n");

  const brief = collectUserBrief(trip, {});
  const userBlock = brief ? `${userMsg}\n\nUSER CONSTRAINTS:\n${brief}` : userMsg;

  const model = SMART_PLAN_MODEL;
  const promptKey = `day_strategy:${dateKey}:${dom.id}`;

  let inputTokens = 0;
  let outputTokens = 0;
  type AiSt = "pending" | "success" | "failed" | "cancelled";
  let aiGenStatus: AiSt = "pending";
  let aiGenError: string | null = null;
  let aiGenLogged = false;

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 3000,
      system: [
        {
          type: "text",
          text: DAY_STRATEGY_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: ridesBlock,
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
      aiGenStatus = "failed";
      aiGenError = "Invalid JSON (day_strategy)";
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: promptKey,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: "failed",
        error: aiGenError,
      });
      aiGenLogged = true;
      return { status: "error", error: "Could not read AI response." };
    }

    const { strategy: strategyNorm, logTags } = validateAndNormaliseDayStrategy(
      parsed,
      {
        dateKey,
        parkId: dom.id,
        model,
        parkLine: line,
      },
    );

    const unknownRides: string[] = [];
    for (const r of strategyNorm.ride_sequence) {
      const name = r.ride_or_event.trim().toLowerCase();
      const generic = /meal|break|parade|fireworks|rest|walk|lunch|dinner|snack|pool|breakfast/i.test(
        name,
      );
      if (generic) continue;
      if (!rideNamesLower.has(name)) {
        const fuzzy = [...rideNamesLower].some(
          (n) => n.includes(name) || name.includes(n),
        );
        if (!fuzzy) unknownRides.push(r.ride_or_event);
      }
    }
    const validationPipe =
      logTags.length > 0 ? logTags.join("|").slice(0, 700) : null;
    const warnExtra =
      unknownRides.length > 0
        ? `unknown_ride:${unknownRides.slice(0, 8).join(";")}`.slice(0, 200)
        : null;
    const recordDetail =
      [validationPipe, warnExtra].filter(Boolean).join("|").slice(0, 950) ||
      null;

    let strategy = strategyNorm;
    if (unknownRides.length > 0) {
      strategy = {
        ...strategyNorm,
        warnings: [
          ...strategyNorm.warnings,
          `unknown_ride: ${unknownRides.slice(0, 8).join("; ")}`,
        ],
      };
    }

    const prevPrefs =
      trip.preferences && typeof trip.preferences === "object"
        ? { ...trip.preferences }
        : ({} as Record<string, unknown>);
    const existingStrat = prevPrefs.ai_day_strategy;
    const stratMap: Record<string, AIDayStrategy> =
      existingStrat &&
      typeof existingStrat === "object" &&
      !Array.isArray(existingStrat)
        ? { ...(existingStrat as Record<string, AIDayStrategy>) }
        : {};

    const before: DaySnapshot["before"] = {
      assignments_for_day: trip.assignments[dateKey] ?? {},
      preferences_subset: readDayPreferencesSubset(
        trip.preferences ?? {},
        dateKey,
      ),
    };

    stratMap[dateKey] = strategy;
    const nextPrefs = { ...prevPrefs, ai_day_strategy: stratMap };
    const after: DaySnapshot["after"] = {
      assignments_for_day: trip.assignments[dateKey] ?? {},
      preferences_subset: readDayPreferencesSubset(nextPrefs, dateKey),
    };

    const daySnapshots = nextDaySnapshots(
      trip.day_snapshots,
      dateKey,
      before,
      after,
      "ai_day_strategy",
      model,
    );

    const admin = createServiceRoleClient();
    const { error: upErr } = await admin
      .from("trips")
      .update({
        preferences: nextPrefs,
        day_snapshots: daySnapshots,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (upErr) {
      aiGenStatus = "failed";
      aiGenError = upErr.message.slice(0, 900);
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: promptKey,
        model,
        inputTokens,
        outputTokens,
        success: false,
        status: "failed",
        error: aiGenError,
      });
      aiGenLogged = true;
      return { status: "error", error: upErr.message };
    }

    aiGenStatus = "success";
    try {
      await recordAiGeneration({
        userId: user.id,
        tripId: input.tripId,
        prompt: promptKey,
        model,
        inputTokens,
        outputTokens,
        success: true,
        status: "success",
        error: recordDetail,
      });
    } catch {
      /* non-fatal */
    }
    aiGenLogged = true;

    const approxGbp = (inputTokens + outputTokens * 4) * 0.000001 * 0.79;
    console.info("[ai] day_strategy cost_est_gbp_approx", {
      tripId: input.tripId,
      dateKey,
      inputTokens,
      outputTokens,
      approxGbp: approxGbp.toFixed(4),
    });

    revalidatePath("/planner");
    revalidatePath(`/trip/${input.tripId}`);
    return { status: "success", strategy };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    aiGenStatus = "failed";
    aiGenError = msg.slice(0, 1000);
    if (!aiGenLogged) {
      try {
        await recordAiGeneration({
          userId: user.id,
          tripId: input.tripId,
          prompt: promptKey,
          model,
          inputTokens,
          outputTokens,
          success: false,
          status: "failed",
          error: aiGenError,
        });
      } catch {
        /* ignore */
      }
      aiGenLogged = true;
    }
    return { status: "error", error: msg };
  } finally {
    if (!aiGenLogged && aiGenStatus !== "pending") {
      try {
        await recordAiGeneration({
          userId: user.id,
          tripId: input.tripId,
          prompt: promptKey,
          model,
          inputTokens,
          outputTokens,
          status: aiGenStatus,
          error: aiGenError,
        });
      } catch {
        /* ignore */
      }
    }
  }
}
