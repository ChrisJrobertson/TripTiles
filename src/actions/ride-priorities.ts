"use server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getParksForRegion } from "@/lib/db/parks";
import { mapTripRow } from "@/lib/db/trips";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Attraction, RidePriority, TripRidePriority } from "@/types/attractions";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import {
  eachDateKeyInRange,
  formatDateISO,
  parseDate,
} from "@/lib/date-helpers";
import {
  computeDayConflicts,
  type DayConflict,
} from "@/lib/planner-day-conflicts";
import { mapAttractionRow, mapPriorityRow } from "@/lib/ride-priority-rows";
import { normalizePastedQueueMinutes } from "@/lib/pasted-queue-minutes";
import { normalizeSkipLineReturnHhmm } from "@/lib/skip-line-return-hhmm";
import { currentUserCanCreateRidePriority } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { unstable_cache } from "next/cache";

function revalidatePlanner() {
  revalidatePath("/planner");
}

function createPublicCatalogClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Missing Supabase URL or anon key for catalogue fetch.");
  }
  return createSupabaseJs(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * All `parks.id` values that have at least one `attractions` row (any row).
 * Cached 24h with the per-park attraction lists — used to gate catalogue vs AI
 * must-do UI without an extra server round-trip per park on the client.
 */
export async function getCataloguedParkIds(): Promise<string[]> {
  return unstable_cache(
    async () => {
      const supabase = createPublicCatalogClient();
      const { data, error } = await supabase
        .from("attractions")
        .select("park_id")
        .not("park_id", "is", null)
        .limit(100000);
      if (error) throw new Error(error.message);
      const set = new Set<string>();
      for (const row of data ?? []) {
        const id = (row as { park_id?: string | null }).park_id;
        if (typeof id === "string" && id.length > 0) set.add(id);
      }
      return [...set].sort();
    },
    ["catalogued-park-ids-v1"],
    { revalidate: 86400 },
  )();
}

export async function getAttractionsForPark(
  parkId: string,
): Promise<Attraction[]> {
  return unstable_cache(
    async () => {
      const supabase = createPublicCatalogClient();
      const { data, error } = await supabase
        .from("attractions")
        .select("*")
        .eq("park_id", parkId)
        .eq("is_temporarily_closed", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) =>
        mapAttractionRow(row as Record<string, unknown>),
      );
    },
    ["attractions-for-park", parkId],
    { revalidate: 86400 },
  )();
}

export async function getRidePrioritiesForTrip(
  tripId: string,
): Promise<TripRidePriority[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_ride_priorities")
    .select("*, attractions (*)")
    .eq("trip_id", tripId)
    .order("day_date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const rawAttr = rec.attractions as Record<string, unknown> | null;
    const attraction = rawAttr ? mapAttractionRow(rawAttr) : undefined;
    return mapPriorityRow(rec, attraction);
  });
}

/**
 * Lightweight counts per trip/day for planner overview (no attraction join).
 */
export async function getRidePriorityCountsForTripIds(
  tripIds: string[],
): Promise<
  Record<string, Record<string, { total: number; mustDo: number }>>
