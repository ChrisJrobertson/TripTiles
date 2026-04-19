"use client";

import { showToast } from "@/lib/toast";
import { getTierConfig, type PublicTier } from "@/lib/tiers";
import Link from "next/link";
import { useState } from "react";

type BillingInterval = "month" | "year";

type Props = {
  initialTier: PublicTier | null;
};

function annualSavings(baseMonthly: number, annual: number): string {
  const annualisedMonthly = baseMonthly * 12;
  const saved = ((annualisedMonthly - annual) / annualisedMonthly) * 100;
  return `Save ${Math.round(saved)}%`;
}

function heroPrice(
  tier: PublicTier,
  billing: BillingInterval,
): { main: string; sub: string; savePill: string | null } {
  if (tier === "free") {
    return { main: "£0", sub: "No billing", savePill: null };
  }
  const cfg = getTierConfig(tier);
  const m = cfg.monthlyPriceGbp ?? 0;
  const y = cfg.annualPriceGbp ?? 0;
  if (billing === "year") {
    return {
      main: `£${y.toFixed(2)}/year`,
      sub: `£${(y / 12).toFixed(2)}/month, billed annually`,
      savePill: annualSavings(m, y),
    };
  }
  return {
    main: `£${m.toFixed(2)}/month`,
    sub: `£${(m * 12).toFixed(2)}/year`,
    savePill: null,
  };
}

function cardCopy(tier: PublicTier): string {
  if (tier === "free") return "Start planning one trip for free.";
  if (tier === "pro")
    return "Unlimited planning with clean PDFs and public sharing.";
  return "Everything in Pro plus family sharing for up to four members.";
}

export function PricingClient({ initialTier }: Props) {
  const [billing, setBilling] = useState<BillingInterval>("year");
  const [busyTier, setBusyTier] = useState<PublicTier | null>(null);
  const isLoggedIn = initialTier != null;
  const currentTier = initialTier ?? "free";

  const startCheckout = async (tier: Exclude<PublicTier, "free">) => {
    const priceId =
      tier === "pro"
        ? billing === "year"
          ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL
          : process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY
        : billing === "year"
          ? process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL
          : process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY;
    if (!priceId) {
      showToast("Checkout is not configured yet.");
      return;
    }
    setBusyTier(tier);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) {
        showToast(j.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-royal/20 bg-white p-1">
          <button
            type="button"
            onClick={() => setBilling("month")}
            className={`min-h-[44px] rounded-full px-4 py-2 font-sans text-sm font-semibold ${
              billing === "month"
                ? "bg-royal text-cream"
                : "text-royal/70 hover:bg-cream"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("year")}
            className={`min-h-[44px] rounded-full px-4 py-2 font-sans text-sm font-semibold ${
              billing === "year"
                ? "bg-royal text-cream"
                : "text-royal/70 hover:bg-cream"
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {(["free", "pro", "family"] as const).map((tier) => {
          const p = heroPrice(tier, billing);
          const current = currentTier === tier;
          return (
            <article
              key={tier}
              className={`relative rounded-2xl border bg-white p-6 shadow-sm ${
                tier === "pro"
                  ? "border-gold/60 ring-2 ring-gold/25"
                  : "border-royal/10"
              }`}
            >
              {tier === "pro" ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-royal px-3 py-0.5 font-sans text-xs font-semibold text-cream">
                  Most popular
                </span>
              ) : null}
              {tier === "family" ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 font-sans text-xs font-semibold text-royal">
                  Best for families
                </span>
              ) : null}
              <h3 className="font-serif text-xl font-semibold text-royal">
                {getTierConfig(tier).displayName}
              </h3>
              <p className="mt-3 font-serif text-3xl font-semibold text-royal">
                {p.main}
              </p>
              <p className="mt-1 font-sans text-xs text-royal/70">{p.sub}</p>
              {p.savePill ? (
                <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 font-sans text-xs font-semibold text-emerald-800">
                  {p.savePill}
                </span>
              ) : null}
              <p className="mt-4 font-sans text-sm text-royal/75">{cardCopy(tier)}</p>

              <div className="mt-6">
                {tier === "free" ? (
                  current ? (
                    <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-royal/20 bg-cream px-4 py-2 text-sm font-semibold text-royal/60">
                      Your current plan
                    </span>
                  ) : (
                    <Link
                      href={isLoggedIn ? "/planner" : "/signup"}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-royal/20 bg-white px-4 py-2 text-sm font-semibold text-royal hover:bg-cream"
                    >
                      Start planning free
                    </Link>
                  )
                ) : !isLoggedIn ? (
                  <Link
                    href="/signup?next=/pricing"
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-cream"
                  >
                    Sign up to subscribe
                  </Link>
                ) : current ? (
                  <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-royal/20 bg-cream px-4 py-2 text-sm font-semibold text-royal/60">
                    Your current plan
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busyTier !== null}
                    onClick={() => void startCheckout(tier)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-royal disabled:opacity-50"
                  >
                    {busyTier === tier
                      ? "Redirecting…"
                      : tier === "pro"
                        ? "Get Pro"
                        : "Get Family"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-royal/10 bg-white">
        <table className="min-w-full divide-y divide-royal/10">
          <thead className="bg-cream/60">
            <tr className="font-sans text-xs uppercase tracking-wide text-royal/70">
              <th className="px-4 py-3 text-left">Feature</th>
              <th className="px-4 py-3 text-left">Free</th>
              <th className="px-4 py-3 text-left">Pro</th>
              <th className="px-4 py-3 text-left">Family</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-royal/10 font-sans text-sm text-royal/85">
            <tr><td className="px-4 py-2">Trips</td><td className="px-4 py-2">1</td><td className="px-4 py-2">Unlimited</td><td className="px-4 py-2">Unlimited</td></tr>
            <tr><td className="px-4 py-2">AI Smart Plan</td><td className="px-4 py-2">3 lifetime</td><td className="px-4 py-2">Unlimited</td><td className="px-4 py-2">Unlimited</td></tr>
            <tr><td className="px-4 py-2">AI Day Planner (future)</td><td className="px-4 py-2">❌</td><td className="px-4 py-2">✅</td><td className="px-4 py-2">✅</td></tr>
            <tr><td className="px-4 py-2">Ride priorities per trip</td><td className="px-4 py-2">5</td><td className="px-4 py-2">Unlimited</td><td className="px-4 py-2">Unlimited</td></tr>
            <tr><td className="px-4 py-2">Trip payments tracking</td><td className="px-4 py-2">3 items</td><td className="px-4 py-2">Unlimited</td><td className="px-4 py-2">Unlimited</td></tr>
            <tr><td className="px-4 py-2">Custom tiles</td><td className="px-4 py-2">5</td><td className="px-4 py-2">Unlimited</td><td className="px-4 py-2">Unlimited</td></tr>
            <tr><td className="px-4 py-2">PDF export</td><td className="px-4 py-2">Watermarked</td><td className="px-4 py-2">Clean</td><td className="px-4 py-2">Clean</td></tr>
            <tr><td className="px-4 py-2">Public sharing + cloning</td><td className="px-4 py-2">❌</td><td className="px-4 py-2">✅</td><td className="px-4 py-2">✅</td></tr>
            <tr><td className="px-4 py-2">Family sharing (4 members)</td><td className="px-4 py-2">❌</td><td className="px-4 py-2">❌</td><td className="px-4 py-2">✅</td></tr>
            <tr><td className="px-4 py-2">Smart Plan model</td><td className="px-4 py-2">Haiku 4.5</td><td className="px-4 py-2">Haiku 4.5</td><td className="px-4 py-2">Haiku 4.5</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
