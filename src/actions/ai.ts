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
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type {
  Assignment,
  Assignments,
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
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { formatRegionalDiningForPrompt } from "@/data/regional-dining";
import { formatPlanningPreferencesForPrompt } from "@/lib/planning-preferences-prompt";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import {
  assertTierAllows,
  getUserTier,
  tierErrorToClientPayload,
} from "@/lib/tier";
import { logTrippUsage } from "@/lib/tripp-usage-log";
import { resolveTrippModel } from "@/lib/tripp-model";
import { TierError } from "@/lib/tier-errors";
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const SYSTEM_PROMPT = `You are Tripp, TripTiles' warm and practical theme park planner. Output ONLY valid JSON — no markdown, no preamble, no text outside the JSON object.

Shape:
{ "assignments": { "2026-7-9": { "am": "mk", "pm": "mk", "lunch": "owl", "dinner": "tsr" } }, "crowd_reasoning": "…", "day_crowd_notes": { "2026-7-14": "…" }, "planner_day_notes": { "2026-7-9": "…" } }

Limits: crowd_reasoning ≤400 chars, one paragraph. Each day_crowd_notes value ≤150 chars, one sentence.
Each planner_day_notes value ≤350 chars: practical tips for THAT day only (hours, virtual queues, rest-day ideas). Omit keys with no specific tip.

DAY NOTES RULES (CRITICAL):
- Sound like a knowledgeable friend. NEVER raw crowd scores, arithmetic, formulas, bracketed maths, "score N", "crowd index N", or how you calculated anything.
- Good: "Arrive early — Magic Kingdom is quietest before 10am on weekdays." Bad: "Tuesday (score 6+7=13/2=6.5)."

CROWD_PATTERNS (when in user message): 0–10 heuristics per park/weekday/month — use internally only. Never put numeric score workings in user-facing strings. Never claim live waits or exact attendance.

Rules:
- Date keys YYYY-M-D (no zero-padding). Park IDs only from the cached list in the system message.
- Slots: am, pm, lunch, dinner optional; rest days OK. Rest every 3–4 park days with young children.
- Day 1 arrival: no theme/water parks in AM/PM (resort/flyout/dining only; slots may be empty). day_crowd_notes must not contradict day-1 assignments.
- flyout: day 1 only, one AM or PM. flyhome: last day only, one slot — not both same calendar day unless trip is one day.
- Cruise tiles only between embark/disembark when cruise=yes.
- No same headline park on consecutive calendar days.
- True rest = restful tiles in AM and PM both; no half-rest + full park split.
- Dining: owl, tsr, char, specd, villa as documented.
- Honour family notes (young children / teens / queue patience).

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

function sanitizeAssignments(
  raw: unknown,
  allowedDates: Set<string>,
  allowedParks: Set<string>,
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
      if (!allowedParks.has(pid)) continue;
      dayOut[slot as SlotType] = pid;
    }
    if (Object.keys(dayOut).length > 0) out[day] = dayOut;
  }
  return out;
}

function parseCrowdMetadata(
  raw: unknown,
  allowedDates: Set<string>,
): {
  crowd_reasoning?: string;
  day_crowd_notes?: Record<string, string>;
  planner_day_notes?: Record<string, string>;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  let crowd_reasoning: string | undefined;
  if (typeof obj.crowd_reasoning === "string") {
    const t = obj.crowd_reasoning.trim();
    if (t) crowd_reasoning = sanitizeDayNote(t.slice(0, 400));
  }
  const day_crowd_notes: Record<string, string> = {};
  const notes = obj.day_crowd_notes;
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    for (const [k, v] of Object.entries(notes as Record<string, unknown>)) {
      if (!allowedDates.has(k)) continue;
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (s) day_crowd_notes[k] = sanitizeDayNote(s.slice(0, 150));
    }
  }
  const planner_day_notes: Record<string, string> = {};
  const pNotes = obj.planner_day_notes;
  if (pNotes && typeof pNotes === "object" && !Array.isArray(pNotes)) {
    for (const [k, v] of Object.entries(pNotes as Record<string, unknown>)) {
      if (!allowedDates.has(k)) continue;
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (s) planner_day_notes[k] = sanitizeDayNote(s.slice(0, 350));
    }
  }
  return {
    crowd_reasoning,
    day_crowd_notes:
      Object.keys(day_crowd_notes).length > 0 ? day_crowd_notes : undefined,
    planner_day_notes:
      Object.keys(planner_day_notes).length > 0 ? planner_day_notes : undefined,
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

/** Cached with the system prompt — park IDs the model may use (built-in + custom). */
function buildParksListSystemText(
  regionName: string,
  parksForPrompt: Park[],
  customTiles: CustomTile[],
): string {
  const parkLines = parksForPrompt.map((p) => `${p.id}: ${p.name}`).join("\n");
  const customLines =
    customTiles.length > 0
      ? `\n\nThe user has also added these custom tiles you can use:\n${customTiles
          .map(
            (t) =>
              `${t.id}: ${t.name}${t.notes ? ` (${t.notes})` : ""}`,
          )
          .join("\n")}`
      : "";
  return `Available parks for ${regionName}:\n${parkLines}${customLines}`;
}

function buildPlannerUserMessage(params: {
  mode: "smart" | "custom";
  userPrompt: string;
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
}): string {
  const {
    mode,
    userPrompt,
    regionName,
    trip,
    cruiseInstruction,
    childAges,
    crowdJson,
    wizardContext,
    diningHint,
    namedRestaurantHint,
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
  const cruiseTilePolicy = trip.has_cruise
    ? "CRUISE TILES: This trip includes a cruise segment. Include cruise embark/disembark and ship activities where appropriate when they fit the dates."
    : "CRUISE TILES: This trip does not include a cruise. Do not suggest or assign cruise-only, ship-only, or port-excursion tiles (for example at sea, ship pool, shore excursion) unless the traveller has explicitly asked for them in their notes.";

  if (mode === "smart") {
    const extra = userPrompt.trim();
    return `${coreTrip}

${crowdSection}
${wizBlock}${dineBlock}${namedRestBlock}${cruiseTilePolicy}

SMART PLAN MODE — build a full itinerary using crowd patterns to place busier parks on historically lighter days within this window. The user did not write a long custom brief.
${extra ? `Optional family notes from the user:\n${extra}\n` : ""}
For each trip day, add planner_day_notes with 1–2 practical tips tied to that date and the parks you assign (rope drop times, virtual queues, rest-day ideas, dining). Keep each value concise. Skip generic advice that applies to every day.

Generate the itinerary JSON now (include crowd_reasoning, day_crowd_notes, and planner_day_notes when possible).`;
  }

  return `${coreTrip}

${crowdSection}
${wizBlock}${dineBlock}${namedRestBlock}${cruiseTilePolicy}

CUSTOM PROMPT MODE — apply the traveller's preferences first, then use crowd patterns to improve date choices.

Traveller's own words:
${userPrompt.trim() || "(empty — rely on trip defaults only.)"}

For each trip day, add planner_day_notes with 1–2 practical tips tied to that date and the parks you assign. Keep each value concise.

Generate the itinerary JSON now (include crowd_reasoning, day_crowd_notes, and planner_day_notes when possible).`;
}

export async function runGenerateAIPlan(
  input: GenerateAIPlanInput,
  options: GenerateAIPlanOptions = {},
): Promise<GenerateAIPlanResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "NOT_AUTHED", message: "Not signed in." };
  }

  try {
    await assertTierAllows(user.id, "ai");
  } catch (e) {
    const mapped = tierErrorToClientPayload(e);
    if (mapped?.code === "TIER_AI_DISABLED") {
      return {
        ok: false,
        error: "TIER_AI_DISABLED",
        message:
          "Tripp is not included on the Day Tripper plan. Upgrade to Navigator or Captain on Pricing.",
      };
    }
    throw e;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "AI_ERROR",
      message: "ANTHROPIC_API_KEY is not configured.",
    };
  }

  const trip = await getTripById(input.tripId);
  if (!trip || trip.owner_id !== user.id) {
    return { ok: false, error: "TRIP_NOT_FOUND", message: "Trip not found." };
  }

  const rid =
    trip.region_id ??
    (trip.destination !== "custom" ? trip.destination : null);
  if (!rid) {
    return {
      ok: false,
      error: "AI_ERROR",
      message:
        "This trip needs a destination region. Use Edit Trip to choose one.",
    };
  }

  const region = await getRegionById(rid);
  if (!region) {
    return {
      ok: false,
      error: "AI_ERROR",
      message: "Could not load destination region for this trip.",
    };
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_generations_lifetime")
    .eq("id", user.id)
    .maybeSingle();

  let canGenerateAi: boolean;
  try {
    canGenerateAi = await currentUserCanGenerateAI();
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

  if (parksForPrompt.length === 0) {
    return {
      ok: false,
      error: "AI_ERROR",
      message:
        "No parks or custom tiles available for this region. Add built-in parks in the catalog or create custom tiles.",
    };
  }

  const allowedParkIds = new Set(parksForPrompt.map((p) => p.id));
  const dateAllow = allowedDateKeys(trip.start_date, trip.end_date);
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

  const composedUserMessage = buildPlannerUserMessage({
    mode: input.mode,
    userPrompt: input.userPrompt,
    regionName: `${region.name} (${region.country})`,
    trip,
    cruiseInstruction,
    childAges,
    crowdJson,
    wizardContext,
    diningHint,
    namedRestaurantHint,
  });

  let model = "claude-haiku-4-5";
  try {
    model = await resolveTrippModel(user.id);
  } catch (e) {
    if (e instanceof TierError && e.code === "TIER_AI_DISABLED") {
      return {
        ok: false,
        error: "TIER_AI_DISABLED",
        message: e.message,
      };
    }
    throw e;
  }

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const t0 = Date.now();
    let rawText = "";
    let streamStoppedEarly = false;

    try {
      const stream = await anthropic.messages.create({
        model,
        max_tokens: 3000,
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
        messages: [{ role: "user", content: composedUserMessage }],
      });

      for await (const event of stream) {
        if (event.type === "message_start") {
          const usage = event.message.usage as AnthropicMessageUsage | undefined;
          inputTokens = inputTokensFromUsage(usage);
          outputTokens = usage?.output_tokens ?? outputTokens;
          continue;
        }
        if (event.type === "message_delta") {
          const usage = event.usage as AnthropicMessageUsage | undefined;
          outputTokens = usage?.output_tokens ?? outputTokens;
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
    } catch {
      streamStoppedEarly = rawText.trim().length > 0;
      if (!streamStoppedEarly) throw new Error("AI stream failed before output");
    }

    if (streamStoppedEarly) {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: composedUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
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

    const latencyMs = Date.now() - t0;
    void logTrippUsage({
      userId: user.id,
      tier: await getUserTier(user.id),
      model,
      inputTokens,
      outputTokens,
      latencyMs,
    });

    if (process.env.NODE_ENV === "development") {
      console.info("[ai] anthropic usage", {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawText));
    } catch {
      if (rawText.trim().length > 0) {
        await supabase.from("ai_generations").insert({
          user_id: user.id,
          trip_id: input.tripId,
          prompt: composedUserMessage,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_gbp_pence: null,
          success: false,
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
        prompt: composedUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        error: "Invalid JSON from model",
      });

      return {
        ok: false,
        error: "AI_ERROR",
        message: "Smart Plan returned something we couldn't read. Try again.",
      };
    }

    const meta = parseCrowdMetadata(parsed, dateAllow);

    const sanitized = sanitizeAssignments(parsed, dateAllow, allowedParkIds);
    if (!sanitized || Object.keys(sanitized).length === 0) {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: composedUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        error: "No valid assignments after validation",
      });

      return {
        ok: false,
        error: "AI_ERROR",
        message: "Could not build a valid plan from the response.",
      };
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
        prompt: composedUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
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

    if (upErr) {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: composedUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        error: upErr.message,
      });

      return { ok: false, error: "AI_ERROR", message: upErr.message };
    }

    const { error: genInsertErr } = await supabase.from("ai_generations").insert({
      user_id: user.id,
      trip_id: input.tripId,
      prompt: composedUserMessage,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_gbp_pence: null,
      success: true,
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
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
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
