// Required env vars (set in Vercel Production + Preview):
//   STRIPE_PRICE_PRO_MONTHLY = price_1TNXd2JBjlYCYeTT9PhzJAgj (£6.99/mo)
//   STRIPE_PRICE_PRO_ANNUAL = price_1TNXd8JBjlYCYeTT6cssGWp8 (£39.00/yr)
//   STRIPE_PRICE_FAMILY_MONTHLY = price_1TNXctJBjlYCYeTTQDbM2ZEp (£11.99/mo)
//   STRIPE_PRICE_FAMILY_ANNUAL = price_1TNXcxJBjlYCYeTT6oZzKdHN (£69.00/yr)

export type PaidTier = "pro" | "family";
export type BillingInterval = "month" | "year";

export const PRICE_IDS = {
  pro_month: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_year: process.env.STRIPE_PRICE_PRO_ANNUAL!,
  family_month: process.env.STRIPE_PRICE_FAMILY_MONTHLY!,
  family_year: process.env.STRIPE_PRICE_FAMILY_ANNUAL!,
} as const;

export function allowedCheckoutPriceIds(): string[] {
  return Object.values(PRICE_IDS).filter((x): x is string => Boolean(x?.trim()));
}

export function priceIdToTier(
  priceId: string,
): { tier: PaidTier; interval: BillingInterval } | null {
  if (priceId === PRICE_IDS.pro_month)
    return { tier: "pro", interval: "month" };
  if (priceId === PRICE_IDS.pro_year) return { tier: "pro", interval: "year" };
  if (priceId === PRICE_IDS.family_month)
    return { tier: "family", interval: "month" };
  if (priceId === PRICE_IDS.family_year)
    return { tier: "family", interval: "year" };
  return null;
}

export function tierToPriceId(
  tier: PaidTier,
  interval: BillingInterval,
): string {
  const key = `${tier}_${interval}` as keyof typeof PRICE_IDS;
  return PRICE_IDS[key];
}
