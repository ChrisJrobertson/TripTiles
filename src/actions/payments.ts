"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { currentUserCanCreatePayment } from "@/lib/entitlements";
import type { PaymentCurrency, TripPayment } from "@/types/payments";
import { revalidatePath } from "next/cache";

function revalidatePlanner() {
  revalidatePath("/planner");
}

function mapPaymentRow(r: Record<string, unknown>): TripPayment {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    label: String(r.label ?? ""),
    amount_pence: Number(r.amount_pence ?? 0),
    currency: (r.currency === "USD" ? "USD" : "GBP") as PaymentCurrency,
    booking_date: r.booking_date != null ? String(r.booking_date) : null,
    due_date: r.due_date != null ? String(r.due_date) : null,
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function sortPaymentsList(items: TripPayment[]): TripPayment[] {
  return [...items].sort((a, b) => {
    const da = a.due_date;
    const db = b.due_date;
    if (da == null && db == null) return a.sort_order - b.sort_order;
    if (da == null) return 1;
    if (db == null) return -1;
    if (da < db) return -1;
    if (da > db) return 1;
    return a.sort_order - b.sort_order;
  });
}

function normaliseOptionalDate(
  v: string | null | undefined,
): string | null | undefined {
  if (v === undefined) return undefined;
  if (v == null || v.trim() === "") return null;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return s;
}

function validateLabel(label: string): string | null {
  const t = label.trim();
  if (t.length < 1 || t.length > 120) return "Label must be between 1 and 120 characters.";
  return null;
}

export async function getPaymentsForTrip(tripId: string): Promise<TripPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_payments")
    .select("*")
    .eq("trip_id", tripId);
  if (error) throw new Error(error.message);
  return sortPaymentsList(
    (data ?? []).map((x) => mapPaymentRow(x as Record<string, unknown>)),
  );
}

export async function getPaymentsForTripIds(
  tripIds: string[],
): Promise<TripPayment[]> {
  if (tripIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_payments")
    .select("*")
    .in("trip_id", tripIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => mapPaymentRow(x as Record<string, unknown>));
}

export async function createPayment(input: {
  tripId: string;
  label: string;
  amountPence: number;
  currency: PaymentCurrency;
  bookingDate?: string | null;
  dueDate?: string | null;
}): Promise<
  { ok: true; payment: TripPayment } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const allowed = await currentUserCanCreatePayment(input.tripId);
  if (!allowed) {
    return {
      ok: false,
      error: "Free tier limit reached. Upgrade to track unlimited payments.",
    };
  }

  const labelErr = validateLabel(input.label);
  if (labelErr) return { ok: false, error: labelErr };

  if (!Number.isFinite(input.amountPence) || input.amountPence < 0) {
    return { ok: false, error: "Amount must be zero or greater." };
  }
  const amountPence = Math.round(input.amountPence);
  if (input.currency !== "GBP" && input.currency !== "USD") {
    return { ok: false, error: "Currency must be GBP or USD." };
  }

  const bookingDate = normaliseOptionalDate(input.bookingDate ?? null);
  const dueDate = normaliseOptionalDate(input.dueDate ?? null);
  if (bookingDate === undefined) {
    return { ok: false, error: "Invalid booking date." };
  }
  if (dueDate === undefined) {
    return { ok: false, error: "Invalid due date." };
  }

  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("trip_payments")
    .select("sort_order")
    .eq("trip_id", input.tripId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = Number(maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("trip_payments")
    .insert({
      trip_id: input.tripId,
      label: input.label.trim(),
      amount_pence: amountPence,
      currency: input.currency,
      booking_date: bookingDate,
      due_date: dueDate,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create payment." };
  }
  revalidatePlanner();
  return { ok: true, payment: mapPaymentRow(data as Record<string, unknown>) };
}

export type TripPaymentPatch = {
  label?: string;
  amountPence?: number;
  currency?: PaymentCurrency;
  bookingDate?: string | null;
  dueDate?: string | null;
};

export async function updatePayment(
  paymentId: string,
  patch: TripPaymentPatch,
): Promise<{ ok: true; payment: TripPayment } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.label !== undefined) {
    const labelErr = validateLabel(patch.label);
    if (labelErr) return { ok: false, error: labelErr };
    body.label = patch.label.trim();
  }
  if (patch.amountPence !== undefined) {
    if (!Number.isFinite(patch.amountPence) || patch.amountPence < 0) {
      return { ok: false, error: "Amount must be zero or greater." };
    }
    body.amount_pence = Math.round(patch.amountPence);
  }
  if (patch.currency !== undefined) {
    if (patch.currency !== "GBP" && patch.currency !== "USD") {
      return { ok: false, error: "Currency must be GBP or USD." };
    }
    body.currency = patch.currency;
  }
  if (patch.bookingDate !== undefined) {
    const bd = normaliseOptionalDate(patch.bookingDate);
    if (bd === undefined) return { ok: false, error: "Invalid booking date." };
    body.booking_date = bd;
  }
  if (patch.dueDate !== undefined) {
    const dd = normaliseOptionalDate(patch.dueDate);
    if (dd === undefined) return { ok: false, error: "Invalid due date." };
    body.due_date = dd;
  }

  if (Object.keys(body).length <= 1) {
    return { ok: false, error: "Nothing to update." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_payments")
    .update(body)
    .eq("id", paymentId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Payment not found or not permitted." };
  revalidatePlanner();
  return { ok: true, payment: mapPaymentRow(data as Record<string, unknown>) };
}

export async function deletePayment(
  paymentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase.from("trip_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  revalidatePlanner();
  return { ok: true };
}

export async function reorderPayments(
  tripId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i]!;
    const { error } = await supabase
      .from("trip_payments")
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("trip_id", tripId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePlanner();
  return { ok: true };
}
