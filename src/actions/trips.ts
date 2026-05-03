"use server";

import {
  awardAchievementAction,
  checkAndAwardMilestonesAction,
  tryAwardAchievementForUserId,
} from "@/actions/achievements";
import { getUserCustomTiles } from "@/lib/db/custom-tiles";
import { getUserTripCount, mapTripRow } from "@/lib/db/trips";
import { currentUserCanCreateTrip } from "@/lib/entitlements";
import {
  isTierLoadFailure,
  tierLoadFailureUserMessage,
} from "@/lib/supabase/tier-load-error";
import { syncTripLifecycleEmailQueue } from "@/lib/email/schedule-trip-emails";
import { legacyDestinationFromRegionId } from "@/lib/legacy-destination";
import { formatGalleryOwnerLabel } from "@/lib/format-gallery-owner";
import { defaultPublicTripSlug, slugifyAdventureName } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normaliseThemeKey, type ThemeKey } from "@/lib/themes";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { readMustDosMap } from "@/lib/must-dos";
import type {
  Assignments,
  Assignment,
  Destination,
  SlotAssignmentValue,
  TripPlanningPreferences,
} from "@/lib/types";
import type { TripMustDosMap } from "@/types/must-dos";
import { revalidatePath } from "next/cache";
import { seedTripChecklistIfEmptyAction } from "@/actions/checklist";
import { syncTripReminderRows } from "@/lib/trip-reminder-seed";
import { assertTierAllows, tierErrorToClientPayload } from "@/lib/tier";
import { TierError } from "@/lib/tier-errors";

function revalidatePlanner() {
  revalidatePath("/planner");
}

function randomSlugSuffix(): string {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const b = new Uint8Array(4);
    c.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  return `t${Date.now().toString(36)}`;
}

const SLOT_TYPES = ["am", "pm", "lunch", "dinner"] as const;

function dayAssignmentsEqual(a: Assignment | undefined, b: Assignment | undefined): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

function filterDaySnapshots(
  raw: unknown,
  changedDates: Set<string>,
): unknown[] {
  if (!Array.isArray(raw) || changedDates.size === 0) {
    return Array.isArray(raw) ? raw : [];
  }
  return raw.filter((snap) => {
    if (!snap || typeof snap !== "object" || Array.isArray(snap)) return false;
    const date = (snap as { date?: unknown }).date;
    return typeof date !== "string" || !changedDates.has(date);
  });
}

function localDateYmd(base: Date, addDays: number): string {
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + addDays,
  );
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Minimal trip for users who want to fill in region and details later. */
export async function createBlankTripAction(): Promise<
  | { ok: true; tripId: string; newAchievements: string[] }
  | { ok: false; error: string; code?: "TIER_LIMIT_TRIPS" }
> {
  const today = new Date();
  return createTripActionWithRegion({
    familyName: "My family",
    adventureName: "My first TripTiles",
    regionId: null,
    startDate: localDateYmd(today, 14),
    endDate: localDateYmd(today, 21),
    hasCruise: false,
    adults: 2,
    children: 0,
    childAges: [],
    planningPreferences: null,
    colourTheme: undefined,
  });
}

type CreateTripInput = {
  familyName: string;
  adventureName: string;
  regionId: string | null;
  startDate: string;
  endDate: string;
  hasCruise: boolean;
  cruiseEmbark?: string | null;
  cruiseDisembark?: string | null;
  adults?: number;
  children?: number;
  childAges?: number[];
  planningPreferences?: TripPlanningPreferences | null;
  colourTheme?: ThemeKey;
};

async function createTripActionWithRegion(
  input: CreateTripInput,
): Promise<
  | { ok: true; tripId: string; newAchievements: string[] }
  | { ok: false; error: string; code?: "TIER_LIMIT_TRIPS" }
