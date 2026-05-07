"use client";

import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { showToast } from "@/lib/toast";
import type { ProductTier } from "@/lib/product-tier-labels";
import { formatProductTierName } from "@/lib/product-tier-labels";
import { TIERS, annualSaveVsMonthlyRoundedGbp } from "@/lib/tiers";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MePayload = {
  productTier: ProductTier;
  profileTier: string;
  stripeCustomerId: string | null;
};

type Billing = "monthly" | "yearly";

export type CheckoutPriceIds = {
  proMonth: string;
  proYear: string;
  familyMonth: string;
  familyYear: string;
};

function formatMonthlyPrice(amount: number): string {
  return `£${amount.toFixed(2)}/mo`;
}

function formatAnnualPrice(amount: number): string {
  return `£${amount.toFixed(0)}/yr`;
}

export function PricingClient({
  initialMe,
  checkoutPriceIds,
}: {
  initialMe: MePayload | null;
  checkoutPriceIds: CheckoutPriceIds;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<Billing>("yearly");
  const [busy, setBusy] = useState<string | null>(null);
  const [me, setMe] = useState<MePayload | null>(initialMe);
  const [successOpen, setSuccessOpen] = useState(false);
  const [fallbackBanner, setFallbackBanner] = useState(false);

  const success = searchParams.get("success") === "1";
  const cancelled = searchParams.get("cancelled") === "1";
  const successHandled = useRef(false);

  const refreshMe = useCallback(async () => {
    const r = await fetch("/api/account/plan", { credentials: "include" });
    if (!r.ok) return;
    const j = (await r.json()) as MePayload;
    setMe(j);
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (cancelled) {
      showToast("Checkout cancelled — no changes were made.", {
        type: "info",
        debounceKey: "pricing-checkout-cancelled",
        debounceMs: 500,
      });
    }
  }, [cancelled]);

  useEffect(() => {
    if (!success || successHandled.current) return;
    successHandled.current = true;
    let cancelledLocal = false;
    (async () => {
      setSuccessOpen(true);
      setFallbackBanner(false);
      const base = await fetch("/api/account/plan", { credentials: "include" });
      const baseJson = base.ok
        ? ((await base.json()) as MePayload)
        : ({ productTier: "free" } as MePayload);
      const startTier = baseJson.productTier;
      for (let i = 0; i < 10; i += 1) {
        if (cancelledLocal) return;
        await new Promise((r) => setTimeout(r, 2000));
        const r = await fetch("/api/account/plan", { credentials: "include" });
        if (!r.ok) continue;
        const j = (await r.json()) as MePayload;
        setMe(j);
        if (j.productTier !== startTier && j.productTier !== "free") {
          setSuccessOpen(false);
          showToast(`You're on ${formatProductTierName(j.productTier)}`, {
            type: "success",
            debounceKey: "pricing-checkout-success",
            debounceMs: 500,
          });
          router.replace("/");
          return;
        }
      }
      setFallbackBanner(true);
    })();
    return () => {
      cancelledLocal = true;
    };
  }, [success, router]);

  const pro = TIERS.pro;
  const family = TIERS.family;

  const proRoundedSave = annualSaveVsMonthlyRoundedGbp(pro);
  const familyRoundedSave = annualSaveVsMonthlyRoundedGbp(family);

  const proPrice = useMemo(() => {
    if (billing === "yearly") {
      return {
        main: formatAnnualPrice(pro.annualGbp),
        sub: `or ${formatMonthlyPrice(pro.monthlyGbp)} billed monthly`,
        save: `Save £${proRoundedSave}/year on Pro`,
      };
    }
    return {
      main: formatMonthlyPrice(pro.monthlyGbp),
      sub: `or ${formatAnnualPrice(pro.annualGbp)} billed annually`,
      save: null,
    };
  }, [billing, pro, proRoundedSave]);

  const familyPrice = useMemo(() => {
    if (billing === "yearly") {
      return {
        main: formatAnnualPrice(family.annualGbp),
        sub: `or ${formatMonthlyPrice(family.monthlyGbp)} billed monthly`,
        save: `Save £${familyRoundedSave}/year on Family`,
      };
    }
    return {
      main: formatMonthlyPrice(family.monthlyGbp),
      sub: `or ${formatAnnualPrice(family.annualGbp)} billed annually`,
      save: null,
    };
  }, [billing, family, familyRoundedSave]);

  const startCheckout = async (tier: "pro" | "family") => {
    setBusy(tier);
    try {
      const resolved =
        tier === "pro"
          ? billing === "yearly"
            ? checkoutPriceIds.proYear
            : checkoutPriceIds.proMonth
          : billing === "yearly"
            ? checkoutPriceIds.familyYear
            : checkoutPriceIds.familyMonth;
      if (!resolved?.trim()) {
        showToast("Pricing is not configured in this environment.", {
          type: "error",
        });
        return;
      }
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId: resolved.trim() }),
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) {
        showToast(j.error ?? "Could not start checkout.", { type: "error" });
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      const r = await fetch("/api/customer-portal", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) {
        showToast(j.error ?? "Could not open billing portal.", { type: "error" });
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusy(null);
    }
  };

  const current = me?.productTier ?? "free";

  return (
    <div className="w-full">
      {successOpen ? (
        <ModalShell maxWidthClass="max-w-md" panelClassName="p-8 text-center">
          <p className="font-heading text-2xl font-semibold text-tt-royal">
            Welcome aboard
          </p>
          <p className="mt-3 font-sans text-sm text-tt-royal/80">
            We&apos;re confirming your subscription with Smart Plan access…
          </p>
          {fallbackBanner ? (
            <p className="mt-4 font-sans text-xs text-tt-royal/70">
              This is taking longer than usual. Refresh the page in a moment, use
              the same email as TripTiles, or{" "}
              <Link href="/feedback" className="font-semibold text-tt-gold underline">
                contact us
              </Link>
              .
            </p>
          ) : null}
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => setSuccessOpen(false)}
          >
            Close
          </Button>
        </ModalShell>
      ) : null}

      <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
        <span className="font-sans text-sm font-medium text-tt-royal/70">Billing</span>
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-tt-line/15 bg-tt-surface p-1 shadow-tt-sm">
          <button
            type="button"
            className={`min-h-[44px] rounded-full px-4 py-2 font-sans text-sm font-semibold ${
              billing === "monthly"
                ? "bg-tt-royal text-white"
                : "text-tt-royal/70 hover:bg-tt-surface-warm"
            }`}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`min-h-[44px] rounded-full px-4 py-2 font-sans text-sm font-semibold ${
              billing === "yearly"
                ? "bg-tt-royal text-white"
                : "text-tt-royal/70 hover:bg-tt-surface-warm"
            }`}
            onClick={() => setBilling("yearly")}
          >
            Annual
          </button>
        </div>
        {billing === "yearly" ? (
          <span className="max-w-md rounded-full bg-tt-gold/25 px-3 py-1 text-center font-sans text-[11px] font-semibold leading-snug text-tt-royal sm:text-xs">
            vs monthly billing: Pro saves £{proRoundedSave}/yr · Family saves £
            {familyRoundedSave}/yr
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <article className="flex flex-col rounded-tt-lg border border-tt-line/10 bg-tt-surface p-6 shadow-tt-sm">
          <h2 className="font-heading text-xl font-semibold text-tt-royal">Free</h2>
          <p className="mt-4 font-heading text-3xl font-semibold text-tt-royal">
            £0 <span className="text-lg font-medium text-tt-royal/70">forever</span>
          </p>
          <p className="mt-1 font-sans text-xs text-tt-royal/60">Cancel anytime — no card required</p>
          <ul className="mt-4 flex-1 list-inside list-disc space-y-1.5 font-sans text-sm text-tt-royal/80">
            <li>1 active trip</li>
            <li>5 AI Smart Plan runs per account</li>
            <li>5 custom tiles total</li>
            <li>Watermarked PDF export</li>
          </ul>
          <div className="mt-6 flex flex-1 flex-col justify-end">
            {current === "free" && me ? (
              <span className="inline-flex min-h-[44px] items-center justify-center rounded-tt-md border border-tt-line/15 bg-tt-surface-warm px-4 py-2 text-center font-sans text-sm font-semibold text-tt-royal/60">
                Your current plan
              </span>
            ) : (
              <Link
                href="/signup"
                className="inline-flex min-h-[44px] items-center justify-center rounded-tt-md border border-tt-line/20 bg-tt-surface px-4 py-2 text-center font-sans text-sm font-semibold text-tt-royal hover:bg-tt-surface-warm"
              >
                Get started free
              </Link>
            )}
          </div>
        </article>

        <article className="flex flex-col rounded-tt-lg border border-tt-gold/50 bg-tt-surface p-6 shadow-tt-md ring-2 ring-tt-gold/20">
          <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-tt-royal">
            <span className="rounded-full bg-tt-royal px-2 py-0.5 text-white">
              Most popular
            </span>
          </p>
          <h2 className="mt-2 font-heading text-xl font-semibold text-tt-royal">Pro</h2>
          <p className="mt-4 font-heading text-3xl font-semibold text-tt-royal">
            {proPrice.main}
          </p>
          <p className="mt-1 font-sans text-xs text-tt-royal/65">{proPrice.sub}</p>
          {proPrice.save ? (
            <p className="mt-1 font-sans text-xs font-semibold text-tt-gold">{proPrice.save}</p>
          ) : null}
          <p className="mt-2 font-sans text-xs text-tt-royal/55">Cancel anytime</p>
          <ul className="mt-3 flex-1 list-inside list-disc space-y-1.5 font-sans text-sm text-tt-royal/80">
            <li>Unlimited trips</li>
            <li>Unlimited AI Smart Plan</li>
            <li>Unlimited custom tiles</li>
            <li>Clean PDF export</li>
          </ul>
          <button
            type="button"
            disabled={Boolean(busy) || current === "pro"}
            onClick={() => void startCheckout("pro")}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-tt-md bg-tt-royal px-4 py-2.5 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-royal/90 disabled:opacity-50"
          >
            {current === "pro"
              ? "Your current plan"
              : busy === "pro"
                ? "Redirecting…"
                : "Start with Pro"}
          </button>
        </article>

        <article className="flex flex-col rounded-tt-lg border border-tt-line/10 bg-tt-surface p-6 shadow-tt-sm">
          <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-tt-gold">
            <span className="rounded-full bg-tt-gold/25 px-2 py-0.5 text-tt-royal">
              Best for families
            </span>
          </p>
          <h2 className="mt-2 font-heading text-xl font-semibold text-tt-royal">
            Family
          </h2>
          <p className="mt-4 font-heading text-3xl font-semibold text-tt-royal">
            {familyPrice.main}
          </p>
          <p className="mt-1 font-sans text-xs text-tt-royal/65">{familyPrice.sub}</p>
          {familyPrice.save ? (
            <p className="mt-1 font-sans text-xs font-semibold text-tt-gold">{familyPrice.save}</p>
          ) : null}
          <p className="mt-2 font-sans text-xs text-tt-royal/55">Cancel anytime</p>
          <ul className="mt-3 flex-1 list-inside list-disc space-y-1.5 font-sans text-sm text-tt-royal/80">
            <li>Everything in Pro</li>
            <li>Shared planning for up to 4 family members</li>
          </ul>
          <button
            type="button"
            disabled={Boolean(busy) || current === "family"}
            onClick={() => void startCheckout("family")}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-tt-md bg-tt-gold px-4 py-2.5 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-gold/90 disabled:opacity-50"
          >
            {current === "family"
              ? "Your current plan"
              : busy === "family"
                ? "Redirecting…"
                : "Start with Family"}
          </button>
        </article>
      </div>

      <p className="mt-8 rounded-tt-lg border border-tt-gold/35 bg-tt-gold/10 px-4 py-3 text-center font-sans text-sm font-semibold text-tt-royal">
        Use code <code className="rounded-tt-md bg-tt-surface/90 px-1">LAUNCH20</code> at
        checkout for 20% off your first month — first 100 customers.
      </p>

      <div className="mt-12 overflow-x-auto rounded-tt-md border border-tt-line/10 bg-tt-surface/95 shadow-tt-sm">
        <table className="w-full min-w-[520px] border-collapse font-sans text-sm text-tt-royal">
          <caption className="sr-only">Plan comparison</caption>
          <thead>
            <tr className="border-b border-tt-line/10 bg-tt-surface-warm/80 text-left">
              <th className="px-4 py-3 font-semibold">Feature</th>
              <th className="px-4 py-3 font-semibold">Free</th>
              <th className="px-4 py-3 font-semibold">Pro</th>
              <th className="px-4 py-3 font-semibold">Family</th>
            </tr>
          </thead>
          <tbody className="text-tt-royal/85">
            <tr className="border-b border-tt-line/10">
              <td className="px-4 py-2">Active trips</td>
              <td className="px-4 py-2">1</td>
              <td className="px-4 py-2">Unlimited</td>
              <td className="px-4 py-2">Unlimited</td>
            </tr>
            <tr className="border-b border-tt-line/10">
              <td className="px-4 py-2">Smart Plan (AI)</td>
              <td className="px-4 py-2">5 total on Free</td>
              <td className="px-4 py-2">Unlimited</td>
              <td className="px-4 py-2">Unlimited</td>
            </tr>
            <tr className="border-b border-tt-line/10">
              <td className="px-4 py-2">Custom tiles</td>
              <td className="px-4 py-2">5 total</td>
              <td className="px-4 py-2">Unlimited</td>
              <td className="px-4 py-2">Unlimited</td>
            </tr>
            <tr className="border-b border-tt-line/10">
              <td className="px-4 py-2">AI Day Planner</td>
              <td className="px-4 py-2">—</td>
              <td className="px-4 py-2">Included</td>
              <td className="px-4 py-2">Included</td>
            </tr>
            <tr className="border-b border-tt-line/10">
              <td className="px-4 py-2">PDF export</td>
              <td className="px-4 py-2">Watermarked</td>
              <td className="px-4 py-2">Clean</td>
              <td className="px-4 py-2">Clean</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Family sharing</td>
              <td className="px-4 py-2">—</td>
              <td className="px-4 py-2">—</td>
              <td className="px-4 py-2">Up to 4 members</td>
            </tr>
          </tbody>
        </table>
      </div>

      {me?.stripeCustomerId ? (
        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={busy === "portal"}
            onClick={() => void openPortal()}
            className="min-h-[44px] rounded-tt-md border border-tt-line/20 px-4 py-2 font-sans text-sm font-semibold text-tt-royal hover:bg-tt-surface-warm disabled:opacity-50"
          >
            {busy === "portal" ? "Opening…" : "Manage subscription"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
