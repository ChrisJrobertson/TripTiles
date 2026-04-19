import { PUBLIC_TIERS, TIERS, type PublicTier } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { PricingClient } from "./PricingClient";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Pricing - TripTiles",
  description:
    "TripTiles subscriptions — Free, Pro, and Family with monthly and annual billing.",
  openGraph: {
    title: "Pricing - TripTiles",
    description:
      "Choose Free, Pro, or Family — subscription plans for theme park holidays.",
    url: `${siteUrl}/pricing`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - TripTiles",
    description:
      "Choose Free, Pro, or Family — subscription plans for theme park holidays.",
  },
};

const FAQ = [
  {
    q: "Is this a subscription?",
    a: "Yes. Pro and Family are recurring subscriptions. You can cancel anytime from Settings.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. If you cancel, your paid access stays active until the end of your current billing period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Any payment method supported by Stripe Checkout for your region.",
  },
  {
    q: "Do you offer refunds?",
    a: "We follow our existing refund policy. Contact support and we’ll review your case fairly.",
  },
  {
    q: "What happens if my payment fails?",
    a: "Stripe retries automatically over the following 7 days before access is affected.",
  },
  {
    q: "What if I need to change tiers?",
    a: "Use Manage subscription in Settings to update your plan through the Stripe Customer Portal.",
  },
  {
    q: "Is my data safe?",
    a: (
      <>
        We take privacy seriously. Read our{" "}
        <Link href="/privacy" className="text-royal underline underline-offset-2">
          privacy policy
        </Link>{" "}
        for details.
      </>
    ),
  },
];

async function loadInitialMe() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("tier, tier_expires_at")
    .eq("id", user.id)
    .maybeSingle();
  const rawTier = String((data as { tier?: string } | null)?.tier ?? "free");
  const expiresAt =
    (data as { tier_expires_at?: string | null } | null)?.tier_expires_at ?? null;
  const hasExpired =
    typeof expiresAt === "string" &&
    Number.isFinite(Date.parse(expiresAt)) &&
    Date.parse(expiresAt) <= Date.now();
  const currentTier: PublicTier = hasExpired
    ? "free"
    : rawTier === "pro"
      ? "pro"
      : rawTier === "family" || rawTier === "premium" || rawTier === "concierge"
        ? "family"
        : "free";
  return {
    currentTier,
  };
}

export default async function PricingPage() {
  const initialMe = await loadInitialMe();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
      <h1 className="mt-3 text-center font-serif text-4xl font-semibold tracking-tight text-royal md:text-5xl">
        Plans for every family adventure
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center font-sans text-lg leading-relaxed text-royal/80">
        Cancel anytime. No contract. Works on every device.
      </p>

      <div className="mt-12">
        <PricingClient initialTier={initialMe?.currentTier ?? null} />
      </div>

      <section className="mt-12 overflow-x-auto rounded-2xl border border-royal/10 bg-white p-4 sm:p-6">
        <h2 className="font-serif text-xl font-semibold text-royal">
          Feature comparison
        </h2>
        <table className="mt-4 min-w-[640px] w-full border-collapse font-sans text-sm text-royal">
          <thead>
            <tr className="border-b border-royal/15 text-left">
              <th className="py-2 pr-3">Feature</th>
              {PUBLIC_TIERS.map((tier) => (
                <th key={tier} className="py-2 pr-3">{TIERS[tier].displayName}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-royal/10">
            <tr>
              <td className="py-2 pr-3">Trips</td>
              <td className="py-2 pr-3">1</td>
              <td className="py-2 pr-3">Unlimited</td>
              <td className="py-2 pr-3">Unlimited</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">AI Smart Plan</td>
              <td className="py-2 pr-3">3 lifetime</td>
              <td className="py-2 pr-3">Unlimited</td>
              <td className="py-2 pr-3">Unlimited</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">AI Day Planner (future)</td>
              <td className="py-2 pr-3">No</td>
              <td className="py-2 pr-3">Yes</td>
              <td className="py-2 pr-3">Yes</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Ride priorities per trip</td>
              <td className="py-2 pr-3">5</td>
              <td className="py-2 pr-3">Unlimited</td>
              <td className="py-2 pr-3">Unlimited</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Trip payments tracking</td>
              <td className="py-2 pr-3">3 items</td>
              <td className="py-2 pr-3">Unlimited</td>
              <td className="py-2 pr-3">Unlimited</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Custom tiles</td>
              <td className="py-2 pr-3">5</td>
              <td className="py-2 pr-3">Unlimited</td>
              <td className="py-2 pr-3">Unlimited</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">PDF export</td>
              <td className="py-2 pr-3">Watermarked</td>
              <td className="py-2 pr-3">Clean</td>
              <td className="py-2 pr-3">Clean</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Public sharing + cloning</td>
              <td className="py-2 pr-3">No</td>
              <td className="py-2 pr-3">Yes</td>
              <td className="py-2 pr-3">Yes</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Family sharing</td>
              <td className="py-2 pr-3">No</td>
              <td className="py-2 pr-3">No</td>
              <td className="py-2 pr-3">Up to 4 members</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Smart Plan model</td>
              <td className="py-2 pr-3">Haiku 4.5</td>
              <td className="py-2 pr-3">Haiku 4.5</td>
              <td className="py-2 pr-3">Haiku 4.5</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-16 rounded-2xl border border-royal/10 bg-white/90 px-4 py-10 sm:px-8">
        <h2 className="text-center font-serif text-2xl font-semibold text-royal">
          Questions
        </h2>
        <div className="mx-auto mt-8 max-w-2xl space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-royal/10 bg-cream/60 px-4 py-3"
            >
              <summary className="cursor-pointer font-sans text-sm font-semibold text-royal marker:text-gold">
                {item.q}
              </summary>
              <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-12 text-center font-sans text-sm text-royal/70">
        Questions? Email{" "}
        <a
          href="mailto:hello@triptiles.com"
          className="font-semibold text-royal underline underline-offset-2"
        >
          hello@triptiles.com
        </a>
      </p>

      <p className="mt-8 text-center font-sans text-sm text-royal/55">
        <Link href="/" className="text-royal underline underline-offset-2">
          ← Home
        </Link>
      </p>
    </main>
  );
}
