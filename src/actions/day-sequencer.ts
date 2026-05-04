"use server";

import { getRidePrioritiesForDay } from "@/actions/ride-priorities";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import {
  eachDateKeyInRange,
  formatDateISO,
  parseDate,
} from "@/lib/date-helpers";
import { getTripById } from "@/lib/db/trips";
import {
  generateParkDaySequence,
  planningPaceToSequencerPace,
  type GenerateParkDaySequenceInput,
  type ParkDaySequenceOutput,
  type SequencerPace,
} from "@/lib/day-sequencer";
import { mapAttractionRow } from "@/lib/ride-priority-rows";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { PlanningPace, TripPlanningPreferences } from "@/lib/types";

export type GenerateDaySequenceResult =
  | { ok: true; sequence: ParkDaySequenceOutput }
  | { ok: false; code: string; message: string; details?: unknown };

function logBaseUrl(): string {
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  return "http://localhost:3000";
}

async function reportSequencerCrash(
  err: unknown,
  context: Record<string, unknown>,
): Promise<void> {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  const stack = err instanceof Error ? err.stack : undefined;
  try {
    await fetch(`${logBaseUrl()}/api/log-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `[AUTO-ERROR][day-sequencer] ${message}`.slice(0, 2000),
        stack: stack?.slice(0, 8000),
        context: { tag: "day-sequencer", ...context },
        url: null,
        userAgent: "server-action",
      }),
      cache: "no-store",
    });
  } catch {
    /* never throw */
  }
}

function dateKeyInTripRange(
  trip: { start_date: string; end_date: string },
  dateKey: string,
): boolean {
  const keys = eachDateKeyInRange(trip.start_date, trip.end_date);
  const dk = formatDateISO(parseDate(`${dateKey.slice(0, 10)}T12:00:00`));
  return keys.includes(dk);
}

function collectDayParkIds(
  trip: { assignments: Record<string, Record<string, unknown>> },
  dateKey: string,
): string[] {
  const ass = trip.assignments[dateKey] ?? {};
  const slots = ["am", "pm", "lunch", "dinner"] as const;
  const ids: string[] = [];
  for (const s of slots) {
    const raw = ass[s] as Parameters<typeof getParkIdFromSlotValue>[0];
    const id = getParkIdFromSlotValue(raw);
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

function dateIsPeakSeason(dateKey: string): boolean {
  const d = parseDate(`${dateKey.slice(0, 10)}T12:00:00`);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (month === 7 || month === 8) return true;
  if (month === 12 && day > 14) return true;
  if (month === 1 && day <= 7) return true;
  return false;
}

function planningPrefsPaceToSequencer(
  pace: SequencerPace | undefined,
  prefs: TripPlanningPreferences | null | undefined,
): SequencerPace {
  if (pace === "relaxed" || pace === "balanced" || pace === "go-go-go") {
    return pace;
  }
  const p = prefs?.pace;
  if (p === "relaxed" || p === "balanced" || p === "intense" || p === "go_go_go") {
    return planningPaceToSequencerPace(p as PlanningPace);
  }
  return "balanced";
}

export async function generateDaySequenceAction(input: {
  tripId: string;
  dateKey: string;
  entitlements: {
    has_lightning_lane_multi_pass: boolean;
    has_lightning_lane_single_pass: boolean;
    has_universal_express: boolean;
    has_early_entry: boolean;
  };
  pace?: SequencerPace;
}): Promise<GenerateDaySequenceResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sign in to generate a touring plan.",
    };
  }

  const trip = await getTripById(input.tripId);
  if (!trip) {
    return {
      ok: false,
      code: "TRIP_NOT_FOUND",
      message: "Trip not found or you do not have access.",
    };
  }

  const dk = formatDateISO(parseDate(`${input.dateKey.slice(0, 10)}T12:00:00`));
  if (!dateKeyInTripRange(trip, dk)) {
    return {
      ok: false,
      code: "DATE_OUT_OF_RANGE",
      message: "That date is not part of this trip.",
    };
  }

  const park_ids = collectDayParkIds(trip, dk);
  if (park_ids.length === 0) {
    return {
      ok: false,
      code: "NO_PARKS_FOR_DAY",
      message:
        "Assign at least one park to this day before generating a touring plan.",
    };
  }

  // TODO(V1.1): Load dining reservations and Lightning Lane / Express windows from a dedicated anchor store when it exists.
  const anchors: GenerateParkDaySequenceInput["anchors"] = [];

  const prioritiesRaw = await getRidePrioritiesForDay(input.tripId, dk);
  const parkSet = new Set(park_ids);
  const prioritiesForParks = prioritiesRaw.filter((pr) => {
    const pid = pr.attraction?.park_id;
    return pid != null && parkSet.has(pid);
  });
  const priorities = sortPrioritiesForDay(prioritiesForParks);

  if (priorities.length === 0) {
    return {
      ok: false,
      code: "EMPTY_PRIORITIES",
      message:
        "Pick at least one must-ride from your priorities list before generating a touring plan.",
    };
  }

  const supabase = await createClient();
  const { data: attrRows, error: attrErr } = await supabase
    .from("attractions")
    .select("*")
    .in("park_id", park_ids);
  if (attrErr) {
    await reportSequencerCrash(attrErr, { tripId: input.tripId, dateKey: dk });
    return {
      ok: false,
      code: "ENGINE_CRASH",
      message:
        "Something went wrong generating the plan. We've logged it — please try again in a moment.",
    };
  }

  const attractions_by_id: GenerateParkDaySequenceInput["attractions_by_id"] =
    {};
  for (const row of attrRows ?? []) {
    const a = mapAttractionRow(row as Record<string, unknown>);
    attractions_by_id[a.id] = a;
  }

  // TODO(V1.1): Populate from catalogue when `land`, `land_portal`, and land entry priority exist on `attractions` (Epic Universe rope-drop copy).
  const attraction_meta_by_id: GenerateParkDaySequenceInput["attraction_meta_by_id"] =
    {};

  const pace = planningPrefsPaceToSequencer(input.pace, trip.planning_preferences);

  const engineInput: GenerateParkDaySequenceInput = {
    date: dk,
    park_ids,
    entitlements: input.entitlements,
    pace,
    young_child_party_v1: trip.children > 0,
    smallest_rider_height_cm: null,
    date_is_peak_season: dateIsPeakSeason(dk),
    // TODO(V1.1): Per-park official open/close for this calendar date.
    park_open_minutes: 540,
    park_close_minutes: 1320,
    anchors,
    priorities,
    attractions_by_id,
    attraction_meta_by_id,
  };

  try {
    const result = generateParkDaySequence(engineInput);
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
      };
    }
    return { ok: true, sequence: result.output };
  } catch (e) {
    await reportSequencerCrash(e, { tripId: input.tripId, dateKey: dk });
    return {
      ok: false,
      code: "ENGINE_CRASH",
      message:
        "Something went wrong generating the plan. We've logged it — please try again in a moment.",
    };
  }
}
