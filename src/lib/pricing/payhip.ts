/**
 * Payhip checkout URLs — set in `.env.local` to match products you created on Payhip.
 * @see https://payhip.com — paste each product’s “Buy” / checkout link.
 */

export type PayhipPlanKey = "pro" | "family" | "premium";

const ENV_KEYS: Record<PayhipPlanKey, string> = {
  pro: "NEXT_PUBLIC_PAYHIP_PRO_URL",
  family: "NEXT_PUBLIC_PAYHIP_FAMILY_URL",
  premium: "NEXT_PUBLIC_PAYHIP_PREMIUM_URL",
};

export function getPayhipCheckoutUrl(plan: PayhipPlanKey): string | null {
  const env = process.env;
  if (plan === "pro") {
    const u = env.NEXT_PUBLIC_PAYHIP_PRO_URL?.trim();
    return u || null;
  }
  if (plan === "family") {
    const u = env.NEXT_PUBLIC_PAYHIP_FAMILY_URL?.trim();
    return u || null;
  }
  const u = env.NEXT_PUBLIC_PAYHIP_PREMIUM_URL?.trim();
  return u || null;
}

export function getAllPayhipCheckoutUrls(): Record<PayhipPlanKey, string | null> {
  return {
    pro: getPayhipCheckoutUrl("pro"),
    family: getPayhipCheckoutUrl("family"),
    premium: getPayhipCheckoutUrl("premium"),
  };
}

/** True if at least one public checkout URL is configured. */
export function hasPayhipCheckoutConfigured(): boolean {
  return Object.values(getAllPayhipCheckoutUrls()).some(Boolean);
}

export function payhipEnvKeyForPlan(plan: PayhipPlanKey): string {
  return ENV_KEYS[plan];
}
