/** Stripe price id from env — accepts server-only or NEXT_PUBLIC names (Vercel / local). */
export function stripePriceIdFromEnv(
  tier: "PRO" | "FAMILY",
  interval: "MONTHLY" | "ANNUAL",
): string {
  const key = `${tier}_${interval}`;
  return (
    process.env[`NEXT_PUBLIC_STRIPE_PRICE_${key}`]?.trim() ||
    process.env[`STRIPE_PRICE_${key}`]?.trim() ||
    ""
  );
}
