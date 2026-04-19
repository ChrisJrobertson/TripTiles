// Required env vars (set in Vercel Production + Preview):
//   STRIPE_PRICE_PRO_MONTHLY
//   STRIPE_PRICE_PRO_ANNUAL
//   STRIPE_PRICE_FAMILY_MONTHLY
//   STRIPE_PRICE_FAMILY_ANNUAL
//
// All four created manually in Stripe Live mode:
//   TripTiles Pro (Monthly)    — £6.99/mo recurring
//   TripTiles Pro (Annual)     — £39.99/yr recurring
//   TripTiles Family (Monthly) — £11.99/mo recurring
//   TripTiles Family (Annual)  — £69.99/yr recurring

export type PaidTier = "pro" | "family";
export type BillingInterval = "month" | "year";

type PriceIds = {
  pro_month: string;
  pro_year: string;
  family_month: string;
  family_year: string;
};

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

function getPriceIds(): PriceIds | null {
  const proMonth = readEnv("STRIPE_PRICE_PRO_MONTHLY");
  const proYear = readEnv("STRIPE_PRICE_PRO_ANNUAL");
  const familyMonth = readEnv("STRIPE_PRICE_FAMILY_MONTHLY");
  const familyYear = readEnv("STRIPE_PRICE_FAMILY_ANNUAL");
  if (!proMonth || !proYear || !familyMonth || !familyYear) return null;
  return {
    pro_month: proMonth,
    pro_year: proYear,
    family_month: familyMonth,
    family_year: familyYear,
  };
}

export function arePriceIdsConfigured(): boolean {
  return getPriceIds() != null;
}

export function configuredPriceIds(): string[] {
  const ids = getPriceIds();
  return ids ? Object.values(ids) : [];
}

export function priceIdToTier(
  priceId: string,
): { tier: PaidTier; interval: BillingInterval } | null {
  const ids = getPriceIds();
  if (!ids) return null;
  if (priceId === ids.pro_month) return { tier: "pro", interval: "month" };
  if (priceId === ids.pro_year) return { tier: "pro", interval: "year" };
  if (priceId === ids.family_month) {
    return { tier: "family", interval: "month" };
  }
  if (priceId === ids.family_year) {
    return { tier: "family", interval: "year" };
  }
  return null;
}

export function tierToPriceId(
  tier: PaidTier,
  interval: BillingInterval,
): string {
  const ids = getPriceIds();
  if (!ids) {
    throw new Error(
      "Stripe price IDs are not configured. Set STRIPE_PRICE_* environment variables.",
    );
  }
  const key = `${tier}_${interval}` as keyof PriceIds;
  return ids[key];
}
