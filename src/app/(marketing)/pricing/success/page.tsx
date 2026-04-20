import { getTierConfig } from "@/lib/tiers";
import type { UserTier } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank you - TripTiles",
  description: "Your TripTiles subscription — welcome aboard.",
  robots: { index: false, follow: false },
};

function tierFromQuery(raw: string | string[] | undefined): UserTier {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = (v ?? "pro").toLowerCase();
  if (s === "family") return "family";
  if (s === "pro") return "pro";
  return "pro";
}

export default async function PricingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[]; session_id?: string | string[] }>;
}) {
  const sp = await searchParams;
  const sessionRaw = sp.session_id;
  const sessionId = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw;
  const stripeCheckout = Boolean(sessionId?.trim());
  const tierKey = tierFromQuery(sp.tier);
  const name = getTierConfig(tierKey).name;

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
          Your account has been upgraded. Smart Plan and included features are
          unlocked.
        </p>
        <p className="mt-3 font-sans text-sm text-royal/70">
          {stripeCheckout
            ? "Stripe will email your receipt. If your plan label does not update straight away, wait a few seconds and refresh."
            : "Stripe will email your receipt once checkout completes."}
        </p>
        <p className="mt-2 font-sans text-xs text-royal/55">
          If your tier doesn&apos;t update immediately, wait a few seconds — our
          server confirms subscriptions via Stripe webhook.
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
