import type { UserTier } from "@/lib/types";

/** Retail tiers shown in product UI (maps from legacy `profiles.tier` values). */
export type RetailTier = "free" | "pro" | "family";

/** @deprecated Prefer `RetailTier`; kept for legacy call sites. */
export type Tier = UserTier;

export interface TierConfig {
  id: RetailTier;
  name: string;
  /** One-off display price (legacy); prefer monthly/annual subscription fields. */
  price_gbp: number;
  price_pence: number;
  /** GBP/month when billed monthly (paid tiers). */
  monthlyGbp?: number;
  /** GBP/year when billed annually (paid tiers). */
  annualGbp?: number;
  /** Saving vs twelve monthly payments at the monthly rate. */
  annualSavingsVsMonthlyGbp?: number;
  description: string;
  features: {
    max_trips: number | null;
    /** @deprecated Display only; Smart Plan limits use `max_smart_plan_lifetime`. */
    max_ai_per_trip: number | null;
    max_smart_plan_lifetime: number | null;
    max_custom_tiles: number | null;
    pdf_watermark: boolean;
    pdf_design: "standard";
    ai_model: "claude-haiku-4-5";
    family_sharing: boolean;
    max_family_members: number;
    priority_support: boolean;
    ai_day_planner: boolean;
    max_ride_priorities_per_trip: number | null;
    max_payments_per_trip: number | null;
    public_share: boolean;
  };
  badge_emoji: string;
  achievement_key: string | null;
}

export const TIERS: Record<RetailTier, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    price_gbp: 0,
    price_pence: 0,
    description: "Plan one trip and try Smart Plan",
    features: {
      max_trips: 1,
      max_ai_per_trip: 5,
      max_smart_plan_lifetime: 5,
      max_custom_tiles: 5,
      pdf_watermark: true,
      pdf_design: "standard",
      ai_model: "claude-haiku-4-5",
      family_sharing: false,
      max_family_members: 0,
      priority_support: false,
      ai_day_planner: false,
      max_ride_priorities_per_trip: 5,
      max_payments_per_trip: 3,
      public_share: false,
    },
    badge_emoji: "✈️",
    achievement_key: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_gbp: 4.99,
    price_pence: 499,
    monthlyGbp: 4.99,
    annualGbp: 39.99,
    annualSavingsVsMonthlyGbp: 19.89,
    description: "Unlimited trips, full Smart Plan, clean PDFs",
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_smart_plan_lifetime: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "standard",
      ai_model: "claude-haiku-4-5",
      family_sharing: false,
      max_family_members: 0,
      priority_support: false,
      ai_day_planner: true,
      max_ride_priorities_per_trip: null,
      max_payments_per_trip: null,
      public_share: true,
    },
    badge_emoji: "⭐",
    achievement_key: "upgraded_pro",
  },
  family: {
    id: "family",
    name: "Family",
    price_gbp: 7.99,
    price_pence: 799,
    monthlyGbp: 7.99,
    annualGbp: 59.99,
    annualSavingsVsMonthlyGbp: 35.89,
    description: "Everything in Pro, plus share with up to four family members",
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_smart_plan_lifetime: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "standard",
      ai_model: "claude-haiku-4-5",
      family_sharing: true,
      max_family_members: 4,
      priority_support: false,
      ai_day_planner: true,
      max_ride_priorities_per_trip: null,
      max_payments_per_trip: null,
      public_share: true,
    },
    badge_emoji: "👨‍👩‍👧‍👦",
    achievement_key: "upgraded_family",
  },
};

export const PUBLIC_TIERS: RetailTier[] = ["free", "pro", "family"];

/** Maps legacy DB / Stripe labels to a retail tier key (`premium` → Family-tier entitlements). */
export function normalizeToRetailTier(tier: string | null | undefined): RetailTier {
  const t = (tier ?? "free").toLowerCase();
  if (t === "navigator" || t === "pro") return "pro";
  if (
    t === "captain" ||
    t === "family" ||
    t === "premium" ||
    t === "concierge" ||
    t === "agent_admin" ||
    t === "agent_staff"
  ) {
    return "family";
  }
  if (t === "day_tripper" || t === "free") return "free";
  return "free";
}

export type ProfileTierInput = {
  tier: string | null | undefined;
  tier_expires_at?: string | null;
};

/**
 * Effective paid/free tier for gating. If `tier_expires_at` is in the past,
 * the user is treated as free regardless of `profiles.tier`.
 */
export function getEffectiveRetailTier(profile: ProfileTierInput): RetailTier {
  const exp = profile.tier_expires_at;
  if (exp) {
    const end = new Date(exp).getTime();
    if (!Number.isNaN(end) && end <= Date.now()) {
      return "free";
    }
  }
  return normalizeToRetailTier(profile.tier);
}

export function getTierConfig(tier: string): TierConfig {
  return TIERS[normalizeToRetailTier(tier)];
}

/** Next renewal amount copy for Stripe subscription rows (GBP). */
export function renewalPriceLabelGbp(
  product: string | null | undefined,
  billingInterval: string | null | undefined,
): string | null {
  const rt = normalizeToRetailTier(product ?? "free");
  if (rt === "free") return null;
  const cfg = TIERS[rt];
  const interval = billingInterval === "year" ? "year" : "month";
  if (interval === "year" && cfg.annualGbp != null) {
    return `£${cfg.annualGbp.toFixed(2)}/year`;
  }
  if (cfg.monthlyGbp != null) {
    return `£${cfg.monthlyGbp.toFixed(2)}/month`;
  }
  return null;
}

export function isPaidRetailTier(tier: RetailTier): boolean {
  return tier !== "free";
}

export function isPaidTier(tier: UserTier): boolean {
  return tier !== "free";
}

const PAID_TIER_RANK: Record<RetailTier, number> = {
  free: 0,
  pro: 1,
  family: 2,
};

const INTERNAL_TIER_RANK: Record<string, number> = {
  concierge: 100,
  agent_staff: 100,
  agent_admin: 100,
};

export function tierUpgradeRank(tier: string | null | undefined): number {
  const t = tier ?? "free";
  if (t in INTERNAL_TIER_RANK) return INTERNAL_TIER_RANK[t]!;
  return PAID_TIER_RANK[normalizeToRetailTier(t)] ?? 0;
}

export function shouldUpgradeTier(
  currentTier: string | null | undefined,
  purchasedTier: UserTier,
): boolean {
  return tierUpgradeRank(purchasedTier) > tierUpgradeRank(currentTier);
}
