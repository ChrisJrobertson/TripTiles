"use client";

import { showToast } from "@/lib/toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProductTier = "day_tripper" | "navigator" | "captain";
type Billing = "monthly" | "yearly";

type MePayload = {
  productTier: ProductTier;
  profileTier: string;
  stripeCustomerId: string | null;
};

function formatTierLabel(t: ProductTier): string {
  if (t === "day_tripper") return "Day Tripper";
  if (t === "navigator") return "Navigator";
  return "Captain";
}

export function PricingClient({
  initialMe,
}: {
  initialMe: MePayload | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<Billing>("yearly");
  const [busy, setBusy] = useState<string | null>(null);
  const [me, setMe] = useState<MePayload | null>(initialMe);
  const [successOpen, setSuccessOpen] = useState(false);
  const [fallbackBanner, setFallbackBanner] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);

  const success = searchParams.get("success") === "1";
  const cancelled = searchParams.get("cancelled") === "1";
  const successHandled = useRef(false);

  const refreshMe = useCallback(async () => {
    const r = await fetch("/api/subscriptions/me", { credentials: "include" });
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
      const base = await fetch("/api/subscriptions/me", { credentials: "include" });
      const baseJson = base.ok
        ? ((await base.json()) as MePayload)
        : ({ productTier: "day_tripper" } as MePayload);
      const startTier = baseJson.productTier;
      await fetch("/api/subscriptions/refresh", {
        method: "POST",
        credentials: "include",
      });
      for (let i = 0; i < 10; i += 1) {
        if (cancelledLocal) return;
        await new Promise((r) => setTimeout(r, 2000));
        const r = await fetch("/api/subscriptions/me", { credentials: "include" });
        if (!r.ok) continue;
        const j = (await r.json()) as MePayload;
        setMe(j);
        if (j.productTier !== startTier && j.productTier !== "day_tripper") {
          setSuccessOpen(false);
          showToast(`You're on ${formatTierLabel(j.productTier)}`, {
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

  const navigatorPrice = useMemo(
    () => (billing === "yearly" ? "£39.00 / year" : "£4.99 / month"),
    [billing],
  );
  const captainPrice = useMemo(
    () => (billing === "yearly" ? "£79.00 / year" : "£9.99 / month"),
    [billing],
  );

  const startCheckout = async (tier: "navigator" | "captain") => {
    setBusy(tier);
    try {
      const r = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tier, billing }),
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
      const r = await fetch("/api/stripe/create-portal-session", {
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

  const current = me?.productTier ?? "day_tripper";

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
              Tripp just got smarter ✨ We&apos;re confirming your subscription…
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
            Yearly (best value)
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
          <h2 className="font-serif text-xl font-semibold text-royal">
            Day Tripper
          </h2>
          <p className="mt-4 font-serif text-3xl font-semibold text-royal">Free</p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Plan one trip at a time, the classic way. No AI — just you and your
            tiles.
          </p>
          <div className="mt-6 flex flex-1 flex-col justify-end">
            {current === "day_tripper" ? (
              <span className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-royal/15 bg-cream px-4 py-2 text-center font-sans text-sm font-semibold text-royal/60">
                Current plan
              </span>
            ) : (
              <Link
                href="/feedback"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-royal/20 bg-white px-4 py-2 text-center font-sans text-sm font-semibold text-royal hover:bg-cream"
              >
                Downgrade via support
              </Link>
            )}
          </div>
        </article>

        <article className="flex flex-col rounded-2xl border border-gold/50 bg-white p-6 shadow-md ring-2 ring-gold/20">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Navigator
          </h2>
          <p className="mt-4 font-serif text-3xl font-semibold text-royal">
            {navigatorPrice}
          </p>
          {billing === "yearly" ? (
            <p className="mt-1 font-sans text-xs text-emerald-700">
              Save vs paying monthly for a year.
            </p>
          ) : null}
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Tripp lends a hand. Five trips at once, full budgets, full checklists,
            14 days free.
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || current === "navigator"}
            onClick={() => void startCheckout("navigator")}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream shadow-sm transition hover:bg-royal/90 disabled:opacity-50"
          >
            {current === "navigator"
              ? "Current plan"
              : busy === "navigator"
                ? "Redirecting…"
                : "Upgrade to Navigator"}
          </button>
        </article>

        <article className="flex flex-col rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">Captain</h2>
          <p className="mt-4 font-serif text-3xl font-semibold text-royal">
            {captainPrice}
          </p>
          {billing === "yearly" ? (
            <p className="mt-1 font-sans text-xs text-emerald-700">
              Best value for frequent planners.
            </p>
          ) : null}
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Tripp at full power. Unlimited trips, early access to new features,
            priority support.
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || current === "captain"}
            onClick={() => void startCheckout("captain")}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-gold px-4 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-50"
          >
            {current === "captain"
              ? "Current plan"
              : busy === "captain"
                ? "Redirecting…"
                : "Upgrade to Captain"}
          </button>
        </article>
      </div>

      <div className="mt-10 rounded-xl border border-royal/10 bg-white/80 p-4">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center justify-between font-sans text-sm font-semibold text-royal"
          onClick={() => setPromoOpen((v) => !v)}
        >
          <span>Have a promo code?</span>
          <span className="text-royal/50">{promoOpen ? "▲" : "▼"}</span>
        </button>
        {promoOpen ? (
          <p className="mt-2 font-sans text-xs text-royal/65">
            Enter <strong>LAUNCH50</strong> on the Stripe Checkout page (after you
            choose a plan) — promotion codes are redeemed there, not on this screen.
          </p>
        ) : null}
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
