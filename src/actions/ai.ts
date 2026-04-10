"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getRegionById } from "@/lib/db/regions";
import { getParksForRegion } from "@/lib/db/parks";
import { getTripById } from "@/lib/db/trips";
import {
  enforceAiPlanGuardrails,
  requiresCruiseSegment,
  sortDateKeysFromSet,
} from "@/lib/ai-plan-guardrails";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Assignments, SlotType, Trip } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { awardAchievementAction } from "@/actions/achievements";
import { getSuccessfulAiGenerationCountForTrip } from "@/lib/db/ai-generations";
import { getCrowdPatternsForParkIds } from "@/lib/data/crowd-patterns";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const FREE_TIER_AI_PER_TRIP = 5;

const MODEL_BY_TIER: Record<string, string> = {
  free: "claude-haiku-4-5",
  pro: "claude-haiku-4-5",
  family: "claude-haiku-4-5",
  concierge: "claude-sonnet-4-6",
  agent_staff: "claude-haiku-4-5",
  agent_admin: "claude-haiku-4-5",
};

const SYSTEM_PROMPT = `You are a theme park trip planner. Your job is to
build a JSON itinerary for a family's holiday based on their trip details
and preferences.

You will receive:
- The trip's start and end dates
- The destination region (e.g. Orlando, Paris, Tokyo)
- A list of available park IDs and their names that the user can choose from
- The user's family details and free-text preferences

You must return ONLY valid JSON in this shape, with no preamble or explanation.
Include optional crowd fields whenever CROWD_PATTERNS are provided (see below).

{
  "assignments": {
    "2026-7-9": { "am": "mk", "pm": "mk", "lunch": "owl", "dinner": "tsr" },
    "2026-7-10": { "am": "ep", "pm": "ep", "dinner": "tsr" }
  },
  "crowd_reasoning": "One short paragraph on how you traded off busier vs quieter days (optional but recommended).",
  "day_crowd_notes": {
    "2026-7-14": "Why this park on this date vs alternatives — one line."
  }
}

## Crowd-awareness (when CROWD_PATTERNS appears in the user message)

You receive a CROWD_PATTERNS object: per-park day-of-week scores (0–10, higher =
busier), month scores (0–10), known_events with date ranges and impact flags.
These are historical-style heuristics — not live data.

When assigning parks to specific dates:
1. For each candidate date and park, compute an effective score = (day_of_week_score + month_score) / 2 for that calendar month and weekday. If a known_event covers that date: add +2 if impact is very_busy_fri_sat and the date is Friday or Saturday; add +3 if impact is closes_early (note compressed hours — avoid that park that night for families needing a full day, or mention it in day_crowd_notes); +0 for extended_hours unless you explain.
2. Place the busiest headline parks (often Magic Kingdom, Universal pair, new lands) on trip days with the LOWEST effective scores when you have a choice.
3. Place naturally calmer parks (e.g. Animal Kingdom, some water parks) on higher-traffic calendar days when you cannot avoid them.
4. NEVER claim exact wait times, live attendance, or precise percentages not implied by the scores. Use wording like "historically quieter", "typically busier", "usually better mid-week".
5. Put brief trade-off explanations in crowd_reasoning and/or day_crowd_notes (one line per day you want to highlight, date keys YYYY-M-D unpadded).

If CROWD_PATTERNS is empty or missing rows for some parks, still avoid obvious weekend peaks for major parks using general knowledge, and do not invent numeric wait times.

Rules:
- Date keys must be in the format YYYY-M-D with NO zero padding (e.g.
  "2026-7-9" not "2026-07-09")
- Only use park IDs from the list provided. Do NOT invent park IDs.
- Each day can have any combination of am, pm, lunch, dinner slots, or
  none at all (rest day)
- Schedule rest days every 3-4 park days, especially with young children
- Fly Out / Arrive (park id flyout) MUST only appear on day 1 (one slot only:
  AM or PM, not both slots with flyout).
- Fly Home / Depart (park id flyhome) MUST only appear on the final day (one
  slot only: AM or PM, not both slots with flyhome).
- Fly Out and Fly Home must NEVER appear on the same calendar day unless the
  trip is exactly one day long.
- Cruise tiles (e.g. Ship Pool/Bar, At Sea, Port Day, cruise excursions) may
  ONLY be placed on days from Cruise Embark through Cruise Disembark when the
  trip includes a cruise. If the trip has NO cruise segment, you MUST NOT place
  any ship-only or cruise-line tiles.
- Do not repeat the SAME main park on consecutive calendar days. A park may
  appear multiple times across the trip but not on back-to-back days.
- If a day is meant as downtime (rest / pool / light shopping), keep AM and PM
  consistent: use restful tiles (pool, spa, resort, shopping, outlets) in both
  AM and PM — do not pair a rest-style day with a full theme park in the other
  half-day.
- For dining, use 'owl' (Quick Service), 'tsr' (Table Service), 'char'
  (Character Dining), 'specd' (Specialty Dining), 'villa' (Home Cook)
- Match park choices to the family's stated preferences
- For young children (under 7), avoid intense thrill parks
- For teens, lean into thrill parks
- For families that say "love queueing" or "patient" - schedule full park days
- For families that say "hate queueing" or "impatient" - shorter park days,
  more variety

Return ONLY the JSON. No markdown code fences. No explanation. No preamble.`;

