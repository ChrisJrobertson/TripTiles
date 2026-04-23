// Required env vars (set in Vercel Production + Preview) — map to live Stripe GBP prices:
//   STRIPE_PRICE_PRO_MONTHLY (£4.99/mo), STRIPE_PRICE_PRO_ANNUAL (£39.99/yr)
//   STRIPE_PRICE_FAMILY_MONTHLY (£7.99/mo), STRIPE_PRICE_FAMILY_ANNUAL (£59.99/yr)

import type { UserTier } from "@/lib/types";

/** Live Stripe product ids → `purchases.product` / profile tier. Price ids remain the primary checkout guard via `PRICE_IDS`. */
export const STRIPE_PRODUCT_TO_TIER = {
  prod_UMG8DuAxg7rVaI: "pro",
  prod_UMG8hT1OMb3Whc: "family",
} as const;

export type ProductSkuFromStripe =
  (typeof STRIPE_PRODUCT_TO_TIER)[keyof typeof STRIPE_PRODUCT_TO_TIER];

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

/** Maps Stripe product id, then price id, to a `purchases.product` value (must satisfy DB check). */
export function mapStripeIdsToProductSku(
  stripeProductId: string | null,
  priceId: string | null,
): ProductSkuFromStripe | "premium" | "concierge" | null {
  if (stripeProductId && stripeProductId in STRIPE_PRODUCT_TO_TIER) {
    return STRIPE_PRODUCT_TO_TIER[
      stripeProductId as keyof typeof STRIPE_PRODUCT_TO_TIER
    ];
  }
  if (priceId) {
    const m = priceIdToTier(priceId);
    if (m) return m.tier;
  }
  return null;
}

export function productSkuToProfileTier(
  sku: ProductSkuFromStripe | "premium" | "concierge",
): UserTier {
  if (sku === "premium" || sku === "concierge") return sku;
  if (sku === "pro" || sku === "family") return sku;
  return "free";
}

export function tierToPriceId(
  tier: PaidTier,
  interval: BillingInterval,
): string {
  const key = `${tier}_${interval}` as keyof typeof PRICE_IDS;
  return PRICE_IDS[key];
}
