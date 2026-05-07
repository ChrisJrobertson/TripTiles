"use server";

import {
  applyKeyDatesToPrefs,
  isAutoManagedKeyDateId,
  mergeSuggestedTemplatesIntoExisting,
  readUserKeyDates,
  validateDraftKeyDate,
  type DraftKeyDate,
} from "@/lib/planner/key-dates";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { KeyDate } from "@/lib/types";
import { revalidatePath } from "next/cache";

export type KeyDatesActionRowsResult =
  | { ok: true; key_dates: KeyDate[] }
  | { ok: false; error: string };

function revalidatePlanner() {
  revalidatePath("/planner");
  revalidatePath("/plans");
}

async function persistKeyDatesRows(
  tripId: string,
  nextRows: KeyDate[],
): Promise<KeyDatesActionRowsResult> {
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

  const nextPrefs = applyKeyDatesToPrefs(prev, nextRows);

  const { error } = await supabase
    .from("trips")
    .update({
      preferences: nextPrefs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePlanner();
  return { ok: true, key_dates: nextRows };
}

type TripSeedRow = {
  preferences: Record<string, unknown>;
  region_id: string | null;
  start_date: string;
  has_cruise: boolean;
  cruise_embark: string | null;
  cruise_disembark: string | null;
};

export async function mergeSuggestedKeyDatesAction(
  tripId: string,
): Promise<KeyDatesActionRowsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data: trip, error: fetchErr } = await supabase
    .from("trips")
    .select("preferences, region_id, start_date, has_cruise, cruise_embark, cruise_disembark")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!trip) return { ok: false, error: "Trip not found." };

  let region_country_code: string | null = null;
  const ridSeed =
    typeof trip.region_id === "string" ? trip.region_id.trim() : "";
  if (ridSeed) {
    const { data: reg, error: regErr } = await supabase
      .from("regions")
      .select("country_code")
      .eq("id", ridSeed)
      .maybeSingle();
    if (!regErr && reg?.country_code != null) {
      const cc =
        typeof reg.country_code === "string" ? reg.country_code.trim() : "";
      region_country_code = cc || null;
    }
  }

  const t = trip as unknown as TripSeedRow;

  const prefsRecord =
    t.preferences && typeof t.preferences === "object" && !Array.isArray(t.preferences)
      ? t.preferences
      : {};

  const existing = readUserKeyDates(prefsRecord);

  const merged = mergeSuggestedTemplatesIntoExisting(existing, {
    region_id: typeof t.region_id === "string" ? t.region_id.trim() || null : null,
    start_date: String(t.start_date ?? ""),
    has_cruise: Boolean(t.has_cruise),
    cruise_embark: t.cruise_embark,
    cruise_disembark: t.cruise_disembark,
    region_country_code,
  });

  return persistKeyDatesRows(tripId, merged);
}

function normalizeCat(
  cat: DraftKeyDate["category"],
): DraftKeyDate["category"] {
  if (cat == null || cat === "") return undefined;
  if (typeof cat !== "string") return undefined;
  const c = cat.trim().toLowerCase();
  if (
    c === "booking" ||
    c === "admin" ||
    c === "travel" ||
    c === "other"
  ) {
    return c;
  }
  return undefined;
}

export async function addKeyDateAction(
  tripId: string,
  draft: DraftKeyDate,
): Promise<KeyDatesActionRowsResult> {
  const v = validateDraftKeyDate(draft);
  if (!v.ok) return v;

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

  const prefs =
    row.preferences &&
    typeof row.preferences === "object" &&
    !Array.isArray(row.preferences)
      ? (row.preferences as Record<string, unknown>)
      : {};

  const existing = readUserKeyDates(prefs);
  const mk = draft.title.trim();
  if (existing.some((e) => e.title.trim() === mk)) {
    return { ok: false, error: "A key date with this title already exists." };
  }

  let mo = Math.max(0, ...existing.map((e) => e.sort_order ?? 0));
  mo += 10;

  const cat = normalizeCat(draft.category);
  const descTrim = draft.description?.trim()?.slice(0, 300);
  const neu: KeyDate = {
    id: crypto.randomUUID(),
    icon: draft.icon.trim(),
    title: draft.title.trim(),
    date: draft.date.trim(),
    sort_order: mo,
    ...(descTrim ? { description: descTrim } : {}),
    ...(cat ? { category: cat } : {}),
  };

  const nextRows = [...existing, neu].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    const s = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });

  return persistKeyDatesRows(tripId, nextRows);
}

export async function updateKeyDateAction(
  tripId: string,
  id: string,
  draft: DraftKeyDate,
): Promise<KeyDatesActionRowsResult> {
  if (isAutoManagedKeyDateId(id)) {
    return {
      ok: false,
      error: "This date is tied to your trip and cannot be edited here.",
    };
  }
  const v = validateDraftKeyDate(draft);
  if (!v.ok) return v;

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

  const prefs =
    row.preferences &&
    typeof row.preferences === "object" &&
    !Array.isArray(row.preferences)
      ? (row.preferences as Record<string, unknown>)
      : {};

  const existing = readUserKeyDates(prefs);
  const idx = existing.findIndex((e) => e.id === id);
  if (idx < 0) return { ok: false, error: "Key date not found." };

  const cat = normalizeCat(draft.category);
  const mkTitle = draft.title.trim();
  if (existing.some((e, i) => i !== idx && e.title.trim() === mkTitle)) {
    return { ok: false, error: "Another key date already uses this title." };
  }

  const descTrim =
    draft.description != null ? draft.description.slice(0, 300).trim() : "";

  const updated: KeyDate = {
    ...existing[idx],
    icon: draft.icon.trim(),
    title: mkTitle,
    date: draft.date.trim(),
    ...(descTrim.length > 0 ? { description: descTrim } : {}),
    ...(cat ? { category: cat } : {}),
  };

  if (!descTrim.length) {
    delete (updated as { description?: string }).description;
  }
  if (!cat) {
    delete (updated as { category?: KeyDate["category"] }).category;
  }

  const nextRows = [...existing];
  nextRows[idx] = updated;

  nextRows.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    const s = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });

  return persistKeyDatesRows(tripId, nextRows);
}

export async function removeKeyDateAction(
  tripId: string,
  id: string,
): Promise<KeyDatesActionRowsResult> {
  if (isAutoManagedKeyDateId(id)) {
    return { ok: false, error: "This date cannot be removed." };
  }

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

  const prefs =
    row.preferences &&
    typeof row.preferences === "object" &&
    !Array.isArray(row.preferences)
      ? (row.preferences as Record<string, unknown>)
      : {};

  const existing = readUserKeyDates(prefs);
  const nextRows = existing.filter((e) => e.id !== id);
  if (nextRows.length === existing.length) {
    return { ok: false, error: "Key date not found." };
  }

  return persistKeyDatesRows(tripId, nextRows);
}
