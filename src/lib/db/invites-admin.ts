import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type InvitePreview = {
  collaboratorId: string;
  status: string;
  adventureName: string;
  familyName: string;
  startDate: string;
  endDate: string;
  tripId: string;
};

export async function getInvitePreviewByToken(
  token: string,
): Promise<InvitePreview | null> {
  const t = token.trim();
  if (!t) return null;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("trip_collaborators")
      .select(
        "id, status, trip_id, trips(adventure_name, family_name, start_date, end_date)",
      )
      .eq("invite_token", t)
      .maybeSingle();

    if (error || !data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    const id = String(row.id ?? "");
    const status = String(row.status ?? "");
    const tripId = String(row.trip_id ?? "");
    const tripsRel = row.trips;
    const tripRaw = Array.isArray(tripsRel) ? tripsRel[0] : tripsRel;
    if (!tripRaw || typeof tripRaw !== "object") return null;
    const trip = tripRaw as Record<string, unknown>;
    return {
      collaboratorId: id,
      status,
      tripId,
      adventureName: String(trip.adventure_name ?? ""),
      familyName: String(trip.family_name ?? ""),
      startDate: String(trip.start_date ?? ""),
      endDate: String(trip.end_date ?? ""),
    };
  } catch {
    return null;
  }
}