const SLOT_SET = new Set<SlotType>(["am", "pm", "lunch", "dinner"]);

function modelForTier(tier: string | null): string {
  const t = tier ?? "free";
  return MODEL_BY_TIER[t] ?? MODEL_BY_TIER.free;
}

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
    const dayOut: Partial<Record<SlotType, string>> = { ...(out[day] ?? {}) };
    for (const [slot, pid] of Object.entries(slots)) {
      if (!SLOT_SET.has(slot as SlotType)) continue;
      if (typeof pid !== "string") continue;
      const cur = dayOut[slot as SlotType];
      if (cur !== undefined && cur !== "") continue;
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
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  let crowd_reasoning: string | undefined;
  if (typeof obj.crowd_reasoning === "string") {
    const t = obj.crowd_reasoning.trim();
    if (t) crowd_reasoning = t.slice(0, 1200);
  }
  const day_crowd_notes: Record<string, string> = {};
  const notes = obj.day_crowd_notes;
  if (notes && typeof notes === "object" && !Array.isArray(notes)) {
    for (const [k, v] of Object.entries(notes as Record<string, unknown>)) {
      if (!allowedDates.has(k)) continue;
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (s) day_crowd_notes[k] = s.slice(0, 400);
    }
  }
  return {
    crowd_reasoning,
    day_crowd_notes:
      Object.keys(day_crowd_notes).length > 0 ? day_crowd_notes : undefined,
  };
}

function buildPlannerUserMessage(params: {
  mode: "smart" | "custom";
  userPrompt: string;
  regionName: string;
  trip: Trip;
  parksForPrompt: { id: string; name: string }[];
  cruiseInstruction: string;
  childAges: string;
  crowdJson: string;
}): string {
  const {
    mode,
    userPrompt,
    regionName,
    trip,
    parksForPrompt,
    cruiseInstruction,
    childAges,
    crowdJson,
  } = params;

  const parkLines = parksForPrompt.map((p) => `${p.id}: ${p.name}`).join("\n");

  const crowdSection =
    crowdJson === "{}"
      ? "CROWD_PATTERNS: {} (no hand-tuned rows for these park IDs — still favour mid-week for headline parks when possible.)"
      : `CROWD_PATTERNS (relative scores — not real-time crowds):\n${crowdJson}`;

  const coreTrip = `Trip details:
- Region: ${regionName}
- Dates: ${trip.start_date} to ${trip.end_date}
- Family: ${trip.adults} adults, ${trip.children} children${childAges}
- Cruise: ${trip.has_cruise ? `yes, embark ${trip.cruise_embark} disembark ${trip.cruise_disembark}` : "no"}
- ${cruiseInstruction}

Available park IDs and names:
${parkLines}`;

  if (mode === "smart") {
    const extra = userPrompt.trim();
    return `${coreTrip}

${crowdSection}

SMART PLAN (recommended) MODE — build a full itinerary using crowd patterns to place busier parks on historically lighter days within this window. The user did not write a long custom brief.
${extra ? `Optional family notes from the user:\n${extra}\n` : ""}
Generate the itinerary JSON now (include crowd_reasoning and day_crowd_notes when possible).`;
  }

  return `${coreTrip}

${crowdSection}

CUSTOM PROMPT MODE — apply the traveller's preferences first, then use crowd patterns to improve date choices.

Traveller's own words:
${userPrompt.trim() || "(empty — rely on trip defaults only.)"}

Generate the itinerary JSON now (include crowd_reasoning and day_crowd_notes when possible).`;
}

