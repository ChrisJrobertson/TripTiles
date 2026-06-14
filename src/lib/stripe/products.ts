// Price IDs: set STRIPE_PRICE_* (server) or NEXT_PUBLIC_STRIPE_PRICE_* (client checkout).
//   PRO_MONTHLY (£6.99/mo), PRO_ANNUAL (£39/yr)
//   FAMILY_MONTHLY (£11.99/mo), FAMILY_ANNUAL (£99/yr)

import { stripePriceIdFromEnv } from "@/lib/stripe/price-env";
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
  pro_month: stripePriceIdFromEnv("PRO", "MONTHLY"),
  pro_year: stripePriceIdFromEnv("PRO", "ANNUAL"),
  family_month: stripePriceIdFromEnv("FAMILY", "MONTHLY"),
  family_year: stripePriceIdFromEnv("FAMILY", "ANNUAL"),
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
): ProductSkuFromStripe | "concierge" | null {
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
  sku: ProductSkuFromStripe | "concierge",
): UserTier {
  if (sku === "concierge") return sku;
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
