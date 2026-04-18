"use server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type {
  Attraction,
  AttractionCategory,
  RidePriority,
  SkipLineSystem,
  SkipLineTier,
  ThrillLevel,
  TripRidePriority,
} from "@/types/attractions";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { formatDateKey, parseDate } from "@/lib/date-helpers";
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

function mapAttractionRow(r: Record<string, unknown>): Attraction {
  const tags = r.tags;
  return {
    id: String(r.id),
    park_id: String(r.park_id),
    name: String(r.name),
    category: (r.category as AttractionCategory) ?? "ride",
    height_requirement_cm:
      r.height_requirement_cm == null
        ? null
        : Number(r.height_requirement_cm),
    thrill_level: (r.thrill_level as ThrillLevel) ?? "moderate",
    is_indoor: Boolean(r.is_indoor),
    duration_minutes:
      r.duration_minutes == null ? null : Number(r.duration_minutes),
    skip_line_system: (r.skip_line_system as SkipLineSystem | null) ?? null,
    skip_line_tier: (r.skip_line_tier as SkipLineTier | null) ?? null,
    skip_line_notes:
      r.skip_line_notes == null ? null : String(r.skip_line_notes),
    avg_wait_peak_minutes:
      r.avg_wait_peak_minutes == null
        ? null
        : Number(r.avg_wait_peak_minutes),
    avg_wait_offpeak_minutes:
      r.avg_wait_offpeak_minutes == null
        ? null
        : Number(r.avg_wait_offpeak_minutes),
    best_time_to_ride:
      r.best_time_to_ride == null ? null : String(r.best_time_to_ride),
    sort_order: Number(r.sort_order ?? 0),
    is_seasonal: Boolean(r.is_seasonal),
    is_temporarily_closed: Boolean(r.is_temporarily_closed),
    closure_note: r.closure_note == null ? null : String(r.closure_note),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    official_url: r.official_url == null ? null : String(r.official_url),
  };
}

function mapPriorityRow(
  r: Record<string, unknown>,
  attraction?: Attraction,
): TripRidePriority {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    attraction_id: String(r.attraction_id),
    day_date: String(r.day_date),
    priority: (r.priority as RidePriority) ?? "must_do",
    sort_order: Number(r.sort_order ?? 0),
    notes: r.notes == null ? null : String(r.notes),
    created_at: String(r.created_at ?? ""),
    attraction,
  };
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
    const dk = formatDateKey(parseDate(rawDay.slice(0, 10)));
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

export async function updateRidePriorityNote(
  tripId: string,
  attractionId: string,
  dayDate: string,
  note: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_ride_priorities")
    .update({ notes: note.slice(0, 500) })
    .eq("trip_id", tripId)
    .eq("attraction_id", attractionId)
    .eq("day_date", dayDate);
  if (error) throw new Error(error.message);
  revalidatePlanner();
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
