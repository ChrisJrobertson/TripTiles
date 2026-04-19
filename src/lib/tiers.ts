export type PublicTier = "free" | "pro" | "family";

export type TierConfig = {
  key: PublicTier;
  name: string;
  displayName: string;
  price_gbp: number;
  monthlyPriceGbp: number | null;
  annualPriceGbp: number | null;
  features: {
    max_trips: number | null;
    max_ai_per_trip: number | null;
    family_sharing: boolean;
    pdf_watermark: boolean;
    pdf_design: "standard" | "premium";
  };
  limits: {
    trips: number;
    ai_smart_plan_lifetime: number;
    ai_day_planner_enabled: boolean;
    ride_priorities_per_trip: number;
    trip_payments: number;
    custom_tiles: number;
    pdf_watermarked: boolean;
    public_sharing: boolean;
    family_sharing_members: number;
  };
};

export const TIERS: Record<PublicTier, TierConfig> = {
  free: {
    key: "free",
    name: "Free",
    displayName: "Free",
    price_gbp: 0,
    monthlyPriceGbp: null,
    annualPriceGbp: null,
    features: {
      max_trips: 1,
      max_ai_per_trip: 3,
      family_sharing: false,
      pdf_watermark: true,
      pdf_design: "standard",
    },
    limits: {
      trips: 1,
      ai_smart_plan_lifetime: 3,
      ai_day_planner_enabled: false,
      ride_priorities_per_trip: 5,
      trip_payments: 3,
      custom_tiles: 5,
      pdf_watermarked: true,
      public_sharing: false,
      family_sharing_members: 0,
    },
  },
  pro: {
    key: "pro",
    name: "Pro",
    displayName: "Pro",
    price_gbp: 6.99,
    monthlyPriceGbp: 6.99,
    annualPriceGbp: 39.99,
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      family_sharing: false,
      pdf_watermark: false,
      pdf_design: "premium",
    },
    limits: {
      trips: -1,
      ai_smart_plan_lifetime: -1,
      ai_day_planner_enabled: true,
      ride_priorities_per_trip: -1,
      trip_payments: -1,
      custom_tiles: -1,
      pdf_watermarked: false,
      public_sharing: true,
      family_sharing_members: 0,
    },
  },
  family: {
    key: "family",
    name: "Family",
    displayName: "Family",
    price_gbp: 11.99,
    monthlyPriceGbp: 11.99,
    annualPriceGbp: 69.99,
    features: {
      max_trips: null,
      max_ai_per_trip: null,
      family_sharing: true,
      pdf_watermark: false,
      pdf_design: "premium",
    },
    limits: {
      trips: -1,
      ai_smart_plan_lifetime: -1,
      ai_day_planner_enabled: true,
      ride_priorities_per_trip: -1,
      trip_payments: -1,
      custom_tiles: -1,
      pdf_watermarked: false,
      public_sharing: true,
      family_sharing_members: 4,
    },
  },
};

export function normaliseTier(tier: string | null | undefined): PublicTier {
  const t = (tier ?? "free").toLowerCase();
  if (t === "pro") return "pro";
  if (t === "family") return "family";
  if (t === "premium") return "family";
  if (t === "concierge" || t === "agent_staff" || t === "agent_admin") {
    return "family";
  }
  return "free";
}

export function getTierConfig(tier: string | null | undefined): TierConfig {
  return TIERS[normaliseTier(tier)];
}

export function getEffectiveTier(profile: {
  tier: string;
  tier_expires_at: string | null;
}): PublicTier {
  if (profile.tier_expires_at) {
    const expiry = Date.parse(profile.tier_expires_at);
    if (Number.isFinite(expiry) && expiry <= Date.now()) {
      return "free";
    }
  }
  return normaliseTier(profile.tier);
}

export const PUBLIC_TIERS: PublicTier[] = ["free", "pro", "family"];
