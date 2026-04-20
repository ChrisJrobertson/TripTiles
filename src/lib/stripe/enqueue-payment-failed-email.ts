import type { SupabaseClient } from "@supabase/supabase-js";

/** Queues a payment-failed notice (deduped per user within 48h). */
export async function enqueueSubscriptionPaymentFailedEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { count, error: cErr } = await admin
    .from("email_queue")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("template", "subscription_payment_failed")
    .gte("created_at", since);
  if (cErr) {
    console.error("[stripe] payment-failed email dedupe", cErr);
    return;
  }
  if ((count ?? 0) > 0) return;

  const { error } = await admin.from("email_queue").insert({
    user_id: userId,
    trip_id: null,
    template: "subscription_payment_failed",
    scheduled_for: new Date().toISOString(),
    status: "pending",
  });
  if (error) console.error("[stripe] enqueue payment_failed email", error);
}
