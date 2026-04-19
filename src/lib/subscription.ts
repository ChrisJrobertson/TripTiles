import { formatDateISO } from "@/lib/date-helpers";
import { getEffectiveTier, getTierConfig, type PublicTier } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type SubscriptionView = {
  tier: PublicTier;
  tier_expires_at: string | null;
  interval: "month" | "year" | null;
  subscription_status: string | null;
  next_billing_date: string | null;
};

export function getEffectiveTierFromProfileTier(
  tier: string | null | undefined,
  tierExpiresAt: string | null | undefined,
): PublicTier {
  return getEffectiveTier({
    tier: String(tier ?? "free"),
    tier_expires_at: tierExpiresAt ?? null,
  });
}

export async function getCurrentTierWithExpiry(
  userId?: string,
): Promise<{ tier: PublicTier; tier_expires_at: string | null }> {
  const resolvedUserId = userId ?? (await getCurrentUser())?.id ?? null;
  if (!resolvedUserId) {
    return { tier: "free", tier_expires_at: null };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("tier, tier_expires_at")
    .eq("id", resolvedUserId)
    .maybeSingle();

  const rawTier = String((data as { tier?: string } | null)?.tier ?? "free");
  const tierExpiresAt =
    (data as { tier_expires_at?: string | null } | null)?.tier_expires_at ??
    null;

  return {
    tier: getEffectiveTierFromProfileTier(rawTier, tierExpiresAt),
    tier_expires_at: tierExpiresAt ? formatDateISO(new Date(tierExpiresAt)) : null,
  };
}

export async function getCurrentSubscriptionView(): Promise<SubscriptionView> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      tier: "free",
      tier_expires_at: null,
      interval: null,
      subscription_status: null,
      next_billing_date: null,
    };
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: purchase }] = await Promise.all([
    supabase
      .from("profiles")
      .select("tier, tier_expires_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("purchases")
      .select(
        "billing_interval, subscription_status, subscription_period_end, created_at",
      )
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rawTier = String((profile as { tier?: string } | null)?.tier ?? "free");
  const tierExpiresAt =
    (profile as { tier_expires_at?: string | null } | null)?.tier_expires_at ??
    null;
  const interval = (
    (purchase as { billing_interval?: string } | null)?.billing_interval ?? null
  ) as "month" | "year" | null;
  const subscriptionStatus =
    (purchase as { subscription_status?: string } | null)?.subscription_status ??
    null;
  const nextBillingRaw =
    (purchase as { subscription_period_end?: string | null } | null)
      ?.subscription_period_end ?? null;

  return {
    tier: getEffectiveTierFromProfileTier(rawTier, tierExpiresAt),
    tier_expires_at: tierExpiresAt ? formatDateISO(new Date(tierExpiresAt)) : null,
    interval,
    subscription_status: subscriptionStatus,
    next_billing_date: nextBillingRaw ? formatDateISO(new Date(nextBillingRaw)) : null,
  };
}

export function isPaidTier(tier: PublicTier): boolean {
  return getTierConfig(tier).monthlyPriceGbp !== null;
}