> {
  const out: Record<
    string,
    Record<string, { total: number; mustDo: number }>
  > = {};
  if (tripIds.length === 0) return out;
  for (const id of tripIds) out[id] = {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_ride_priorities")
    .select("trip_id, day_date, priority")
    .in("trip_id", tripIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const tid = String((row as { trip_id: string }).trip_id);
    const rawDay = String((row as { day_date: string }).day_date);
    const dk = formatDateISO(parseDate(rawDay.slice(0, 10)));
    const pr = (row as { priority: string }).priority;
    if (!out[tid]) out[tid] = {};
    const cur = out[tid][dk] ?? { total: 0, mustDo: 0 };
    cur.total += 1;
    if (pr === "must_do") cur.mustDo += 1;
    out[tid][dk] = cur;
  }
  return out;
}

export async function getRidePrioritiesForTripIds(
  tripIds: string[],
): Promise<TripRidePriority[]> {
  if (tripIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_ride_priorities")
    .select("*, attractions (*)")
    .in("trip_id", tripIds)
    .order("trip_id", { ascending: true })
    .order("day_date", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const rec = row as Record<string, unknown>;
    const rawAttr = rec.attractions as Record<string, unknown> | null;
    const attraction = rawAttr ? mapAttractionRow(rawAttr) : undefined;
    return mapPriorityRow(rec, attraction);
  });
}

export async function getRidePrioritiesForDay(
  tripId: string,
  dayDate: string,
): Promise<TripRidePriority[]> {
  const all = await getRidePrioritiesForTrip(tripId);
  return all.filter((p) => p.day_date === dayDate);
}

export type DayConflictDotSummary = Record<
  string,
  { hasAmber: boolean; hasGrey: boolean }
>;

/** Per-day ride rows + server-computed conflicts (lazy Day Detail fetch). */
export async function getRidePrioritiesAndConflictsForDay(
  tripId: string,
  dayDate: string,
  rideCountsOverride?: { total: number; mustDo: number } | null,
): Promise<{ priorities: TripRidePriority[]; conflicts: DayConflict[] }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const supabase = await createClient();
  const { data: tripRow, error: tErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (tErr || !tripRow) throw new Error("Trip not found.");
  const trip = mapTripRow(tripRow as Record<string, unknown>);
  const parks = trip.region_id
    ? await getParksForRegion(trip.region_id)
    : [];
  const parkById = new Map(parks.map((p) => [p.id, p]));
  const dk = formatDateISO(parseDate(dayDate.slice(0, 10)));
  const priorities = await getRidePrioritiesForDay(tripId, dk);
  const conflicts = computeDayConflicts(
    trip,
    dk,
    priorities,
    rideCountsOverride ?? undefined,
    parkById,
  );
  return { priorities, conflicts };
}

/** One round-trip for planner overview conflict dots (same rules as Day Detail). */
export async function getConflictDotSummaryForTrip(
  tripId: string,
): Promise<DayConflictDotSummary> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const supabase = await createClient();
  const { data: tripRow, error: tErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (tErr || !tripRow) throw new Error("Trip not found.");
  const trip = mapTripRow(tripRow as Record<string, unknown>);
  const parks = trip.region_id
    ? await getParksForRegion(trip.region_id)
    : [];
  const parkById = new Map(parks.map((p) => [p.id, p]));
  const allPri = await getRidePrioritiesForTrip(tripId);
  const countMap = await getRidePriorityCountsForTripIds([tripId]);
  const dayCounts = countMap[tripId] ?? {};
  const out: DayConflictDotSummary = {};
  for (const dateKey of eachDateKeyInRange(trip.start_date, trip.end_date)) {
    const dayPri = allPri.filter((p) => p.day_date === dateKey);
    const counts = dayCounts[dateKey];
    const conflicts = computeDayConflicts(
      trip,
      dateKey,
      dayPri,
      counts,
      parkById,
    );
    const hasAmber = conflicts.some((c) => c.level === "amber");
    const hasGrey = conflicts.some((c) => c.level === "grey");
    if (hasAmber || hasGrey) {
      out[dateKey] = { hasAmber, hasGrey };
    }
  }
  return out;
}

export async function toggleRidePriority(
  tripId: string,
  attractionId: string,
  dayDate: string,
  priority: RidePriority,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("trip_ride_priorities")
    .select("id, sort_order")
    .eq("trip_id", tripId)
    .eq("attraction_id", attractionId)
    .eq("day_date", dayDate)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("trip_ride_priorities")
      .update({ priority })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const canAdd = await currentUserCanCreateRidePriority(tripId);
    if (!canAdd) {
      throw new Error(
        "You've reached the ride priority limit on the Free plan. Upgrade to Pro for unlimited priorities.",
      );
    }
    const { data: maxRow } = await supabase
      .from("trip_ride_priorities")
      .select("sort_order")
      .eq("trip_id", tripId)
      .eq("day_date", dayDate)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = Number(maxRow?.sort_order ?? -1) + 1;
    const { error } = await supabase.from("trip_ride_priorities").insert({
      trip_id: tripId,
      attraction_id: attractionId,
      day_date: dayDate,
      priority,
      sort_order: nextOrder,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePlanner();
}

export async function removeRidePriority(
  tripId: string,
  attractionId: string,
  dayDate: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_ride_priorities")
    .delete()
    .eq("trip_id", tripId)
    .eq("attraction_id", attractionId)
    .eq("day_date", dayDate);
  if (error) throw new Error(error.message);
  revalidatePlanner();
}

export type RidePriorityMetaPatch = {
  notes?: string | null;
  /** Set to a 24h `HH:mm` string, or `null` to clear the return window. */
  skipLineReturnHhmm?: string | null;
  /** 1–600 or null to clear; from boards/apps, not live waits. */
  pastedQueueMinutes?: number | null;
};

/**
 * Update optional notes and/or skip-line (LL/Express) return time for a ride row.
 */
export async function updateRidePriorityMeta(
  tripId: string,
  attractionId: string,
  dayDate: string,
  patch: RidePriorityMetaPatch,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const update: Record<string, string | number | null> = {};
  if ("notes" in patch) {
    const n = patch.notes;
    if (n == null || n === "") {
      update.notes = null;
    } else {
      update.notes = String(n).slice(0, 500);
    }
  }
  if ("skipLineReturnHhmm" in patch) {
    update.skip_line_return_hhmm = normalizeSkipLineReturnHhmm(
      patch.skipLineReturnHhmm,
    );
  }
  if ("pastedQueueMinutes" in patch) {
    update.pasted_queue_minutes = normalizePastedQueueMinutes(
      patch.pastedQueueMinutes,
    );
  }
  if (Object.keys(update).length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_ride_priorities")
    .update(update)
    .eq("trip_id", tripId)
    .eq("attraction_id", attractionId)
    .eq("day_date", dayDate);
  if (error) throw new Error(error.message);
  revalidatePlanner();
}

export async function updateRidePriorityNote(
  tripId: string,
  attractionId: string,
  dayDate: string,
  note: string,
): Promise<void> {
  await updateRidePriorityMeta(tripId, attractionId, dayDate, { notes: note });
}

export async function reorderRidePriorities(
  tripId: string,
  dayDate: string,
  orderedIds: string[],
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i]!;
    const { error } = await supabase
      .from("trip_ride_priorities")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("trip_id", tripId)
      .eq("day_date", dayDate);
    if (error) throw new Error(error.message);
  }
  revalidatePlanner();
}