export async function generateAIPlanAction(input: {
  tripId: string;
  mode: "smart" | "custom";
  userPrompt: string;
  /**
   * When false, AI output overwrites existing tiles where both specify a slot.
   * Default true: only empty slots are filled (manual picks kept).
   */
  preserveExistingSlots?: boolean;
}): Promise<
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
    }
  | {
      ok: false;
      error: "NOT_AUTHED" | "TRIP_NOT_FOUND" | "TIER_LIMIT" | "AI_ERROR";
      message: string;
    }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "NOT_AUTHED", message: "Not signed in." };
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
    .select("tier, ai_generations_lifetime")
    .eq("id", user.id)
    .maybeSingle();

  const tier = (profile as { tier?: string } | null)?.tier ?? null;

  if (tier === "free" || tier === null) {
    const { count, error: cErr } = await supabase
      .from("ai_generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("trip_id", input.tripId)
      .eq("success", true);

    if (!cErr && (count ?? 0) >= FREE_TIER_AI_PER_TRIP) {
      return {
        ok: false,
        error: "TIER_LIMIT",
        message: "Free plan AI generation limit reached for this trip.",
      };
    }
  }

  const parks = await getParksForRegion(rid);
  if (parks.length === 0) {
    return {
      ok: false,
      error: "AI_ERROR",
      message: "No parks configured for this region.",
    };
  }

  const parksForPrompt = trip.has_cruise
    ? parks
    : parks.filter((p) => !requiresCruiseSegment(p));

  const allowedParkIds = new Set(parksForPrompt.map((p) => p.id));
  const dateAllow = allowedDateKeys(trip.start_date, trip.end_date);
  const sortedDateKeys = sortDateKeysFromSet(dateAllow);
  const parksById = new Map(parks.map((p) => [p.id, p]));

  const childAges = trip.child_ages?.length
    ? ` (ages ${trip.child_ages.join(", ")})`
    : "";

  const cruiseInstruction = trip.has_cruise
    ? `Cruise segment: YES — only schedule ship/cruise-line tiles on days from embark (${trip.cruise_embark}) through disembark (${trip.cruise_disembark}), inclusive.`
    : `Cruise segment: NO — do not use any cruise ship, at-sea, port-day, or cruise-excursion tiles.`;

  const crowdPatterns = getCrowdPatternsForParkIds(
    parksForPrompt.map((p) => p.id),
  );
  const crowdJson = JSON.stringify(crowdPatterns, null, 2);

  let composedUserMessage = "";
  composedUserMessage = buildPlannerUserMessage({
    mode: input.mode,
    userPrompt: input.userPrompt,
    regionName: `${region.name} (${region.country})`,
    trip,
    parksForPrompt,
    cruiseInstruction,
    childAges,
    crowdJson,
  });

  const model = modelForTier(tier);

  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: composedUserMessage }],
    });

    const usage = response.usage;
    const cacheCreate = (
      usage as {
        cache_creation_input_tokens?: number;
      }
    )?.cache_creation_input_tokens;
    inputTokens = (usage?.input_tokens ?? 0) + (cacheCreate ?? 0);
    outputTokens = usage?.output_tokens ?? 0;

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText =
      textBlock && textBlock.type === "text" ? textBlock.text : "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(rawText));
    } catch {
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        trip_id: input.tripId,
        prompt: composedUserMessage,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_gbp_pence: null,
        success: false,
        error_message: "Invalid JSON from model",
      });

      return {
        ok: false,
        error: "AI_ERROR",
        message: "The AI returned invalid JSON. Try again.",
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
        error_message: "No valid assignments after validation",
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
        error_message: "Plan failed guardrail validation (empty after cleanup)",
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
    const merged = mergeAiIntoTrip(trip.assignments, guarded, preserve);
    const now = new Date().toISOString();

    const nextPrefs: Record<string, unknown> = {
      ...(trip.preferences ?? {}),
    };
    if (meta.crowd_reasoning) nextPrefs.ai_crowd_summary = meta.crowd_reasoning;
    if (meta.day_crowd_notes) nextPrefs.ai_day_crowd_notes = meta.day_crowd_notes;
    nextPrefs.ai_crowd_updated_at = now;

    const { error: upErr } = await supabase
      .from("trips")
      .update({
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
        error_message: upErr.message,
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
      error_message: null,
    });

    if (genInsertErr) {
      return {
        ok: false,
        error: "AI_ERROR",
        message: `Could not log AI usage: ${genInsertErr.message}. Your plan may have saved — refresh the page.`,
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
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown AI error";
    const supabase2 = await createClient();
    await supabase2.from("ai_generations").insert({
      user_id: user.id,
      trip_id: input.tripId,
      prompt: composedUserMessage,
      model: modelForTier(tier),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_gbp_pence: null,
      success: false,
      error_message: msg,
    });

    return { ok: false, error: "AI_ERROR", message: msg };
  }
}
