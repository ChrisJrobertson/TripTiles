"use server";

import { getUserTripCount } from "@/lib/db/trips";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Assignments, Destination } from "@/lib/types";
import { revalidatePath } from "next/cache";

const FREE_TIER_TRIP_LIMIT = 1;

function revalidatePlanner() {
  revalidatePath("/planner");
}

type ProfileTierRow = { tier: string };

async function getProfileTier(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as ProfileTierRow).tier ?? null;
}

// ---- Create ----
export async function createTripAction(input: {
  familyName: string;
  adventureName: string;
  destination: Destination;
  startDate: string;
  endDate: string;
  hasCruise: boolean;
  cruiseEmbark?: string | null;
  cruiseDisembark?: string | null;
}): Promise<{ ok: true; tripId: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const tier = await getProfileTier(user.id);
    if (tier === "free" || tier === null) {
      const count = await getUserTripCount(user.id);
      if (count >= FREE_TIER_TRIP_LIMIT) {
        return { ok: false, error: "TIER_LIMIT" };
      }
    }

    const supabase = await createClient();
    const hasCruise = input.hasCruise;
    const row = {
      owner_id: user.id,
      family_name: input.familyName.trim(),
      adventure_name: input.adventureName.trim(),
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      has_cruise: hasCruise,
      cruise_embark: hasCruise ? input.cruiseEmbark ?? null : null,
      cruise_disembark: hasCruise ? input.cruiseDisembark ?? null : null,
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
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    if (!inserted?.id) return { ok: false, error: "Insert failed." };
    revalidatePlanner();
    return { ok: true, tripId: String(inserted.id) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ---- Update trip metadata ----
export async function updateTripMetadataAction(input: {
  tripId: string;
  familyName?: string;
  adventureName?: string;
  destination?: Destination;
  startDate?: string;
  endDate?: string;
  hasCruise?: boolean;
  cruiseEmbark?: string | null;
  cruiseDisembark?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const body: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.familyName !== undefined) {
      body.family_name = input.familyName.trim();
    }
    if (input.adventureName !== undefined) {
      body.adventure_name = input.adventureName.trim();
    }
    if (input.destination !== undefined) body.destination = input.destination;
    if (input.startDate !== undefined) body.start_date = input.startDate;
    if (input.endDate !== undefined) body.end_date = input.endDate;
    if (input.hasCruise === true) {
      body.has_cruise = true;
      if (input.cruiseEmbark !== undefined) body.cruise_embark = input.cruiseEmbark;
      if (input.cruiseDisembark !== undefined) {
        body.cruise_disembark = input.cruiseDisembark;
      }
    } else if (input.hasCruise === false) {
      body.has_cruise = false;
      body.cruise_embark = null;
      body.cruise_disembark = null;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("trips")
      .update(body)
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePlanner();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ---- Update assignments ----
export async function updateAssignmentsAction(input: {
  tripId: string;
  assignments: Assignments;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const now = new Date().toISOString();
    const supabase = await createClient();
    const { error } = await supabase
      .from("trips")
      .update({
        assignments: input.assignments,
        updated_at: now,
        last_opened_at: now,
      })
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePlanner();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ---- Delete ----
export async function deleteTripAction(
  tripId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
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
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

// ---- Touch last opened (no revalidate) ----
export async function touchTripAction(
  tripId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("trips")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Wizard "edit trip" flow: full metadata replace from wizard fields. */
export async function updateTripFromWizardAction(input: {
  tripId: string;
  familyName: string;
  adventureName: string;
  destination: Destination;
  startDate: string;
  endDate: string;
  hasCruise: boolean;
  cruiseEmbark: string | null;
  cruiseDisembark: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const hasCruise = input.hasCruise;
  return updateTripMetadataAction({
    tripId: input.tripId,
    familyName: input.familyName.trim(),
    adventureName: input.adventureName.trim(),
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    hasCruise,
    cruiseEmbark: hasCruise ? input.cruiseEmbark : null,
    cruiseDisembark: hasCruise ? input.cruiseDisembark : null,
  });
}
