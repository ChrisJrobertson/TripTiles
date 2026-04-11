import { createClient } from "@/lib/supabase/server";
import type { Assignments, Destination, Trip } from "@/lib/types";

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
  };
}

export async function getUserTrips(userId: string): Promise<Trip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", userId)
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
  return mapTripRow(data as Record<string, unknown>);
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
    .eq("owner_id", userId);

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

/** Gallery listing (no owner PII). Caller resolves `region_id` → labels. */
export async function listPublicTrips(input: {
  regionId: string | null;
  limit: number;
  offset: number;
}): Promise<Trip[]> {
  const supabase = await createClient();
  let q = supabase
    .from("trips")
    .select("*")
    .eq("is_public", true)
    .order("clone_count", { ascending: false })
    .order("view_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.regionId) {
    q = q.eq("region_id", input.regionId);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r) => mapTripRow(r as Record<string, unknown>));
}

export async function getFeaturedPublicTrips(limit: number): Promise<Trip[]> {
  return listPublicTrips({ regionId: null, limit, offset: 0 });
}
