/** Unique violation on stripe_webhook_events.id means Stripe retried the event. */
export function classifyWebhookInsertError(
  code: string | undefined,
): "duplicate" | "failed" | null {
  if (!code) return null;
  if (code === "23505") return "duplicate";
  return "failed";
}
