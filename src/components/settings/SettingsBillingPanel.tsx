"use client";

import { ManageSubscriptionButton } from "@/components/settings/ManageSubscriptionButton";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { renewalPriceLabelGbp } from "@/lib/tiers";
import Link from "next/link";

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

type PlanCfg = {
  name: string;
  badge_emoji: string;
};

type Props = {
  purchases: PurchaseRow[];
  profileRow: {
    tier_expires_at?: string | null;
    stripe_customer_id?: string | null;
  };
  productTier: string;
  /** Stripe-normalised tier for billing copy */
  planCfg: PlanCfg;
};

export function SettingsBillingPanel({
  purchases,
  profileRow,
  productTier,
  planCfg,
}: Props) {
  const stripeRows = purchases.filter((p) => p.provider === "stripe");
  const latestStripe = stripeRows[0] ?? null;
  const expRaw = profileRow.tier_expires_at ?? null;
  const expDate = expRaw ? new Date(expRaw) : null;
  const showCancelBanner =
    latestStripe?.subscription_status === "canceled" &&
    expDate &&
    !Number.isNaN(expDate.getTime()) &&
    expDate.getTime() > Date.now();

  const st = latestStripe?.subscription_status ?? null;
  const showPaymentFailed =
    productTier !== "free" && (st === "past_due" || st === "unpaid");

  return (
    <Card className="p-6">
      <SectionHeader compact title="Billing" />
      {showCancelBanner ? (
        <div className="mt-4 rounded-tt-md border border-amber-300/80 bg-amber-50 px-4 py-3 font-sans text-sm text-tt-royal">
          Your {planCfg.name} access ends on{" "}
          {expDate!.toLocaleDateString("en-GB", {
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
      ) : null}

      {showPaymentFailed ? (
        <div className="mt-4 rounded-tt-md border border-amber-400/90 bg-amber-50 px-4 py-3 font-sans text-sm text-tt-royal">
          <p className="font-semibold">Payment failed — retrying</p>
          <p className="mt-1 text-tt-royal/80">
            Stripe is attempting to collect payment. Use Manage subscription below
            to update your card in the billing portal.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {planCfg.badge_emoji}
        </span>
        <div>
          <p className="font-sans text-sm font-semibold text-tt-royal">
            {productTier === "free"
              ? "Current plan: Free"
              : (() => {
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

      {productTier === "free" ? (
        <Link
          href="/pricing"
          className="mt-6 inline-flex items-center justify-center rounded-tt-md bg-tt-gold px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-gold/90"
        >
          See pricing
        </Link>
      ) : (
        (() => {
          const hasStripeCustomer = Boolean(
            stripeRows.find((p) => p.provider_customer_id?.trim()) ||
              profileRow.stripe_customer_id?.trim(),
          );
          return (
            <div className="mt-6 space-y-1">
              <ManageSubscriptionButton
                label="Manage subscription"
                openInNewTab
              />
              <p className="max-w-xl font-sans text-xs leading-relaxed text-tt-ink-muted">
                Change card, cancel, switch monthly/annual, or upgrade/downgrade
                in the Stripe Customer Portal.
              </p>
              {hasStripeCustomer ? (
                <ManageSubscriptionButton
                  label="Cancel subscription"
                  variant="link"
                />
              ) : null}
            </div>
          );
        })()
      )}
    </Card>
  );
}
