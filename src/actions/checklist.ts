"use server";

import { generateChecklist } from "@/data/checklist-templates";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ChecklistCategory, TripChecklistItem } from "@/lib/types";
import { revalidatePath } from "next/cache";

function revalidatePlanner() {
  revalidatePath("/planner");
}

function mapChecklistRow(r: Record<string, unknown>): TripChecklistItem {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    category: r.category as ChecklistCategory,
    label: String(r.label ?? ""),
    is_checked: Boolean(r.is_checked),
    is_custom: Boolean(r.is_custom),
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
  };
}

export async function listTripChecklistItemsAction(
  tripId: string,
): Promise<
  { ok: true; items: TripChecklistItem[] } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_checklist_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    items: (data ?? []).map((x) => mapChecklistRow(x as Record<string, unknown>)),
  };
}

async function assertTripOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("owner_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** Insert template checklist if the trip has no rows yet. */
export async function seedTripChecklistIfEmptyAction(input: {
  tripId: string;
  regionId: string;
  startDate: string;
  children: number;
  hasCruise: boolean;
}): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  if (!(await assertTripOwner(supabase, input.tripId, user.id))) {
    return { ok: false, error: "Trip not found." };
  }
  const { count, error: cErr } = await supabase
    .from("trip_checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", input.tripId);
  if (cErr) return { ok: false, error: cErr.message };
  if ((count ?? 0) > 0) return { ok: true, inserted: 0 };
  const templates = generateChecklist({
    regionId: input.regionId,
    startDate: input.startDate,
    children: input.children,
    includesCruise: input.hasCruise,
  });
  const rows = templates.map((t, i) => ({
    trip_id: input.tripId,
    category: t.category,
    label: t.label,
    is_checked: false,
    is_custom: false,
    sort_order: i,
  }));
  const { error } = await supabase.from("trip_checklist_items").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true, inserted: rows.length };
}

export async function insertTripChecklistItemAction(input: {
  tripId: string;
  category: ChecklistCategory;
  label: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  if (!(await assertTripOwner(supabase, input.tripId, user.id))) {
    return { ok: false, error: "Trip not found." };
  }
  const { data: maxRow } = await supabase
    .from("trip_checklist_items")
    .select("sort_order")
    .eq("trip_id", input.tripId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order as number | undefined ?? -1) + 1;
  const { data, error } = await supabase
    .from("trip_checklist_items")
    .insert({
      trip_id: input.tripId,
      category: input.category,
      label: input.label.trim(),
      is_checked: false,
      is_custom: true,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  revalidatePlanner();
  return { ok: true, id: String(data.id) };
}

export async function updateTripChecklistItemCheckedAction(input: {
  itemId: string;
  tripId: string;
  isChecked: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_checklist_items")
    .update({ is_checked: input.isChecked })
    .eq("id", input.itemId)
    .eq("trip_id", input.tripId);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}

export async function deleteTripChecklistItemAction(input: {
  itemId: string;
  tripId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_checklist_items")
    .delete()
    .eq("id", input.itemId)
    .eq("trip_id", input.tripId);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}

/** Remove auto-generated rows and re-seed from template; keeps custom rows. */
export async function resetTripChecklistTemplateAction(input: {
  tripId: string;
  regionId: string;
  startDate: string;
  children: number;
  hasCruise: boolean;
}): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  if (!(await assertTripOwner(supabase, input.tripId, user.id))) {
    return { ok: false, error: "Trip not found." };
  }
  const { error: delErr } = await supabase
    .from("trip_checklist_items")
    .delete()
    .eq("trip_id", input.tripId)
    .eq("is_custom", false);
  if (delErr) return { ok: false, error: delErr.message };
  const { data: maxRow } = await supabase
    .from("trip_checklist_items")
    .select("sort_order")
    .eq("trip_id", input.tripId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const baseOrder = (maxRow?.sort_order as number | undefined ?? -1) + 1;
  const templates = generateChecklist({
    regionId: input.regionId,
    startDate: input.startDate,
    children: input.children,
    includesCruise: input.hasCruise,
  });
  const rows = templates.map((t, i) => ({
    trip_id: input.tripId,
    category: t.category,
    label: t.label,
    is_checked: false,
    is_custom: false,
    sort_order: baseOrder + i,
  }));
  if (rows.length === 0) {
    revalidatePlanner();
    return { ok: true, inserted: 0 };
  }
  const { error } = await supabase.from("trip_checklist_items").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true, inserted: rows.length };
}
