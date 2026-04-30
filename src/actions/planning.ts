"use server";

import { mapPaymentRow } from "@/lib/trip-payment-row";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { TripPayment } from "@/types/payments";
import { revalidatePath } from "next/cache";

export async function markPaymentPaid(
  paymentId: string,
): Promise<{ ok: true; payment: TripPayment } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("trip_payments")
    .update({ paid_at: now, updated_at: now })
    .eq("id", paymentId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Payment not found or not permitted." };

  revalidatePath("/planner");
  return { ok: true, payment: mapPaymentRow(data as Record<string, unknown>) };
}

export async function markPaymentUnpaid(
  paymentId: string,
): Promise<{ ok: true; payment: TripPayment } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("trip_payments")
    .update({ paid_at: null, updated_at: now })
    .eq("id", paymentId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Payment not found or not permitted." };

  revalidatePath("/planner");
  return { ok: true, payment: mapPaymentRow(data as Record<string, unknown>) };
}
