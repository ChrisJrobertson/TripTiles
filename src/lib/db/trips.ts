import { normaliseThemeKey } from "@/lib/themes";
import { createClient } from "@/lib/supabase/server";
import type {
  Assignments,
  DaySnapshot,
  Destination,
  Trip,
  TripPlanningPreferences,
} from "@/lib/types";

export function mapTripRow(row: Record<string, unknown>): Trip {
  const raw = row.assignments;
  const assignments: Assignments =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Assignments)
      : {};

  const prefs = row.preferences;
  const preferences: Record<string, unknown> =
    prefs && typeof prefs === "object" && !Array.isArray(prefs)
      ? (prefs as Record<string, unknown>)
      : {};

  const owner =
    row.owner_id != null ? String(row.owner_id) : String(row.user_id ?? "");

  const updated = String(row.updated_at ?? "");
  const created = String(row.created_at ?? "");
  const lastOpened =
    row.last_opened_at != null
      ? String(row.last_opened_at)
      : updated || created;

  const childAges = row.child_ages;
  const child_ages: number[] = Array.isArray(childAges)
    ? childAges.map((n) => Number(n))
    : [];

  const prevAss = row.previous_assignments_snapshot;
  const prevPrefs = row.previous_preferences_snapshot;
  const prevAt = row.previous_assignments_snapshot_at;
  const rawDaySnapshots = row.day_snapshots;
  const day_snapshots: DaySnapshot[] = Array.isArray(rawDaySnapshots)
    ? (rawDaySnapshots.filter(
        (snap) => snap && typeof snap === "object" && !Array.isArray(snap),
      ) as DaySnapshot[])
    : [];

  const planningRaw = row.planning_preferences;
  const planning_preferences = parsePlanningPreferences(planningRaw);

  return {
    id: String(row.id),
    owner_id: owner,
    agency_id: row.agency_id != null ? String(row.agency_id) : null,
    family_name: String(row.family_name ?? ""),
    adventure_name: String(row.adventure_name ?? ""),
    destination: (row.destination as Destination) ?? "custom",
    region_id: row.region_id != null ? String(row.region_id) : null,
    start_date: String(row.start_date ?? ""),
    end_date: String(row.end_date ?? ""),
    has_cruise: Boolean(row.has_cruise),
    cruise_embark: row.cruise_embark != null ? String(row.cruise_embark) : null,
    cruise_disembark:
      row.cruise_disembark != null ? String(row.cruise_disembark) : null,
    assignments,
    preferences,
    notes: row.notes != null ? String(row.notes) : null,
    is_public: Boolean(row.is_public),
    public_slug: row.public_slug != null ? String(row.public_slug) : null,
    clone_count: Number(row.clone_count ?? 0),
    view_count: Number(row.view_count ?? 0),
    adults: Number(row.adults ?? 2),
    children: Number(row.children ?? 0),
    child_ages,
    created_at: created,
    updated_at: updated,
    last_opened_at: lastOpened,
    previous_assignments_snapshot:
      prevAss && typeof prevAss === "object" && !Array.isArray(prevAss)
        ? (prevAss as Assignments)
        : null,
    previous_preferences_snapshot:
      prevPrefs && typeof prevPrefs === "object" && !Array.isArray(prevPrefs)
        ? (prevPrefs as Record<string, unknown>)
        : null,
    previous_assignments_snapshot_at:
      prevAt != null ? String(prevAt) : null,
    day_snapshots,
    planning_preferences,
    colour_theme: normaliseThemeKey(
      row.colour_theme != null ? String(row.colour_theme) : undefined,
    ),
    email_reminders:
      row.email_reminders === undefined || row.email_reminders === null
        ? true
        : Boolean(row.email_reminders),
    gallery_owner_label:
      row.gallery_owner_label != null && String(row.gallery_owner_label).trim()
        ? String(row.gallery_owner_label).trim()
        : null,
    budget_target:
      row.budget_target != null && row.budget_target !== ""
        ? Number(row.budget_target)
        : null,
    budget_currency:
      row.budget_currency != null && String(row.budget_currency).trim()
        ? String(row.budget_currency)
        : "GBP",
    is_archived: Boolean(row.is_archived),
    archived_reason:
      row.archived_reason != null ? String(row.archived_reason) : null,
  };
}

export function scrubTripForPublicRead(trip: Trip): Trip {
  const publicPreferences = { ...(trip.preferences ?? {}) };
  delete publicPreferences.day_notes;
  const planning_preferences = trip.planning_preferences
    ? {
        ...trip.planning_preferences,
        additionalNotes: null,
      }
    : null;

  return {
    ...trip,
    family_name: "",
    notes: null,
    preferences: publicPreferences,
    planning_preferences,
    previous_assignments_snapshot: null,
    previous_preferences_snapshot: null,
    previous_assignments_snapshot_at: null,
    day_snapshots: [],
  };
}

