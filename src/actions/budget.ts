"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { BudgetCategory, TripBudgetItem } from "@/lib/types";
import { revalidatePath } from "next/cache";

function revalidatePlanner() {
  revalidatePath("/planner");
}

function mapBudgetRow(r: Record<string, unknown>): TripBudgetItem {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    category: r.category as BudgetCategory,
    label: String(r.label ?? ""),
    amount: Number(r.amount ?? 0),
    currency: String(r.currency ?? "GBP"),
    is_paid: Boolean(r.is_paid),
    notes: r.notes != null ? String(r.notes) : null,
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function listTripBudgetItemsAction(
  tripId: string,
): Promise<
  { ok: true; items: TripBudgetItem[] } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_budget_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    items: (data ?? []).map((x) => mapBudgetRow(x as Record<string, unknown>)),
  };
}

export async function insertTripBudgetItemAction(input: {
  tripId: string;
  category: BudgetCategory;
  label: string;
  amount: number;
  notes?: string | null;
  isPaid?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("budget_currency")
    .eq("id", input.tripId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!trip) return { ok: false, error: "Trip not found." };
  const currency = String(trip.budget_currency ?? "GBP");
  const { data: maxRow } = await supabase
    .from("trip_budget_items")
    .select("sort_order")
    .eq("trip_id", input.tripId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order as number | undefined ?? -1) + 1;
  const { data, error } = await supabase
    .from("trip_budget_items")
    .insert({
      trip_id: input.tripId,
      category: input.category,
      label: input.label.trim(),
      amount: Math.round(input.amount * 100) / 100,
      currency,
      is_paid: input.isPaid ?? false,
      notes: input.notes?.trim() || null,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  revalidatePlanner();
  return { ok: true, id: String(data.id) };
}

export async function updateTripBudgetItemAction(input: {
  itemId: string;
  tripId: string;
  category?: BudgetCategory;
  label?: string;
  amount?: number;
  notes?: string | null;
  isPaid?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.category !== undefined) body.category = input.category;
  if (input.label !== undefined) body.label = input.label.trim();
  if (input.amount !== undefined) body.amount = Math.round(input.amount * 100) / 100;
  if (input.notes !== undefined) body.notes = input.notes?.trim() || null;
  if (input.isPaid !== undefined) body.is_paid = input.isPaid;
  const { error } = await supabase
    .from("trip_budget_items")
    .update(body)
    .eq("id", input.itemId)
    .eq("trip_id", input.tripId);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}

export async function deleteTripBudgetItemAction(input: {
  itemId: string;
  tripId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("trip_budget_items")
    .delete()
    .eq("id", input.itemId)
    .eq("trip_id", input.tripId);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}

export async function updateTripBudgetSettingsAction(input: {
  tripId: string;
  budgetTarget: number | null;
  budgetCurrency: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({
      budget_target: input.budgetTarget,
      budget_currency: input.budgetCurrency.trim().toUpperCase() || "GBP",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.tripId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}
