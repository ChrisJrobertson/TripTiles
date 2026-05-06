import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { Card } from "@/components/ui/Card";
import { getUserTier } from "@/lib/tier";
import { getTierConfig } from "@/lib/tiers";
import { getUserTripCount } from "@/lib/db/trips";
import {
  userHasEmailPasswordAuth,
  getOauthIdentityLabel,
} from "@/lib/auth/user-identities";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { readProfileRow, tierFromProfileRow } from "@/lib/supabase/profile-read";
import { createClient } from "@/lib/supabase/server";
import type { TemperatureUnit, UserTier } from "@/lib/types";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { cache } from "react";

export type PurchaseRow = {
  id: string;
  created_at: string;
  product: string;
  amount_gbp_pence: number;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  provider?: string | null;
  provider_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_period_end?: string | null;
  billing_interval?: string | null;
};

export type SettingsAuthContext = {
  user: User;
  hasPasswordAuth: boolean;
  oauthProviderLabel: string | null;
  tripCount: number;
  productTier: Awaited<ReturnType<typeof getUserTier>>;
  navTier: UserTier;
  freeMax: number;
  displayName: string | null;
  profileCreated: string | null;
  initialTemperatureUnit: TemperatureUnit;
  emailMarketingOptOut: boolean;
  purchases: PurchaseRow[];
  profileRow: {
    tier: string;
    display_name?: string | null;
    temperature_unit?: string | null;
    email_marketing_opt_out?: boolean | null;
    tier_expires_at?: string | null;
    stripe_customer_id?: string | null;
  };
  planCfg: ReturnType<typeof getTierConfig>;
};

export async function ensureSettingsMissingConfigUi(): Promise<ReactNode | null> {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-transparent px-6 py-12">
        <Card className="mx-auto max-w-lg p-8">
          <h1 className="font-heading text-xl font-semibold text-tt-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-tt-royal/70">
            Add Supabase environment variables to{" "}
            <code className="rounded-tt-md bg-tt-surface-warm px-1 font-meta text-xs">
              .env.local
            </code>
            , then restart the dev server.
          </p>
        </Card>
      </main>
    );
  }
  return null;
}

/** Shared auth + profile + billing rows for Settings sub-pages (deduped per request). */
async function loadSettingsAuthContextOnce(): Promise<
  | { ok: false; panel: ReactNode }
  | { ok: true; ctx: SettingsAuthContext }
> {
  const missing = await ensureSettingsMissingConfigUi();
  if (missing) return { ok: false, panel: missing };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    redirect("/login?next=%2Fsettings%2Fprofile");

  const hasPasswordAuth = userHasEmailPasswordAuth(user);
  const oauthProviderLabel = hasPasswordAuth
    ? null
    : getOauthIdentityLabel(user);

  const [profileRead, purchasesRes, tripCount, productTier] = await Promise.all(
    [
      readProfileRow<{
        tier: string;
        display_name?: string | null;
        temperature_unit?: string | null;
        email_marketing_opt_out?: boolean | null;
        tier_expires_at?: string | null;
        stripe_customer_id?: string | null;
      }>(
        supabase,
        user.id,
        "tier, display_name, temperature_unit, email_marketing_opt_out, tier_expires_at, stripe_customer_id",
      ),
      supabase
        .from("purchases")
        .select(
          "id, created_at, product, amount_gbp_pence, currency, metadata, provider, provider_customer_id, subscription_status, subscription_period_end, billing_interval",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      getUserTripCount(user.id),
      getUserTier(user.id),
    ],
  );

  if (!profileRead.ok) {
    return {
      ok: false,
      panel: <ProfileLoadErrorPanel detail={profileRead.message} />,
    };
  }

  const profileRow = profileRead.data;
  const tier = tierFromProfileRow(profileRow);
  const planCfg = getTierConfig(productTier);
  const displayName = profileRow.display_name ?? null;
  const profileCreated = user.created_at ?? null;
  const purchases = (purchasesRes.data ?? []) as PurchaseRow[];
  const freeMax = getTierConfig("free").features.max_trips ?? 1;
  const initialTemperatureUnit: TemperatureUnit =
    profileRow.temperature_unit === "f" ? "f" : "c";
  const emailMarketingOptOut = profileRow.email_marketing_opt_out === true;

  return {
    ok: true,
    ctx: {
      user,
      hasPasswordAuth,
      oauthProviderLabel,
      tripCount,
      productTier,
      navTier: (productTier === "free" ? "free" : tier) as UserTier,
      freeMax,
      displayName,
      profileCreated,
      initialTemperatureUnit,
      emailMarketingOptOut,
      purchases,
      profileRow,
      planCfg,
    },
  };
}

export const loadSettingsAuthContext = cache(loadSettingsAuthContextOnce);
