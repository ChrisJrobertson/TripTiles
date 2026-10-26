/**
 * Whether a Stripe subscription status may change profiles.tier.
 * past_due and unpaid stay unchanged when the webhook marks a grace period.
 * canceled is cleaned up by the subscription.deleted handler, not here.
 */
export function profileTierActionForSubscription(input: {
  status: string;
  profileGracePeriod?: boolean;
}): "set_paid_tier" | "leave_unchanged" {
  if (input.profileGracePeriod) return "leave_unchanged";
  if (input.status === "canceled") return "leave_unchanged";
  if (
    input.status === "unpaid" ||
    input.status === "incomplete" ||
    input.status === "incomplete_expired"
  ) {
    return "leave_unchanged";
  }
  if (
    input.status === "active" ||
    input.status === "trialing" ||
    input.status === "past_due"
  ) {
    return "set_paid_tier";
  }
  return "leave_unchanged";
}