function parsePlanningPreferences(
  raw: unknown,
): TripPlanningPreferences | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const pace = o.pace;
  if (pace !== "relaxed" && pace !== "balanced" && pace !== "intense") {
    return null;
  }
  const mustRaw = o.mustDoParks;
  const mustDoParks = Array.isArray(mustRaw)
    ? mustRaw.filter((x): x is string => typeof x === "string")
    : [];
  const priRaw = o.priorities;
  const priorities = Array.isArray(priRaw)
    ? priRaw.filter((x): x is string => typeof x === "string")
    : [];
  const additionalNotes =
    o.additionalNotes === null
      ? null
      : typeof o.additionalNotes === "string"
        ? o.additionalNotes
        : null;
  const adultsRaw = Number(o.adults);
  const childrenRaw = Number(o.children);
  const agesRaw = o.childAges;
  const childAges = Array.isArray(agesRaw)
    ? agesRaw
        .map((n) => Number(n))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 17)
    : [];
  const adults =
    Number.isFinite(adultsRaw) && adultsRaw >= 1 && adultsRaw <= 10
      ? Math.floor(adultsRaw)
      : 2;
  const children =
    Number.isFinite(childrenRaw) && childrenRaw >= 0 && childrenRaw <= 10
      ? Math.floor(childrenRaw)
      : 0;
  const includeDisneySkipTips =
    typeof o.includeDisneySkipTips === "boolean"
      ? o.includeDisneySkipTips
      : undefined;
  const includeUniversalSkipTips =
    typeof o.includeUniversalSkipTips === "boolean"
      ? o.includeUniversalSkipTips
      : undefined;
  return {
    pace,
    mustDoParks,
    priorities: priorities.slice(0, 12),
    additionalNotes,
    adults,
    children,
    childAges,
    ...(includeDisneySkipTips !== undefined
      ? { includeDisneySkipTips }
      : {}),
    ...(includeUniversalSkipTips !== undefined
      ? { includeUniversalSkipTips }
      : {}),
  };
}

export async function getUserTrips(userId: string): Promise<Trip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_archived", false)
    .order("last_opened_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => mapTripRow(r as Record<string, unknown>));
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (error || !data) return null;
  return scrubTripForPublicRead(mapTripRow(data as Record<string, unknown>));
}

/** Most recently opened trip for the planner shell, or null if none. */
export async function getActiveTripForUser(
  userId: string,
): Promise<Trip | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_archived", false)
    .order("last_opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapTripRow(data as Record<string, unknown>);
}

export async function getUserTripCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("is_archived", false);

  if (error) throw error;
  return count ?? 0;
}

/** Public share page — `trips` RLS allows `is_public = true` for anon. */
export async function getTripByPublicSlug(
  slug: string,
): Promise<Trip | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("is_public", true)
    .eq("public_slug", trimmed)
    .maybeSingle();

  if (error || !data) return null;
  return mapTripRow(data as Record<string, unknown>);
}

export type PublicTripListSort = "clones" | "newest" | "longest";
export type PublicTripLengthBucket = "short" | "medium" | "long";

export function tripCalendarDayCount(trip: {
  start_date: string;
  end_date: string;
}): number {
  const s = new Date(trip.start_date).getTime();
  const e = new Date(trip.end_date).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  return Math.floor((e - s) / 86400000) + 1;
}

function lengthBucketForTrip(
  trip: { start_date: string; end_date: string },
): PublicTripLengthBucket {
  const n = tripCalendarDayCount(trip);
  if (n <= 5) return "short";
  if (n <= 10) return "medium";
  return "long";
}

/** Gallery listing (no owner PII). Caller resolves `region_id` → labels. */
export async function listPublicTrips(input: {
  regionId: string | null;
  limit: number;
  offset: number;
  sort?: PublicTripListSort;
  lengthBucket?: PublicTripLengthBucket | null;
}): Promise<Trip[]> {
  const supabase = await createClient();
  const sort = input.sort ?? "clones";
  const needsMemory =
    Boolean(input.lengthBucket) || sort === "longest";

  const buildBase = () => {
    let q = supabase.from("trips").select("*").eq("is_public", true);
    if (input.regionId) q = q.eq("region_id", input.regionId);
    return q;
  };

  if (!needsMemory) {
    let q = buildBase();
    if (sort === "newest") {
      q = q.order("created_at", { ascending: false });
    } else {
      q = q
        .order("clone_count", { ascending: false })
        .order("created_at", { ascending: false });
    }
    const { data, error } = await q.range(
      input.offset,
      input.offset + input.limit - 1,
    );
    if (error) throw error;
    return (data ?? []).map((r) =>
      scrubTripForPublicRead(mapTripRow(r as Record<string, unknown>)),
    );
  }

  const cap = 250;
  let q = buildBase();
  if (sort === "newest") {
    q = q.order("created_at", { ascending: false });
  } else {
    q = q
      .order("clone_count", { ascending: false })
      .order("created_at", { ascending: false });
  }
  const { data, error } = await q.range(0, cap - 1);
  if (error) throw error;

  let list = (data ?? []).map((r) =>
    scrubTripForPublicRead(mapTripRow(r as Record<string, unknown>)),
  );
  if (input.lengthBucket) {
    list = list.filter((t) => lengthBucketForTrip(t) === input.lengthBucket);
  }
  if (sort === "longest") {
    list = [...list].sort(
      (a, b) => tripCalendarDayCount(b) - tripCalendarDayCount(a),
    );
  } else if (sort === "newest") {
    list = [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }
  return list.slice(input.offset, input.offset + input.limit);
}

export async function getFeaturedPublicTrips(limit: number): Promise<Trip[]> {
  return listPublicTrips({ regionId: null, limit, offset: 0 });
}
