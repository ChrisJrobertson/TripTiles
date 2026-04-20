"use client";

import { showToast } from "@/lib/toast";
import type { ProductTier } from "@/lib/product-tier-labels";
import { formatProductTierName } from "@/lib/product-tier-labels";
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

  const proPrice = useMemo(
    () =>
      billing === "yearly"
        ? { main: "£39.00 / year", sub: "£3.25 per month, billed annually" }
        : { main: "£6.99 / month", sub: "£83.88 per year if paying monthly" },
    [billing],
  );

  const familyPrice = useMemo(
    () =>
      billing === "yearly"
        ? { main: "£69.00 / year", sub: "Great value for households" }
        : { main: "£11.99 / month", sub: "Billed monthly, cancel anytime" },
    [billing],
  );

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
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-royal/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md rounded-2xl border border-royal/15 bg-cream p-8 text-center shadow-xl">
            <p className="font-serif text-2xl font-semibold text-royal">
              Welcome aboard
            </p>
            <p className="mt-3 font-sans text-sm text-royal/80">
              We&apos;re confirming your subscription with Smart Plan access…
            </p>
            {fallbackBanner ? (
              <p className="mt-4 font-sans text-xs text-royal/70">
                This is taking longer than usual. Refresh the page in a moment, use
                the same email as TripTiles, or{" "}
                <Link href="/feedback" className="text-gold underline">
                  contact us
                </Link>
                .
              </p>
            ) : null}
            <button
              type="button"
              className="mt-6 min-h-[44px] rounded-lg border border-royal/20 px-4 py-2 font-sans text-sm text-royal/80"
              onClick={() => setSuccessOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <span className="font-sans text-sm font-medium text-royal/70">
          Billing
        </span>
        <div className="inline-flex rounded-full border border-royal/15 bg-white p-1">
          <button
            type="button"
            className={`min-h-[44px] rounded-full px-4 py-2 font-sans text-sm font-semibold ${
              billing === "yearly"
                ? "bg-royal text-cream"
                : "text-royal/70 hover:bg-cream"
            }`}
            onClick={() => setBilling("yearly")}
          >
            Yearly (default)
          </button>
          <button
            type="button"
            className={`min-h-[44px] rounded-full px-4 py-2 font-sans text-sm font-semibold ${
              billing === "monthly"
                ? "bg-royal text-cream"
                : "text-royal/70 hover:bg-cream"
            }`}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <article className="flex flex-col rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">Free</h2>
          <p className="mt-4 font-serif text-3xl font-semibold text-royal">
            £0 <span className="text-lg font-medium text-royal/70">/ forever</span>
          </p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Plan one trip, see what TripTiles does.
          </p>
          <div className="mt-6 flex flex-1 flex-col justify-end">
            {current === "free" && me ? (
              <span className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-royal/15 bg-cream px-4 py-2 text-center font-sans text-sm font-semibold text-royal/60">
                Your current plan
              </span>
            ) : (
              <Link
                href="/signup"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-royal/20 bg-white px-4 py-2 text-center font-sans text-sm font-semibold text-royal hover:bg-cream"
              >
                Start free
              </Link>
            )}
          </div>
        </article>

        <article className="flex flex-col rounded-2xl border border-gold/50 bg-white p-6 shadow-md ring-2 ring-gold/20">
          <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-royal">
            <span className="rounded-full bg-royal px-2 py-0.5 text-cream">
              Most popular
            </span>
          </p>
          <h2 className="mt-2 font-serif text-xl font-semibold text-royal">Pro</h2>
          <p className="mt-4 font-serif text-3xl font-semibold text-royal">
            {proPrice.main}
          </p>
          <p className="mt-1 font-sans text-xs text-royal/65">{proPrice.sub}</p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Unlimited trips, full Smart Plan, clean PDFs.
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || current === "pro"}
            onClick={() => void startCheckout("pro")}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream shadow-sm transition hover:bg-royal/90 disabled:opacity-50"
          >
            {current === "pro"
              ? "Your current plan"
              : busy === "pro"
                ? "Redirecting…"
                : "Get Pro"}
          </button>
        </article>

        <article className="flex flex-col rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-gold">
            <span className="rounded-full bg-gold/25 px-2 py-0.5 text-royal">
              Best for families
            </span>
          </p>
          <h2 className="mt-2 font-serif text-xl font-semibold text-royal">
            Family
          </h2>
          <p className="mt-4 font-serif text-3xl font-semibold text-royal">
            {familyPrice.main}
          </p>
          <p className="mt-1 font-sans text-xs text-royal/65">{familyPrice.sub}</p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Everything in Pro, plus share with up to four family members.
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || current === "family"}
            onClick={() => void startCheckout("family")}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gold px-4 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-50"
          >
            {current === "family"
              ? "Your current plan"
              : busy === "family"
                ? "Redirecting…"
                : "Get Family"}
          </button>
        </article>
      </div>

      <div className="mt-12 overflow-x-auto rounded-xl border border-royal/10 bg-white/90">
        <table className="w-full min-w-[520px] border-collapse font-sans text-sm text-royal">
          <caption className="sr-only">Plan comparison</caption>
          <thead>
            <tr className="border-b border-royal/10 bg-cream/80 text-left">
              <th className="px-4 py-3 font-semibold">Feature</th>
              <th className="px-4 py-3 font-semibold">Free</th>
              <th className="px-4 py-3 font-semibold">Pro</th>
              <th className="px-4 py-3 font-semibold">Family</th>
            </tr>
          </thead>
          <tbody className="text-royal/85">
            <tr className="border-b border-royal/10">
              <td className="px-4 py-2">Active trips</td>
              <td className="px-4 py-2">1</td>
              <td className="px-4 py-2">Unlimited</td>
              <td className="px-4 py-2">Unlimited</td>
            </tr>
            <tr className="border-b border-royal/10">
              <td className="px-4 py-2">Smart Plan (AI)</td>
              <td className="px-4 py-2">3 lifetime</td>
              <td className="px-4 py-2">Unlimited</td>
              <td className="px-4 py-2">Unlimited</td>
            </tr>
            <tr className="border-b border-royal/10">
              <td className="px-4 py-2">AI Day Planner</td>
              <td className="px-4 py-2">—</td>
              <td className="px-4 py-2">Included</td>
              <td className="px-4 py-2">Included</td>
            </tr>
            <tr className="border-b border-royal/10">
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
            className="min-h-[44px] rounded-lg border border-royal/20 px-4 py-2 font-sans text-sm font-semibold text-royal hover:bg-cream disabled:opacity-50"
          >
            {busy === "portal" ? "Opening…" : "Manage subscription"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