> {
  const logTag =
    input.regionId == null ? "[createBlankTripAction]" : "[createTripAction]";
  let sessionUser: { id: string } | null = null;
  const startTs = Date.now();
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };
    sessionUser = user;

    const rogueTripId = (input as CreateTripInput & { tripId?: string }).tripId;
    if (rogueTripId != null && String(rogueTripId).trim() !== "") {
      console.error("[createTrip] failed", {
        error: "createTrip received an existing tripId — bug",
        userId: user.id,
        tripId: rogueTripId,
      });
      return {
        ok: false,
        error: "Could not create trip — please refresh and try again.",
      };
    }

    console.log("[createTrip] start", {
      userId: user.id,
      regionId: input.regionId,
      dates: [input.startDate, input.endDate],
      logTag,
    });

    try {
      await assertTierAllows(user.id, "trips");
    } catch (e) {
      const mapped = tierErrorToClientPayload(e);
      if (mapped?.code === "TIER_LIMIT_TRIPS") {
        return {
          ok: false,
          error:
            "You've reached your trip limit for this plan. Upgrade on Pricing to add more trips.",
          code: "TIER_LIMIT_TRIPS",
        };
      }
      if (e instanceof TierError) {
        return { ok: false, error: e.message };
      }
      throw e;
    }

    if (!(await currentUserCanCreateTrip())) {
      return {
        ok: false,
        error: "You've reached your trip limit for this plan.",
        code: "TIER_LIMIT_TRIPS",
      };
    }

    const legacyDestination: Destination = input.regionId
      ? legacyDestinationFromRegionId(input.regionId)
      : "custom";

    const supabase = await createClient();
    const hasCruise = input.hasCruise;
    const adults = Math.min(10, Math.max(1, Math.floor(input.adults ?? 2)));
    const children = Math.min(10, Math.max(0, Math.floor(input.children ?? 0)));
    const childAgesRaw = input.childAges ?? [];
    const child_ages =
      children > 0
        ? childAgesRaw
            .slice(0, children)
            .map((n) => Math.min(17, Math.max(0, Math.floor(Number(n)))))
            .filter((n) => !Number.isNaN(n))
        : [];
    const row = {
      owner_id: user.id,
      region_id: input.regionId,
      family_name: input.familyName.trim(),
      adventure_name: input.adventureName.trim(),
      destination: legacyDestination,
      start_date: input.startDate,
      end_date: input.endDate,
      has_cruise: hasCruise,
      cruise_embark: hasCruise ? input.cruiseEmbark ?? null : null,
      cruise_disembark: hasCruise ? input.cruiseDisembark ?? null : null,
      assignments: {} as Assignments,
      preferences: {} as Record<string, unknown>,
      is_public: false,
      public_slug: null as string | null,
      adults,
      children,
      child_ages,
      planning_preferences: input.planningPreferences ?? null,
      colour_theme: normaliseThemeKey(input.colourTheme),
      notes: null as string | null,
      budget_target: null as number | null,
      budget_currency: "GBP",
      email_reminders: true,
      gallery_owner_label: null as string | null,
      is_archived: false,
    };

    const { data: inserted, error } = await supabase
      .from("trips")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[createTrip] failed", {
        error: error.message,
        code: "code" in error ? String((error as { code?: string }).code) : undefined,
        userId: user.id,
        logTag,
      });
      return { ok: false, error: `Insert failed: ${error.message}` };
    }
    if (!inserted?.id) return { ok: false, error: "Insert failed." };

    console.log("[createTrip] success", {
      newTripId: String(inserted.id),
      durationMs: Date.now() - startTs,
      userId: user.id,
      logTag,
    });

    const newAchievements: string[] = [];

    const first = await awardAchievementAction("first_trip");
    if (first.ok && first.justEarned) newAchievements.push("first_trip");

    if (input.regionId) {
      const destKey = `dest_${input.regionId}`;
      const { data: destDef } = await supabase
        .from("achievement_definitions")
        .select("key")
        .eq("key", destKey)
        .maybeSingle();

      if (destDef) {
        const destAward = await awardAchievementAction(destKey);
        if (destAward.ok && destAward.justEarned) newAchievements.push(destKey);
      }
    }

    const milestoneKeys = await checkAndAwardMilestonesAction();
    newAchievements.push(...milestoneKeys);

    await syncTripLifecycleEmailQueue({
      supabase,
      userId: user.id,
      tripId: String(inserted.id),
      startDate: input.startDate,
      endDate: input.endDate,
    });

    if (input.regionId) {
      const seed = await seedTripChecklistIfEmptyAction({
        tripId: String(inserted.id),
        regionId: input.regionId,
        startDate: input.startDate,
        children,
        hasCruise,
      });
      if (!seed.ok) {
        console.warn("Checklist seed skipped:", seed.error);
      }
    }

    await syncTripReminderRows(supabase, String(inserted.id), input.startDate);

    revalidatePlanner();
    return { ok: true, tripId: String(inserted.id), newAchievements };
  } catch (e) {
    if (isTierLoadFailure(e)) {
      console.error(`${logTag} tier load failed`, {
        userId: sessionUser?.id,
        cause: e,
      });
      return { ok: false, error: tierLoadFailureUserMessage() };
    }
    console.error("[createTrip] failed", {
      error: e instanceof Error ? e.message : String(e),
      userId: sessionUser?.id,
      logTag,
    });
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function createTripAction(input: {
  familyName: string;
  adventureName: string;
  regionId: string;
  startDate: string;
  endDate: string;
  hasCruise: boolean;
  cruiseEmbark?: string | null;
  cruiseDisembark?: string | null;
  adults?: number;
  children?: number;
  childAges?: number[];
  planningPreferences?: TripPlanningPreferences | null;
  colourTheme?: ThemeKey;
}): Promise<
  | { ok: true; tripId: string; newAchievements: string[] }
  | { ok: false; error: string; code?: "TIER_LIMIT_TRIPS" }
> {
  return createTripActionWithRegion(input);
}

// ---- Update trip metadata ----
export async function updateTripMetadataAction(input: {
  tripId: string;
  familyName?: string;
  adventureName?: string;
  destination?: Destination;
  regionId?: string;
  startDate?: string;
  endDate?: string;
  adults?: number;
  children?: number;
  hasCruise?: boolean;
  cruiseEmbark?: string | null;
  cruiseDisembark?: string | null;
  emailReminders?: boolean;
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
    if (input.regionId !== undefined) {
      body.region_id = input.regionId;
      if (input.destination === undefined) {
        body.destination = legacyDestinationFromRegionId(input.regionId);
      }
    }
    if (input.startDate !== undefined) body.start_date = input.startDate;
    if (input.endDate !== undefined) body.end_date = input.endDate;
    if (input.adults !== undefined) {
      body.adults = Math.max(1, Math.floor(Number(input.adults)));
    }
    if (input.children !== undefined) {
      body.children = Math.max(0, Math.floor(Number(input.children)));
    }
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
    if (input.emailReminders !== undefined) {
      body.email_reminders = input.emailReminders;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("trips")
      .update(body)
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };

    if (input.startDate !== undefined || input.endDate !== undefined) {
      const { data: row } = await supabase
        .from("trips")
        .select("start_date, end_date")
        .eq("id", input.tripId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (
        row &&
        typeof row === "object" &&
        "start_date" in row &&
        "end_date" in row
      ) {
        await syncTripLifecycleEmailQueue({
          supabase,
          userId: user.id,
          tripId: input.tripId,
          startDate: String(row.start_date),
          endDate: String(row.end_date),
        });
        if (input.startDate !== undefined) {
          await syncTripReminderRows(
            supabase,
            input.tripId,
            String(row.start_date),
          );
        }
      }
    }

    revalidatePlanner();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function updateTripColourThemeAction(input: {
  tripId: string;
  colourTheme: ThemeKey;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("trips")
      .update({
        colour_theme: normaliseThemeKey(input.colourTheme),
        updated_at: new Date().toISOString(),
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

export async function updateTripPlanningPreferencesAction(input: {
  tripId: string;
  planningPreferences: TripPlanningPreferences | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("trips")
      .update({
        planning_preferences: input.planningPreferences,
        updated_at: new Date().toISOString(),
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
    const { data: existing, error: fetchErr } = await supabase
      .from("trips")
      .select("assignments, day_snapshots")
      .eq("id", input.tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!existing) return { ok: false, error: "Trip not found." };

    const currentAssignments =
      existing.assignments &&
      typeof existing.assignments === "object" &&
      !Array.isArray(existing.assignments)
        ? (existing.assignments as Assignments)
        : {};
    const changedDates = new Set<string>();
    for (const date of new Set([
      ...Object.keys(currentAssignments),
      ...Object.keys(input.assignments),
    ])) {
      if (!dayAssignmentsEqual(currentAssignments[date], input.assignments[date])) {
        changedDates.add(date);
      }
    }

    const { error } = await supabase
      .from("trips")
      .update({
        assignments: input.assignments,
        day_snapshots: filterDaySnapshots(existing.day_snapshots, changedDates),
        updated_at: now,
        last_opened_at: now,
        previous_assignments_snapshot: null,
        previous_preferences_snapshot: null,
        previous_assignments_snapshot_at: null,
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

export async function undoSmartPlanAction(
  tripId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("trips")
      .select(
        "previous_assignments_snapshot, previous_preferences_snapshot, previous_assignments_snapshot_at",
      )
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error || !row) return { ok: false, error: "Trip not found." };
    if (
      !row.previous_assignments_snapshot_at ||
      row.previous_assignments_snapshot == null
    ) {
      return { ok: false, error: "Nothing to undo." };
    }

    const { error: upErr } = await supabase
      .from("trips")
      .update({
        assignments: row.previous_assignments_snapshot,
        preferences: row.previous_preferences_snapshot ?? {},
        previous_assignments_snapshot: null,
        previous_preferences_snapshot: null,
        previous_assignments_snapshot_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("owner_id", user.id);

    if (upErr) return { ok: false, error: upErr.message };
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
  regionId: string;
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
    regionId: input.regionId,
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    hasCruise,
    cruiseEmbark: hasCruise ? input.cruiseEmbark : null,
    cruiseDisembark: hasCruise ? input.cruiseDisembark : null,
  });
}

/** Enable/disable read-only public link (`/plans/[slug]`). Slug is kept when disabled. */
export async function updateTripSharingAction(input: {
  tripId: string;
  enabled: boolean;
}): Promise<
  | { ok: true; publicSlug: string | null; isPublic: boolean }
  | { ok: false; error: string }
> {
  if (!input.enabled) {
    const r = await unpublishTripAction(input.tripId);
    if (!r.ok) return r;
    return { ok: true, publicSlug: r.publicSlug, isPublic: false };
  }
  return publishTripAction(input.tripId);
}

export async function unpublishTripAction(
  tripId: string,
): Promise<
  { ok: true; publicSlug: string | null } | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: row, error: loadErr } = await supabase
      .from("trips")
      .select("public_slug")
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (loadErr) return { ok: false, error: loadErr.message };
    const slug =
      row &&
      typeof row === "object" &&
      "public_slug" in row &&
      row.public_slug != null
        ? String(row.public_slug)
        : null;

    const { error } = await supabase
      .from("trips")
      .update({
        is_public: false,
        gallery_owner_label: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePlanner();
    revalidatePath("/plans");
    if (slug) revalidatePath(`/plans/${slug}`);
    return { ok: true, publicSlug: slug };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function publishTripAction(
  tripId: string,
): Promise<
  | { ok: true; publicSlug: string; isPublic: boolean; newAchievements: string[] }
  | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    try {
      await assertTierAllows(user.id, "public_share");
    } catch (e) {
      const mapped = tierErrorToClientPayload(e);
      if (mapped?.code === "TIER_PUBLIC_SHARE_DISABLED") {
        return {
          ok: false,
          error:
            "Public sharing is included with Pro and Family. Upgrade to publish this trip.",
        };
      }
      if (e instanceof TierError) {
        return { ok: false, error: e.message };
      }
      throw e;
    }

    const supabase = await createClient();
    const { data: tripRow, error: loadErr } = await supabase
      .from("trips")
      .select("id, adventure_name, public_slug, is_public")
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (loadErr) return { ok: false, error: loadErr.message };
    if (!tripRow || typeof tripRow !== "object" || !("id" in tripRow)) {
      return { ok: false, error: "Trip not found." };
    }

    const id = String(tripRow.id);
    const adventureName = String(
      "adventure_name" in tripRow ? tripRow.adventure_name ?? "" : "",
    );
    const wasPublic =
      "is_public" in tripRow ? Boolean(tripRow.is_public) : false;
    const existingSlug =
      "public_slug" in tripRow && tripRow.public_slug != null
        ? String(tripRow.public_slug)
        : null;

    const newAchievements: string[] = [];

    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const profRow = prof as { display_name?: string | null; email?: string | null } | null;
    const galleryLabel = formatGalleryOwnerLabel(
      profRow?.display_name ?? null,
      profRow?.email ?? null,
    );

    if (existingSlug) {
      const { error } = await supabase
        .from("trips")
        .update({
          is_public: true,
          gallery_owner_label: galleryLabel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tripId)
        .eq("owner_id", user.id);

      if (error) return { ok: false, error: error.message };
      if (!wasPublic) {
        const { error: scrubNotesErr } = await supabase
          .from("trip_ride_priorities")
          .update({ notes: null })
          .eq("trip_id", tripId);
        if (scrubNotesErr) {
          return { ok: false, error: scrubNotesErr.message };
        }
        const sh = await awardAchievementAction("first_share");
        if (sh.ok && sh.justEarned) newAchievements.push("first_share");
      }
      revalidatePlanner();
      revalidatePath("/plans");
      revalidatePath(`/plans/${existingSlug}`);
      return {
        ok: true,
        publicSlug: existingSlug,
        isPublic: true,
        newAchievements,
      };
    }

    const base = defaultPublicTripSlug(id, adventureName);
    for (let attempt = 0; attempt < 12; attempt++) {
      const slug =
        attempt === 0
          ? base
          : `${slugifyAdventureName(adventureName)}-${randomSlugSuffix()}`;
      const { error } = await supabase
        .from("trips")
        .update({
          is_public: true,
          public_slug: slug,
          gallery_owner_label: galleryLabel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tripId)
        .eq("owner_id", user.id);

      if (!error) {
        if (!wasPublic) {
          const { error: scrubNotesErr } = await supabase
            .from("trip_ride_priorities")
            .update({ notes: null })
            .eq("trip_id", tripId);
          if (scrubNotesErr) {
            return { ok: false, error: scrubNotesErr.message };
          }
        }
        const sh = await awardAchievementAction("first_share");
        if (sh.ok && sh.justEarned) newAchievements.push("first_share");
        revalidatePlanner();
        revalidatePath("/plans");
        revalidatePath(`/plans/${slug}`);
        return {
          ok: true,
          publicSlug: slug,
          isPublic: true,
          newAchievements,
        };
      }
      const code = (error as { code?: string }).code;
      if (code !== "23505") {
        return { ok: false, error: error.message };
      }
    }
    return { ok: false, error: "Could not allocate a unique share link." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

function scrubAssignmentsForClone(
  assignments: Assignments,
  sourceOwnerCustomTileIds: Set<string>,
): Assignments {
  const out: Assignments = {};
  for (const [dayKey, slots] of Object.entries(assignments)) {
    if (!slots || typeof slots !== "object") continue;
    const next: Assignment = {};
    for (const slot of SLOT_TYPES) {
      const v = slots[slot] as SlotAssignmentValue | undefined;
      const pid = getParkIdFromSlotValue(v);
      if (!pid) continue;
      if (sourceOwnerCustomTileIds.has(pid)) continue;
      if (v !== undefined) next[slot] = v;
    }
    if (Object.keys(next).length > 0) out[dayKey] = next;
  }
  return out;
}

export async function cloneTripAction(
  sourceTripId: string,
): Promise<
  | {
      ok: true;
      newTripId: string;
      newAchievements: string[];
      skippedCustomTiles: number;
    }
  | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    if (!(await currentUserCanCreateTrip())) {
      return { ok: false, error: "TIER_LIMIT" };
    }

    const supabase = await createClient();
    const { data: rawSource, error: srcErr } = await supabase
      .from("trips")
      .select("*")
      .eq("id", sourceTripId)
      .maybeSingle();

    if (srcErr || !rawSource) return { ok: false, error: "Trip not found." };

    const source = mapTripRow(rawSource as Record<string, unknown>);
    const canClone =
      source.is_public || source.owner_id === user.id;
    if (!canClone) return { ok: false, error: "Trip not found." };

    const ownerCustom = await getUserCustomTiles(source.owner_id);
    const customIds = new Set(ownerCustom.map((t) => t.id));
    const cleaned = scrubAssignmentsForClone(source.assignments, customIds);
    const countSlots = (a: Assignments) => {
      let n = 0;
      for (const s of Object.values(a)) {
        for (const slot of SLOT_TYPES) {
          if (getParkIdFromSlotValue(s[slot])) n += 1;
        }
      }
      return n;
    };
    const skippedCustomTiles =
      countSlots(source.assignments) - countSlots(cleaned);

    const tripCount = await getUserTripCount(user.id);
    const adventureName =
      tripCount === 0
        ? `${source.adventure_name.trim()} (cloned)`
        : source.adventure_name.trim();

    const legacyDestination = source.region_id
      ? legacyDestinationFromRegionId(source.region_id)
      : source.destination;

    const row = {
      owner_id: user.id,
      region_id: source.region_id,
      family_name: source.family_name.trim(),
      adventure_name: adventureName,
      destination: legacyDestination,
      start_date: source.start_date,
      end_date: source.end_date,
      has_cruise: source.has_cruise,
      cruise_embark: source.cruise_embark,
      cruise_disembark: source.cruise_disembark,
      assignments: cleaned,
      preferences: { ...source.preferences },
      is_public: false,
      public_slug: null as string | null,
      adults: source.adults,
      children: source.children,
      child_ages: [...source.child_ages],
      notes: source.notes,
      planning_preferences: source.planning_preferences,
      colour_theme: source.colour_theme,
      budget_target: source.budget_target,
      budget_currency: source.budget_currency,
      email_reminders: true,
      gallery_owner_label: null as string | null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("trips")
      .insert(row)
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      return { ok: false, error: insErr?.message ?? "Insert failed." };
    }

    const newTripId = String(inserted.id);
    const newAchievements: string[] = [];

    const { data: sourceRides } = await supabase
      .from("trip_ride_priorities")
      .select("attraction_id, day_date, priority, sort_order")
      .eq("trip_id", sourceTripId);

    if (sourceRides?.length) {
      const clonedRows = sourceRides.map(
        (r: {
          attraction_id: string;
          day_date: string;
          priority: string;
          sort_order: number;
        }) => ({
          trip_id: newTripId,
          attraction_id: r.attraction_id,
          day_date: r.day_date,
          priority: r.priority,
          sort_order: r.sort_order,
        }),
      );
      const { error: ridePriErr } = await supabase
        .from("trip_ride_priorities")
        .insert(clonedRows);
      if (ridePriErr) {
        console.warn("Clone ride priorities skipped:", ridePriErr.message);
      }
    }

    const { data: sourcePayments } = await supabase
      .from("trip_payments")
      .select("label, amount_pence, currency, booking_date, due_date, sort_order")
      .eq("trip_id", sourceTripId);
    if (sourcePayments?.length) {
      const clonedPay = sourcePayments.map(
        (r: {
          label: string;
          amount_pence: number;
          currency: string;
          booking_date: string | null;
          due_date: string | null;
          sort_order: number;
        }) => ({
          trip_id: newTripId,
          label: r.label,
          amount_pence: r.amount_pence,
          currency: r.currency,
          booking_date: r.booking_date,
          due_date: r.due_date,
          sort_order: r.sort_order,
        }),
      );
      const { error: payErr } = await supabase
        .from("trip_payments")
        .insert(clonedPay);
      if (payErr) {
        console.warn("Clone trip payments skipped:", payErr.message);
      }
    }

    const seedClone = await seedTripChecklistIfEmptyAction({
      tripId: newTripId,
      regionId: source.region_id ?? "orlando",
      startDate: source.start_date,
      children: source.children,
      hasCruise: source.has_cruise,
    });
    if (!seedClone.ok) {
      console.warn("Checklist seed (clone):", seedClone.error);
    }

    const fc = await awardAchievementAction("first_clone");
    if (fc.ok && fc.justEarned) newAchievements.push("first_clone");

    try {
      const admin = createServiceRoleClient();
      const { data: srcMeta } = await admin
        .from("trips")
        .select("clone_count, owner_id")
        .eq("id", sourceTripId)
        .maybeSingle();
      const prev = Number(
        (srcMeta as { clone_count?: number } | null)?.clone_count ?? 0,
      );
      const ownerId = String(
        (srcMeta as { owner_id?: string } | null)?.owner_id ?? source.owner_id,
      );
      const next = prev + 1;
      await admin
        .from("trips")
        .update({ clone_count: next })
        .eq("id", sourceTripId);
      if (next === 10) {
        await tryAwardAchievementForUserId(ownerId, "clones_10");
      }
    } catch {
      /* non-fatal */
    }

    await syncTripLifecycleEmailQueue({
      supabase,
      userId: user.id,
      tripId: newTripId,
      startDate: source.start_date,
      endDate: source.end_date,
    });

    revalidatePlanner();
    revalidatePath("/plans");
    return {
      ok: true,
      newTripId,
      newAchievements,
      skippedCustomTiles,
    };
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return { ok: false, error: tierLoadFailureUserMessage() };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Shallow-merge keys into `trips.preferences` (e.g. day_notes). */
export async function updateTripPreferencesPatchAction(input: {
  tripId: string;
  patch: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: row, error: fetchErr } = await supabase
      .from("trips")
      .select("preferences")
      .eq("id", input.tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!row) return { ok: false, error: "Trip not found." };

    const prev =
      row.preferences &&
      typeof row.preferences === "object" &&
      !Array.isArray(row.preferences)
        ? (row.preferences as Record<string, unknown>)
        : {};
    const next = { ...prev, ...input.patch };

    const { error } = await supabase
      .from("trips")
      .update({
        preferences: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePlanner();
    revalidatePath("/plans");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/**
 * Merges `preferences.public_view` (public /plans page labels). Empty strings clear overrides.
 * Private `family_name` / `adventure_name` on the trip are never shown on public pages except via these overrides.
 */
export async function updateTripPublicViewLabelsAction(input: {
  tripId: string;
  familyLabel: string;
  adventureTitle: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: row, error: fetchErr } = await supabase
      .from("trips")
      .select("preferences, public_slug")
      .eq("id", input.tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!row) return { ok: false, error: "Trip not found." };

    const prev =
      row.preferences &&
      typeof row.preferences === "object" &&
      !Array.isArray(row.preferences)
        ? (row.preferences as Record<string, unknown>)
        : {};
    const prevPv =
      prev.public_view &&
      typeof prev.public_view === "object" &&
      !Array.isArray(prev.public_view)
        ? ({ ...(prev.public_view as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : ({} as Record<string, unknown>);

    const fl = input.familyLabel.trim();
    const at = input.adventureTitle.trim();
    if (fl) prevPv.family_label = fl;
    else delete prevPv.family_label;
    if (at) prevPv.adventure_title = at;
    else delete prevPv.adventure_title;

    const nextPv = Object.keys(prevPv).length > 0 ? prevPv : undefined;
    const next: Record<string, unknown> = { ...prev };
    if (nextPv) next.public_view = nextPv;
    else delete next.public_view;

    const { error } = await supabase
      .from("trips")
      .update({
        preferences: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };

    revalidatePlanner();
    revalidatePath("/plans");
    const slug =
      row && typeof row === "object" && "public_slug" in row && row.public_slug
        ? String(row.public_slug)
        : null;
    if (slug) revalidatePath(`/plans/${slug}`);

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function updateParkMustDoDoneAction({
  tripId,
  dateISO,
  parkId,
  mustDoId,
  done,
}: {
  tripId: string;
  dateISO: string;
  parkId: string;
  mustDoId: string;
  done: boolean;
}): Promise<
  | { ok: true; nextPreferences: Record<string, unknown> }
  | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: row, error: fetchErr } = await supabase
      .from("trips")
      .select("preferences")
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!row) return { ok: false, error: "Trip not found." };

    const prev =
      row.preferences &&
      typeof row.preferences === "object" &&
      !Array.isArray(row.preferences)
        ? (row.preferences as Record<string, unknown>)
        : {};
    const map: TripMustDosMap = readMustDosMap(prev);
    const forDay = { ...(map[dateISO] ?? {}) };
    const list = (forDay[parkId] ?? []).map((m) => ({ ...m }));
    const idx = list.findIndex((m) => m.id === mustDoId);
    if (idx < 0) return { ok: false, error: "Must-do not found." };
    list[idx] = { ...list[idx]!, done };
    forDay[parkId] = list;
    const next = {
      ...prev,
      must_dos: { ...map, [dateISO]: forDay },
    };

    const { error } = await supabase
      .from("trips")
      .update({
        preferences: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePlanner();
    revalidatePath("/plans");
    return { ok: true, nextPreferences: next as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
