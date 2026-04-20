/** Pure labels for product tiers — safe for Client Components. */
export type ProductTier = "free" | "pro" | "family";

export function formatProductTierName(tier: ProductTier): string {
  if (tier === "free") return "Free";
  if (tier === "pro") return "Pro";
  return "Family";
}
