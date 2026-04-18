import type { SupabaseClient } from "@supabase/supabase-js";

/** Owner or accepted editor collaborator may mutate planner data for a trip. */
export async function userCanEditTrip(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<boolean> {
  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, owner_id")
    .eq("id", tripId)
    .maybeSingle();
  if (error || !trip) return false;
  if (trip.owner_id === userId) return true;
  const { data: collab } = await supabase
    .from("trip_collaborators")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
  return collab?.role === "editor";
}
