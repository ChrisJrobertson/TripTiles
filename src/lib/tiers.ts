import type { UserTier } from "@/lib/types";

/** Retail tiers shown in product UI (maps from legacy `profiles.tier` values). */
export type RetailTier = "free" | "pro" | "family";

/** @deprecated Prefer `RetailTier`; kept for Payhip and legacy call sites. */
export type Tier = UserTier;

export interface TierConfig {
  id: RetailTier;
  name: string;
  price_gbp: number;
  price_pence: number;
  description: string;
  payhip_url: string | null;
  features: {
    max_trips: number | null;
    /** @deprecated Display only; Smart Plan limits use `max_smart_plan_lifetime`. */
    max_ai_per_trip: number | null;
    max_smart_plan_lifetime: number | null;
    max_custom_tiles: number | null;
    pdf_watermark: boolean;
    pdf_design: "standard" | "premium";
    ai_model: "claude-haiku-4-5" | "claude-sonnet-4-6";
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

function envPayhipUrl(key: "pro" | "family" | "premium"): string | null {
  const env = process.env;
  const u =
    key === "pro"
      ? env.NEXT_PUBLIC_PAYHIP_PRO_URL
      : key === "family"
        ? env.NEXT_PUBLIC_PAYHIP_FAMILY_URL
        : env.NEXT_PUBLIC_PAYHIP_PREMIUM_URL;
  const t = u?.trim();
  return t || null;
}

export const TIERS: Record<RetailTier, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    price_gbp: 0,
    price_pence: 0,
    description: "Plan one trip and try Smart Plan",
    payhip_url: null,
    features: {
      max_trips: 1,
      max_ai_per_trip: 3,
      max_smart_plan_lifetime: 3,
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
    price_gbp: 6.99,
    price_pence: 699,
    description: "Unlimited trips, full Smart Plan, clean PDFs",
    payhip_url: envPayhipUrl("pro"),
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
    price_gbp: 11.99,
    price_pence: 1199,
    description: "Everything in Pro, plus share with up to four family members",
    payhip_url: envPayhipUrl("family"),
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

/** Maps legacy DB / Stripe labels to a retail tier key. */
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
  const t = (tier ?? "free").toLowerCase();
  if (t === "premium") {
    return {
      ...TIERS.family,
      id: "family",
      name: "Premium",
      price_gbp: 59.99,
      price_pence: 5999,
      description: "Grandfathered Premium access",
      payhip_url: envPayhipUrl("premium"),
      features: {
        ...TIERS.family.features,
        pdf_design: "premium",
        ai_model: "claude-sonnet-4-6",
      },
      badge_emoji: "💎",
      achievement_key: "upgraded_premium",
    };
  }
  return TIERS[normalizeToRetailTier(tier)];
}

export function isPaidRetailTier(tier: RetailTier): boolean {
  return tier !== "free";
}

export function isPaidTier(tier: UserTier): boolean {
  return tier !== "free";
}

const PAID_TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  family: 2,
  premium: 2,
};

const INTERNAL_TIER_RANK: Record<string, number> = {
  concierge: 100,
  agent_staff: 100,
  agent_admin: 100,
};

export function tierUpgradeRank(tier: string | null | undefined): number {
  const t = tier ?? "free";
  if (t in INTERNAL_TIER_RANK) return INTERNAL_TIER_RANK[t];
  return PAID_TIER_RANK[t] ?? 0;
}

export function shouldUpgradeTier(
  currentTier: string | null | undefined,
  purchasedTier: UserTier,
): boolean {
  return tierUpgradeRank(purchasedTier) > tierUpgradeRank(currentTier);
}
