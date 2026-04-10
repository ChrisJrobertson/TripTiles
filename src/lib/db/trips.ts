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

  return {
    id: String(row.id),
    owner_id: owner,
    agency_id: row.agency_id != null ? String(row.agency_id) : null,
    family_name: String(row.family_name ?? ""),
    adventure_name: String(row.adventure_name ?? ""),
    destination: (row.destination as Destination) ?? "custom",
    start_date: String(row.start_date ?? ""),
    end_date: String(row.end_date ?? ""),
    has_cruise: Boolean(row.has_cruise),
    cruise_embark: row.cruise_embark != null ? String(row.cruise_embark) : null,
    cruise_disembark:
      row.cruise_disembark != null ? String(row.cruise_disembark) : null,
    assignments,
    preferences,
    is_public: Boolean(row.is_public),
    public_slug: row.public_slug != null ? String(row.public_slug) : null,
    adults: Number(row.adults ?? 2),
    children: Number(row.children ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getUserTrips(userId: string): Promise<Trip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

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
