import { loadSettingsAuthContext } from "@/app/(app)/settings/_lib/settings-auth-context";
import { SettingsBillingPanel } from "@/components/settings/SettingsBillingPanel";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscription · Settings · TripTiles",
  description: "Plan and billing for TripTiles.",
};

export default async function SettingsSubscriptionPage() {
  const loaded = await loadSettingsAuthContext();
  if (!loaded.ok) return loaded.panel;

  const { ctx } = loaded;
  const { purchases, profileRow, productTier, planCfg } = ctx;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-tt-royal">
          Subscription
        </h1>
        <p className="mt-1 font-sans text-sm text-tt-royal/70">
          Your current plan, renewals, and Stripe billing portal.
        </p>
      </header>

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

      <SettingsBillingPanel
        purchases={purchases}
        profileRow={profileRow}
        productTier={productTier}
        planCfg={planCfg}
      />

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
    </>
  );
}
