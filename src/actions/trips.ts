"use server";

import { mapTripRow } from "@/lib/db/trips";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Assignments, Destination, Trip, WizardData } from "@/lib/types";
import { revalidatePath } from "next/cache";

export type TripActionResult =
  | { ok: true; trip: Trip }
  | { ok: false; error: string };

export type DeleteTripResult = { ok: true } | { ok: false; error: string };

export type TripUpdateInput = Partial<{
  family_name: string;
  adventure_name: string;
  destination: Destination;
  start_date: string;
  end_date: string;
  has_cruise: boolean;
  cruise_embark: string | null;
  cruise_disembark: string | null;
  assignments: Assignments;
  preferences: Record<string, unknown>;
}>;

function revalidatePlanner() {
  revalidatePath("/planner");
}

export async function createTripFromWizard(
  data: WizardData,
): Promise<TripActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const id = crypto.randomUUID();

  const hasCruise = data.has_cruise;
  const row = {
    id,
    owner_id: user.id,
    agency_id: null as string | null,
    family_name: data.family_name.trim(),
    adventure_name: data.adventure_name.trim(),
    destination: data.destination,
    start_date: data.start_date,
    end_date: data.end_date,
    has_cruise: hasCruise,
    cruise_embark: hasCruise ? data.cruise_embark : null,
    cruise_disembark: hasCruise ? data.cruise_disembark : null,
    assignments: {} as Assignments,
    preferences: {} as Record<string, unknown>,
    is_public: false,
    public_slug: null as string | null,
    adults: 2,
    children: 0,
  };

  const { data: inserted, error } = await supabase
    .from("trips")
    .insert(row)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true, trip: mapTripRow(inserted as Record<string, unknown>) };
}

export async function updateTripFromWizard(
  tripId: string,
  data: WizardData,
): Promise<TripActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const hasCruise = data.has_cruise;
  const patch = {
    family_name: data.family_name.trim(),
    adventure_name: data.adventure_name.trim(),
    destination: data.destination,
    start_date: data.start_date,
    end_date: data.end_date,
    has_cruise: hasCruise,
    cruise_embark: hasCruise ? data.cruise_embark : null,
    cruise_disembark: hasCruise ? data.cruise_disembark : null,
  };

  return updateTrip(tripId, patch);
}

export async function updateTrip(
  tripId: string,
  patch: TripUpdateInput,
): Promise<TripActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();

  const body: Record<string, unknown> = { ...patch };
  if (patch.has_cruise === false) {
    body.cruise_embark = null;
    body.cruise_disembark = null;
  }
  body.updated_at = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("trips")
    .update(body)
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Trip not found or access denied." };
  revalidatePlanner();
  return { ok: true, trip: mapTripRow(row as Record<string, unknown>) };
}

export async function deleteTrip(tripId: string): Promise<DeleteTripResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}
