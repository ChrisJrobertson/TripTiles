/** Pure labels for Stripe product tiers — safe for Client Components. */
export type ProductTier = "day_tripper" | "navigator" | "captain";

export function formatProductTierName(tier: ProductTier): string {
  if (tier === "day_tripper") return "Day Tripper";
  if (tier === "navigator") return "Navigator";
  return "Captain";
}
