import { TIERS, type Tier } from "@/lib/tiers";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank you - TripTiles",
  description: "Your TripTiles purchase — welcome aboard.",
  robots: { index: false, follow: false },
};

function tierFromQuery(raw: string | string[] | undefined): Tier {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = (v ?? "pro").toLowerCase();
  if (s === "family" || s === "premium" || s === "pro") return s;
  return "pro";
}

export default async function PricingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[] }>;
}) {
  const sp = await searchParams;
  const tierKey = tierFromQuery(sp.tier);
  const name = TIERS[tierKey].name;

  return (
    <div className="flex min-h-screen flex-col bg-cream px-6 py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h1 className="mt-6 font-serif text-3xl font-semibold text-royal">
          Welcome to TripTiles {name}!
        </h1>
        <p className="mt-4 font-sans text-base leading-relaxed text-royal/80">
          Your account has been upgraded. All features are unlocked.
        </p>
        <p className="mt-3 font-sans text-sm text-royal/70">
          Check your email for your receipt and license details from Payhip.
        </p>
        <p className="mt-2 font-sans text-xs text-royal/55">
          If your tier doesn&apos;t update immediately, wait a few seconds —
          Payhip confirms purchases via webhook.
        </p>
        <Link
          href="/planner"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-royal px-8 py-3 font-serif text-base font-semibold text-cream shadow-lg shadow-royal/15 transition hover:bg-royal/90"
        >
          Start planning
        </Link>
      </div>
    </div>
  );
}
