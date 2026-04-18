import type { UserTier } from "@/lib/types";

/**
 * @deprecated Use `getUserTier` from `src/lib/tier.ts` instead.
 * This module is kept for backwards compatibility with pre-Stripe
 * code paths and will be removed once all call sites are migrated.
 * Do not add new imports.
 */

/** Aligned with `profiles.tier` / product spec. */
export type Tier = UserTier;

export interface TierConfig {
  id: Tier;
  name: string;
  price_gbp: number;
  price_pence: number;
  description: string;
  payhip_url: string | null;
  features: {
    max_trips: number | null;
    max_ai_per_trip: number | null;
    max_custom_tiles: number | null;
    pdf_watermark: boolean;
    pdf_design: "standard" | "premium";
    /** Anthropic API model id */
    ai_model: "claude-haiku-4-5" | "claude-sonnet-4-6";
    family_sharing: boolean;
    priority_support: boolean;
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

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    id: "free",
    name: "Day Tripper",
    price_gbp: 0,
    price_pence: 0,
    description: "Plan your first adventure",
    payhip_url: null,
    features: {
      max_trips: 1,
      max_ai_per_trip: 0,
      max_custom_tiles: 5,
      pdf_watermark: true,
      pdf_design: "standard",
      ai_model: "claude-haiku-4-5",
      family_sharing: false,
      priority_support: false,
    },
    badge_emoji: "✈️",
    achievement_key: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_gbp: 24.99,
    price_pence: 2499,
    description: "Plan unlimited holidays, forever",
    payhip_url: envPayhipUrl("pro"),
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "standard",
      ai_model: "claude-haiku-4-5",
      family_sharing: false,
      priority_support: false,
    },
    badge_emoji: "⭐",
    achievement_key: "upgraded_pro",
  },
  family: {
    id: "family",
    name: "Family",
    price_gbp: 39.99,
    price_pence: 3999,
    description: "Plan together with the whole family",
    payhip_url: envPayhipUrl("family"),
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "standard",
      ai_model: "claude-haiku-4-5",
      family_sharing: true,
      priority_support: false,
    },
    badge_emoji: "👨‍👩‍👧‍👦",
    achievement_key: "upgraded_family",
  },
  premium: {
    id: "premium",
    name: "Premium",
    price_gbp: 59.99,
    price_pence: 5999,
    description: "The richest Smart Plan experience and premium extras",
    payhip_url: envPayhipUrl("premium"),
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "premium",
      ai_model: "claude-sonnet-4-6",
      family_sharing: true,
      priority_support: true,
    },
    badge_emoji: "💎",
    achievement_key: "upgraded_premium",
  },
  concierge: {
    id: "concierge",
    name: "Concierge",
    price_gbp: 0,
    price_pence: 0,
    description: "White-glove service",
    payhip_url: null,
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "premium",
      ai_model: "claude-sonnet-4-6",
      family_sharing: true,
      priority_support: true,
    },
    badge_emoji: "🎩",
    achievement_key: null,
  },
  agent_staff: {
    id: "agent_staff",
    name: "Agency Staff",
    price_gbp: 0,
    price_pence: 0,
    description: "Travel agent staff account",
    payhip_url: null,
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "premium",
      ai_model: "claude-haiku-4-5",
      family_sharing: true,
      priority_support: false,
    },
    badge_emoji: "🏢",
    achievement_key: null,
  },
  agent_admin: {
    id: "agent_admin",
    name: "Agency Admin",
    price_gbp: 0,
    price_pence: 0,
    description: "Travel agent admin account",
    payhip_url: null,
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      max_custom_tiles: null,
      pdf_watermark: false,
      pdf_design: "premium",
      ai_model: "claude-sonnet-4-6",
      family_sharing: true,
      priority_support: true,
    },
    badge_emoji: "🏢",
    achievement_key: null,
  },
};

export function getTierConfig(tier: Tier): TierConfig {
  return TIERS[tier] ?? TIERS.free;
}

export function isPaidTier(tier: Tier): boolean {
  return tier !== "free";
}

export const PUBLIC_TIERS: Tier[] = ["free", "pro", "family", "premium"];

/** Paid tier ordering for upgrades (excludes internal roles). */
const PAID_TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  family: 2,
  premium: 3,
};

/** Internal / agency tiers treated as already above retail paid tiers for comparisons. */
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
  purchasedTier: Tier,
): boolean {
  return tierUpgradeRank(purchasedTier) > tierUpgradeRank(currentTier);
}
