import { AppNavHeader } from "@/components/app/AppNavHeader";
import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { SettingsAccountPanel } from "@/components/settings/SettingsAccountPanel";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getUserTier } from "@/lib/tier";
import { getTierConfig, renewalPriceLabelGbp } from "@/lib/tiers";
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
import { ManageSubscriptionButton } from "@/components/settings/ManageSubscriptionButton";
import { TemperatureUnitSettings } from "@/components/settings/TemperatureUnitSettings";
import { EmailPreferencesSettings } from "@/components/settings/EmailPreferencesSettings";
import type { TemperatureUnit, UserTier } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings · TripTiles",
  description: "Account, plan, and billing for TripTiles.",
};

export const dynamic = "force-dynamic";

type PurchaseRow = {
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

export default async function SettingsPage() {
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

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/settings");

  const hasPasswordAuth = userHasEmailPasswordAuth(user);
  const oauthProviderLabel =
    hasPasswordAuth ? null : getOauthIdentityLabel(user);

  const [profileRead, purchasesRes, tripCount] = await Promise.all([
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
  ]);

  const productTier = await getUserTier(user.id);

  if (!profileRead.ok) {
    return <ProfileLoadErrorPanel detail={profileRead.message} />;
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

  return (
    <div className="min-h-screen bg-transparent pb-16 pt-0">
      <AppNavHeader
        userEmail={user.email ?? ""}
        userTier={(productTier === "free" ? "free" : tier) as UserTier}
        tripCount={tripCount}
        freeTripLimit={freeMax}
        showUpgradeNavCta={productTier === "free"}
      />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
        {productTier !== "free" ? (
          <p className="font-sans text-sm text-tt-royal/80">
            <Link
              href="/settings/templates"
              className="font-semibold text-tt-royal underline underline-offset-2"
            >
              Day templates
            </Link>{" "}
            — save and reuse planner days.
          </p>
        ) : null}
        <h1 className="font-heading text-3xl font-semibold text-tt-royal">
          Settings
        </h1>

        <Card className="p-6">
          <SectionHeader compact title="Planner display" />
          <TemperatureUnitSettings initial={initialTemperatureUnit} />
        </Card>

        <Card className="p-6">
          <SectionHeader compact title="Email preferences" />
          <EmailPreferencesSettings initialOptOut={emailMarketingOptOut} />
        </Card>

        <SettingsAccountPanel
          email={user.email ?? ""}
          displayName={displayName}
          createdAt={profileCreated}
          tierLabel={planCfg.name}
          tierBadge={planCfg.badge_emoji}
          hasPasswordAuth={hasPasswordAuth}
          oauthProviderLabel={oauthProviderLabel}
        />

        <Card className="p-6">
          <SectionHeader compact title="Billing" />
          {(() => {
            const stripeRows = purchases.filter((p) => p.provider === "stripe");
            const latestStripe = stripeRows[0] ?? null;
            const expRaw = profileRow.tier_expires_at ?? null;
            const expDate = expRaw ? new Date(expRaw) : null;
            const showCancelBanner =
              latestStripe?.subscription_status === "canceled" &&
              expDate &&
              !Number.isNaN(expDate.getTime()) &&
              expDate.getTime() > Date.now();
            return showCancelBanner ? (
              <div className="mt-4 rounded-tt-md border border-amber-300/80 bg-amber-50 px-4 py-3 font-sans text-sm text-tt-royal">
                Your {planCfg.name} access ends on{" "}
                {expDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                . You can resubscribe anytime from{" "}
                <Link href="/pricing" className="font-semibold text-tt-royal underline">
                  Pricing
                </Link>
                .
              </div>
            ) : null;
          })()}
          {(() => {
            const stripeRows = purchases.filter((p) => p.provider === "stripe");
            const latestStripe = stripeRows[0] ?? null;
            const st = latestStripe?.subscription_status ?? null;
            if (
              productTier !== "free" &&
              (st === "past_due" || st === "unpaid")
            ) {
              return (
                <div className="mt-4 rounded-tt-md border border-amber-400/90 bg-amber-50 px-4 py-3 font-sans text-sm text-tt-royal">
                  <p className="font-semibold">Payment failed — retrying</p>
                  <p className="mt-1 text-tt-royal/80">
                    Stripe is attempting to collect payment. Update your card in
                    the billing portal if you need to.
                  </p>
                  <ManageSubscriptionButton label="Manage billing" />
                </div>
              );
            }
            return null;
          })()}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {planCfg.badge_emoji}
            </span>
            <div>
              <p className="font-sans text-sm font-semibold text-tt-royal">
                {productTier === "free"
                  ? "Current plan: Free"
                  : (() => {
                      const stripeRows = purchases.filter(
                        (p) => p.provider === "stripe",
                      );
                      const s = stripeRows[0] ?? null;
                      const interval =
                        s?.billing_interval === "year"
                          ? "billed annually"
                          : s?.billing_interval === "month"
                            ? "billed monthly"
                            : "";
                      return `Current plan: ${planCfg.name}${interval ? ` — ${interval}` : ""}`;
                    })()}
              </p>
              {productTier === "free" ? (
                (() => {
                  const stripeRows = purchases.filter(
                    (p) => p.provider === "stripe",
                  );
                  const ended = stripeRows.find((p) =>
                    ["canceled", "unpaid"].includes(
                      String(p.subscription_status ?? ""),
                    ),
                  );
                  const endIso = ended?.subscription_period_end ?? null;
                  const endDate = endIso ? new Date(endIso) : null;
                  if (endDate && !Number.isNaN(endDate.getTime())) {
                    return (
                      <p className="mt-1 font-sans text-sm text-tt-royal/70">
                        Subscription ended on{" "}
                        {endDate.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        — see{" "}
                        <Link href="/pricing" className="font-semibold text-tt-royal underline">
                          pricing
                        </Link>{" "}
                        to resubscribe.
                      </p>
                    );
                  }
                  return (
                    <p className="mt-1 font-sans text-sm text-tt-royal/70">
                      Not subscribed — see{" "}
                      <Link href="/pricing" className="font-semibold text-tt-royal underline">
                        pricing
                      </Link>
                      .
                    </p>
                  );
                })()
              ) : (
                <p className="mt-1 font-sans text-sm text-tt-royal/70">
                  {(() => {
                    const stripeRows = purchases.filter(
                      (p) => p.provider === "stripe",
                    );
                    const s = stripeRows[0] ?? null;
                    if (!s?.subscription_period_end) {
                      return "Subscription renews via Stripe.";
                    }
                    const end = new Date(s.subscription_period_end);
                    if (Number.isNaN(end.getTime())) {
                      return "Subscription renews via Stripe.";
                    }
                    const nextPrice = renewalPriceLabelGbp(
                      s.product,
                      s.billing_interval ?? null,
                    );
                    return (
                      <>
                        Next renewal{" "}
                        {end.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {nextPrice ? (
                          <>
                            {" "}
                            — {nextPrice} (before any proration or tax shown in
                            Stripe).
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 font-sans text-xs text-tt-royal/55">
            Change card, cancel, switch between monthly and annual billing, or
            move between Pro and Family in the Stripe Customer Portal.
          </p>
          {(() => {
            const stripeRows = purchases.filter((p) => p.provider === "stripe");
            const hasStripeCustomer = Boolean(
              stripeRows.find((p) => p.provider_customer_id?.trim()) ||
                profileRow.stripe_customer_id?.trim(),
            );
            if (hasStripeCustomer) {
              return (
                <div className="mt-2 space-y-1">
                  <ManageSubscriptionButton label="Manage billing" />
                  <ManageSubscriptionButton
                    label="Cancel subscription"
                    variant="link"
                  />
                </div>
              );
            }
            return null;
          })()}
          {productTier === "free" ? (
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center justify-center rounded-tt-md bg-tt-gold px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-gold/90"
            >
              See pricing
            </Link>
          ) : null}
        </Card>

        <Card className="p-6">
          <SectionHeader compact title="Billing history" />
          {purchases.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-tt-royal/65">
              No subscription payments recorded yet. Successful renewals appear
              here after Stripe confirms them.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-tt-line-soft">
              {purchases.map((p) => {
                const receiptUrl =
                  typeof p.metadata?.receipt_url === "string"
                    ? p.metadata.receipt_url
                    : null;
                const amount = (p.amount_gbp_pence / 100).toFixed(2);
                const when = new Date(p.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-sans text-sm font-medium capitalize text-tt-royal">
                        {p.product}
                      </p>
                      <p className="font-sans text-xs text-tt-royal/60">
                        {when} · £{amount}{" "}
                        {p.currency && p.currency !== "GBP"
                          ? `(${p.currency})`
                          : ""}
                      </p>
                    </div>
                    {receiptUrl ? (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-sm font-semibold text-tt-royal underline underline-offset-2"
                      >
                        View receipt
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
