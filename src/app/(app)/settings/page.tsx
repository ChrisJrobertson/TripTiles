import { AppNavHeader } from "@/components/app/AppNavHeader";
import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { SettingsAccountPanel } from "@/components/settings/SettingsAccountPanel";
import { getCurrentTierWithExpiry, getEffectiveTierFromProfileTier } from "@/lib/subscription";
import { getUserTripCount } from "@/lib/db/trips";
import {
  getOauthIdentityLabel,
  userHasEmailPasswordAuth,
} from "@/lib/auth/user-identities";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import {
  readProfileRow,
  tierFromProfileRow,
} from "@/lib/supabase/profile-read";
import { createClient } from "@/lib/supabase/server";
import { TemperatureUnitSettings } from "@/components/settings/TemperatureUnitSettings";
import { EmailPreferencesSettings } from "@/components/settings/EmailPreferencesSettings";
import type { TemperatureUnit } from "@/lib/types";
import type { PublicTier } from "@/lib/tiers";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings · TripTiles",
  description: "Account, plan, and billing for TripTiles.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add Supabase environment variables to{" "}
            <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/settings");

  const hasPasswordAuth = userHasEmailPasswordAuth(user);
  const oauthProviderLabel =
    hasPasswordAuth ? null : getOauthIdentityLabel(user);

  const [profileRead, tripCount] = await Promise.all([
    readProfileRow<{
      tier: string;
      display_name?: string | null;
      temperature_unit?: string | null;
      email_marketing_opt_out?: boolean | null;
      tier_expires_at?: string | null;
    }>(
      supabase,
      user.id,
      "tier, display_name, temperature_unit, email_marketing_opt_out, tier_expires_at",
    ),
    getUserTripCount(user.id),
  ]);

  if (!profileRead.ok) {
    return <ProfileLoadErrorPanel detail={profileRead.message} />;
  }

  const profileRow = profileRead.data;
  const profileTier = tierFromProfileRow(profileRow);
  const effectiveTier = getEffectiveTierFromProfileTier(
    profileTier,
    profileRow.tier_expires_at ?? null,
  );
  const currentTierWithExpiry = await getCurrentTierWithExpiry(user.id);
  const subscriptionStatus = await supabase
    .from("purchases")
    .select(
      "billing_interval, subscription_period_end, subscription_status, provider_customer_id, provider, created_at",
    )
    .eq("user_id", user.id)
    .eq("provider", "stripe")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sub = subscriptionStatus.data as
    | {
        billing_interval?: "month" | "year" | null;
        subscription_period_end?: string | null;
        subscription_status?: string | null;
        provider_customer_id?: string | null;
      }
    | null;
  const billingIntervalLabel =
    sub?.billing_interval === "year"
      ? "Annual"
      : sub?.billing_interval === "month"
        ? "Monthly"
        : null;
  const nextBillingDate =
    sub?.subscription_period_end &&
    Number.isFinite(Date.parse(sub.subscription_period_end))
      ? new Date(sub.subscription_period_end).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const isCancelledWithGrace =
    sub?.subscription_status === "canceled" &&
    profileRow.tier_expires_at != null &&
    Number.isFinite(Date.parse(profileRow.tier_expires_at)) &&
    Date.parse(profileRow.tier_expires_at) > Date.now();
  const cancelledEndsOn =
    isCancelledWithGrace && profileRow.tier_expires_at
      ? new Date(profileRow.tier_expires_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const tierLabel: Record<PublicTier, string> = {
    free: "Free",
    pro: "Pro",
    family: "Family",
  };
  const canManagePortal = Boolean(sub?.provider_customer_id?.trim());
  const displayName = profileRow.display_name ?? null;
  const profileCreated = user.created_at ?? null;
  const freeMax = 1;
  const initialTemperatureUnit: TemperatureUnit =
    profileRow.temperature_unit === "f" ? "f" : "c";
  const emailMarketingOptOut = profileRow.email_marketing_opt_out === true;

  return (
    <div className="min-h-screen bg-cream pb-16 pt-0">
      <AppNavHeader
        userEmail={user.email ?? ""}
        userTier={profileTier}
        tripCount={tripCount}
        freeTripLimit={freeMax}
      />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
        {effectiveTier !== "free" ? (
          <p className="font-sans text-sm text-royal/80">
            <Link
              href="/settings/templates"
              className="font-semibold text-royal underline underline-offset-2"
            >
              Day templates
            </Link>{" "}
            — save and reuse planner days.
          </p>
        ) : null}
        <h1 className="font-serif text-3xl font-semibold text-royal">
          Settings
        </h1>

        <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Planner display
          </h2>
          <TemperatureUnitSettings initial={initialTemperatureUnit} />
        </section>

        <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Email preferences
          </h2>
          <EmailPreferencesSettings initialOptOut={emailMarketingOptOut} />
        </section>

        <SettingsAccountPanel
          email={user.email ?? ""}
          displayName={displayName}
          createdAt={profileCreated}
          tierLabel={tierLabel[effectiveTier]}
          tierBadge={effectiveTier === "family" ? "👨‍👩‍👧‍👦" : effectiveTier === "pro" ? "⭐" : "✈️"}
          hasPasswordAuth={hasPasswordAuth}
          oauthProviderLabel={oauthProviderLabel}
        />

        <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Subscription
          </h2>
          {isCancelledWithGrace && cancelledEndsOn ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 font-sans text-sm text-amber-900">
              Your {tierLabel[currentTierWithExpiry.tier]} access ends on{" "}
              {cancelledEndsOn}. Resubscribe anytime below.
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {currentTierWithExpiry.tier === "family"
                ? "👨‍👩‍👧‍👦"
                : currentTierWithExpiry.tier === "pro"
                  ? "⭐"
                  : "✈️"}
            </span>
            <div>
              <p className="font-sans text-sm font-semibold text-royal">
                Current plan: {tierLabel[currentTierWithExpiry.tier]}
              </p>
              {currentTierWithExpiry.tier !== "free" && billingIntervalLabel ? (
                <p className="mt-1 font-sans text-sm text-royal/70">
                  {billingIntervalLabel}
                  {nextBillingDate ? ` · Next billing: ${nextBillingDate}` : ""}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {canManagePortal ? (
              <form action="/api/customer-portal" method="post">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-royal/20 bg-white px-4 py-2 text-sm font-semibold text-royal hover:bg-cream"
                >
                  Manage subscription
                </button>
              </form>
            ) : (
              <p className="font-sans text-sm text-royal/70">
                No active Stripe subscription found.
              </p>
            )}
            <Link
              href="/pricing"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-royal shadow-sm hover:bg-gold/90"
            >
              View plans
            </Link>
          </div>
          {currentTierWithExpiry.tier === "free" ? (
            <p className="mt-3 font-sans text-xs text-royal/55">
              Upgrade to unlock unlimited trips, Smart Plan, payments, and
              sharing.
            </p>
          ) : (
            <p className="mt-3 font-sans text-xs text-royal/55">
              Invoices and receipts are managed in the Stripe Customer Portal.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
