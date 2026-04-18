import { PricingClient } from "@/app/(marketing)/pricing/PricingClient";
import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Pricing - TripTiles",
  description:
    "TripTiles subscriptions — Day Tripper, Navigator with Tripp (Haiku), and Captain with Tripp (Sonnet).",
  openGraph: {
    title: "Pricing - TripTiles",
    description:
      "Choose Day Tripper, Navigator, or Captain — Tripp-powered planning for theme park holidays.",
    url: `${siteUrl}/pricing`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - TripTiles",
    description:
      "Choose Day Tripper, Navigator, or Captain — Tripp-powered planning for theme park holidays.",
  },
};

const FAQ = [
  {
    q: "Is this a subscription?",
    a: "Yes — Navigator and Captain renew monthly or yearly until you cancel in the billing portal. Day Tripper stays free.",
  },
  {
    q: "What is the LAUNCH50 code?",
    a: "Enter LAUNCH50 on the Stripe Checkout page for 50% off the first three months (offer ends 30 June 2026).",
  },
  {
    q: "Can I cancel?",
    a: "Yes — use Manage subscription to open the Stripe Customer Portal. If you cancel at period end, you keep paid features until the billing period ends.",
  },
  {
    q: "Do I need an account?",
    a: "Yes — sign in to TripTiles before upgrading so we can link your subscription securely.",
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
  const productTier = await getUserTier(user.id);
  const { data } = await supabase
    .from("profiles")
    .select("stripe_customer_id, tier")
    .eq("id", user.id)
    .maybeSingle();
  return {
    productTier,
    profileTier: String(data?.tier ?? "free"),
    stripeCustomerId: data?.stripe_customer_id ?? null,
  };
}

export default async function PricingPage() {
  const initialMe = await loadInitialMe();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
      <p className="text-center font-sans text-xs font-semibold uppercase tracking-widest text-gold">
        Planning your holiday since April 2026
      </p>
      <h1 className="mt-3 text-center font-serif text-4xl font-semibold tracking-tight text-royal md:text-5xl">
        Pick your perfect plan
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center font-sans text-lg leading-relaxed text-royal/80">
        Subscriptions in GBP — upgrade when you&apos;re ready for Tripp-powered
        Smart Plan.
      </p>

      <div className="mt-12">
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-2xl bg-royal/5" aria-hidden />
          }
        >
          <PricingClient initialMe={initialMe} />
        </Suspense>
      </div>

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
