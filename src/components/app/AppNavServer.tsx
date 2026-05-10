import { AppNavHeader } from "@/components/app/AppNavHeader";
import { formatProductTierName } from "@/lib/product-tier-labels";
import { getUserTripCount } from "@/lib/db/trips";
import { readProfileRow, tierFromProfileRow } from "@/lib/supabase/profile-read";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getUserTier, maxActiveTripsForUser } from "@/lib/tier";
import { getTierConfig } from "@/lib/tiers";
import type { UserTier } from "@/lib/types";
import type { ComponentProps } from "react";
import { cache } from "react";

type AppNavResolvedProps = ComponentProps<typeof AppNavHeader>;

/**
 * Unified nav context for (app) routes: Stripe product tier, profile tier for
 * pill copy, trip count, and billing identifiers. Cached per request so
 * layout + any legacy duplicate fetches dedupe.
 */
export const loadAppNavHeaderProps = cache(
  async (): Promise<AppNavResolvedProps | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const [profileRead, tripCount, productTier, maxActiveTripCap] =
      await Promise.all([
        readProfileRow<{
          tier: string;
          stripe_customer_id?: string | null;
          display_name?: string | null;
        }>(supabase, user.id, "tier, stripe_customer_id, display_name"),
        getUserTripCount(user.id),
        getUserTier(user.id),
        maxActiveTripsForUser(user.id),
      ]);

    const freeMax = getTierConfig("free").features.max_trips ?? 1;

    if (!profileRead.ok) {
      return {
        userEmail: user.email ?? "",
        displayName: null,
        userTier: null,
        tierLoadError: true,
        tripCount,
        freeTripLimit: freeMax,
        planBadgeLabel: formatProductTierName(productTier),
        activeTripCap: maxActiveTripCap,
        showUpgradeNavCta: productTier === "free",
        stripeCustomerId: null,
      };
    }

    const profileRow = profileRead.data;
    const displayName = profileRow.display_name ?? null;
    const profileTier = tierFromProfileRow(profileRow);
    const navTier = (
      productTier === "free" ? "free" : profileTier
    ) as UserTier;

    return {
      userEmail: user.email ?? "",
      displayName,
      userTier: navTier,
      tripCount,
      freeTripLimit: freeMax,
      planBadgeLabel: formatProductTierName(productTier),
      activeTripCap: maxActiveTripCap,
      showUpgradeNavCta: productTier === "free",
      stripeCustomerId: profileRow.stripe_customer_id?.trim() || null,
    };
  },
);

export async function AppNavServer() {
  const props = await loadAppNavHeaderProps();
  if (!props) return null;
  return <AppNavHeader {...props} />;
}
