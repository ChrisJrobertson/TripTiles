import type { UserTier } from "@/lib/types";

/** Retail tiers shown in product UI (maps from legacy `profiles.tier` values). */
export type RetailTier = "free" | "pro" | "family";

/** @deprecated Prefer `RetailTier`; kept for legacy call sites. */
export type Tier = UserTier;

/** Documented per-call model labels; runtime selection in `src/actions/ai.ts` is authoritative. */
export type TierAIModels = {
  main_plan: string;
  day_timeline: string;
  must_dos: string;
};

export interface TierFeatures {
  max_trips: number | null;
  /** @deprecated Display only; Smart Plan limits use `max_smart_plan_runs`. */
  max_ai_per_trip: number | null;
  maxSmartPlanRuns: number | null;
  max_custom_tiles: number | null;
  pdf_watermark: boolean;
  pdf_design: "standard";
  // Per-call model assignments. Runtime selection in src/actions/ai.ts is the source of truth
  // for what the API actually invokes; this object documents what each tier should expect.
  ai_models: TierAIModels;
  family_sharing: boolean;
  max_family_members: number;
  priority_support: boolean;
  ai_day_planner: boolean;
  max_ride_priorities_per_trip: number | null;
  max_payments_per_trip: number | null;
  public_share: boolean;
}

interface TierConfigBase {
  id: RetailTier;
  name: string;
  displayPrice: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  stripePriceIds: {
    monthly: string | null;
    annual: string | null;
  };
  aiModel: "claude-haiku-4-5-20251001";
  /** Legacy numeric fields kept for existing display code. */
  price_gbp: number;
  price_pence: number;
  description: string;
  features: TierFeatures;
  badge_emoji: string;
  achievement_key: string | null;
}

/** Retail tier config. Paid tiers always include GBP subscription list prices. */
export type TierConfig =
  | (TierConfigBase & { id: "free" })
  | (TierConfigBase & {
      id: "pro";
      monthlyGbp: number;
      annualGbp: number;
      annualSavingsVsMonthlyGbp: number;
    })
  | (TierConfigBase & {
      id: "family";
      monthlyGbp: number;
      annualGbp: number;
      annualSavingsVsMonthlyGbp: number;
    });

export type FreeTierConfig = Extract<TierConfig, { id: "free" }>;
export type ProTierConfig = Extract<TierConfig, { id: "pro" }>;
export type FamilyTierConfig = Extract<TierConfig, { id: "family" }>;

const freeTier: FreeTierConfig = {
  id: "free",
  name: "Free",
  displayPrice: "Free",
  monthlyPrice: null,
  annualPrice: null,
  stripePriceIds: { monthly: null, annual: null },
  aiModel: "claude-haiku-4-5-20251001",
  price_gbp: 0,
  price_pence: 0,
  description: "Plan one trip and try Smart Plan",
  features: {
    max_trips: 1,
    max_ai_per_trip: 5,
    maxSmartPlanRuns: 5,
    max_custom_tiles: 5,
    pdf_watermark: true,
    pdf_design: "standard",
    ai_models: {
      main_plan: "Haiku 4.5",
      day_timeline: "Haiku 4.5",
      must_dos: "Haiku 4.5",
    },
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
};

const proTier: ProTierConfig = {
  id: "pro",
  name: "Pro",
  displayPrice: "£6.99/mo or £39/yr",
  monthlyPrice: 699,
  annualPrice: 3900,
  stripePriceIds: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!,
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL!,
  },
  aiModel: "claude-haiku-4-5-20251001",
  price_gbp: 6.99,
  price_pence: 699,
  monthlyGbp: 6.99,
  annualGbp: 39,
  annualSavingsVsMonthlyGbp: 44.88,
  description: "Unlimited trips, full Smart Plan, clean PDFs",
  features: {
    max_trips: null,
    max_ai_per_trip: null,
    maxSmartPlanRuns: null,
    max_custom_tiles: null,
    pdf_watermark: false,
    pdf_design: "standard",
    ai_models: {
      main_plan: "Haiku 4.5",
      day_timeline: "Sonnet 4.6",
      must_dos: "Sonnet 4.6",
    },
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
};

const familyTier: FamilyTierConfig = {
  id: "family",
  name: "Family",
  displayPrice: "£11.99/mo or £99/yr",
  monthlyPrice: 1199,
  annualPrice: 9900,
  stripePriceIds: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY!,
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL!,
  },
  aiModel: "claude-haiku-4-5-20251001",
  price_gbp: 11.99,
  price_pence: 1199,
  monthlyGbp: 11.99,
  annualGbp: 99,
  annualSavingsVsMonthlyGbp: 44.88,
  description: "Everything in Pro, plus share with up to four family members",
  features: {
    max_trips: null,
    max_ai_per_trip: null,
    maxSmartPlanRuns: null,
    max_custom_tiles: null,
    pdf_watermark: false,
    pdf_design: "standard",
    ai_models: {
      main_plan: "Haiku 4.5",
      day_timeline: "Sonnet 4.6",
      must_dos: "Sonnet 4.6",
    },
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
};

export const TIERS = {
  free: freeTier,
  pro: proTier,
  family: familyTier,
} satisfies Record<RetailTier, TierConfig>;

export const PUBLIC_TIERS: RetailTier[] = ["free", "pro", "family"];

/** Maps DB / Stripe labels to a retail tier key; internal staff tiers receive Family-tier entitlements. */
export function normalizeToRetailTier(tier: string | null | undefined): RetailTier {
  const t = (tier ?? "free").toLowerCase();
  if (t === "pro") return "pro";
  if (
    t === "family" ||
    t === "premium" ||
    t === "concierge" ||
    t === "agent_admin" ||
    t === "agent_staff"
  ) {
    return "family";
  }
  if (t === "free") return "free";
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

export function canRetailTierPublishPublic(tier: string): boolean {
  return getTierConfig(tier).features.public_share;
}

/** Next renewal amount copy for Stripe subscription rows (GBP). */
export function renewalPriceLabelGbp(
  product: string | null | undefined,
  billingInterval: string | null | undefined,
): string | null {
  const rt = normalizeToRetailTier(product ?? "free");
  const cfg = TIERS[rt];
  if (cfg.id === "free") return null;
  const interval = billingInterval === "year" ? "year" : "month";
  if (interval === "year") {
    return `£${cfg.annualGbp.toFixed(2)}/year`;
  }
  return `£${cfg.monthlyGbp.toFixed(2)}/month`;
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
