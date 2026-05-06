import {
  PricingClient,
  type CheckoutPriceIds,
} from "@/app/(marketing)/pricing/PricingClient";
import { marketingEyebrow } from "@/components/marketing/marketing-classes";
import { Card } from "@/components/ui/Card";
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
    "TripTiles subscriptions — Free, Pro, and Family plans with Smart Plan for theme park holidays.",
  openGraph: {
    title: "Pricing - TripTiles",
    description:
      "Pick Free, Pro, or Family — Smart Plan helps you build crowd-aware theme park itineraries.",
    url: `${siteUrl}/pricing`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - TripTiles",
    description:
      "Pick Free, Pro, or Family — Smart Plan for theme park holidays.",
  },
};

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes, from Settings. Takes effect at the end of your current billing period.",
  },
  {
    q: "What happens to my trips if I cancel?",
    a: "Your trips remain accessible in read-only mode. Re-subscribe anytime to regain editing and AI features.",
  },
  {
    q: "Can I switch between monthly and annual?",
    a: "Yes, from the customer portal.",
  },
  {
    q: "What is the refund policy?",
    a: (
      <>
        See our{" "}
        <Link href="/terms" className="text-tt-royal underline underline-offset-2">
          terms of service
        </Link>{" "}
        for the full policy — in summary, new subscribers have a 14-day cooling-off period under UK Consumer Contracts Regulations before they start using the service.
      </>
    ),
  },
  {
    q: "What happens if my payment fails?",
    a: "Stripe retries automatically over about 7 days. We email you if the payment cannot be recovered.",
  },
  {
    q: "Do you offer a free trial?",
    a: "The Free tier (1 trip, 5 AI Smart Plan runs) is the trial. Upgrade when you are ready.",
  },
  {
    q: "Who processes payments?",
    a: "Stripe processes card payments. TripTiles never stores your full card number.",
  },
  {
    q: "Is my data safe?",
    a: (
      <>
        We take privacy seriously. Read our{" "}
        <Link href="/privacy" className="text-tt-royal underline underline-offset-2">
          privacy policy
        </Link>{" "}
        for details.
      </>
    ),
  },
];

function checkoutPriceIdsFromEnv(): CheckoutPriceIds {
  return {
    proMonth: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY?.trim() ?? "",
    proYear: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL?.trim() ?? "",
    familyMonth:
      process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY?.trim() ?? "",
    familyYear:
      process.env.NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL?.trim() ?? "",
  };
}

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
  const checkoutPriceIds = checkoutPriceIdsFromEnv();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
      <p className={`text-center ${marketingEyebrow}`}>
        Planning your holiday since April 2026
      </p>
      <h1 className="mt-3 text-center font-heading text-4xl font-semibold tracking-tight text-tt-royal md:text-5xl">
        Pick your perfect plan
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center font-sans text-lg leading-relaxed text-tt-royal/80">
        Cancel anytime. Works on every device.
      </p>

      <div className="mt-12">
        <Suspense
          fallback={
            <div className="h-40 animate-pulse rounded-tt-lg bg-tt-royal-soft/80" aria-hidden />
          }
        >
          <PricingClient initialMe={initialMe} checkoutPriceIds={checkoutPriceIds} />
        </Suspense>
      </div>

      <Card variant="warm" className="mt-16 px-4 py-10 sm:px-8">
        <h2 className="text-center font-heading text-2xl font-semibold text-tt-royal">
          Questions
        </h2>
        <div className="mx-auto mt-8 max-w-2xl space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-tt-md border border-tt-line-soft bg-tt-surface/95 px-4 py-3 shadow-tt-sm"
            >
              <summary className="cursor-pointer font-sans text-sm font-semibold text-tt-royal marker:text-tt-gold">
                {item.q}
              </summary>
              <p className="mt-2 font-sans text-sm leading-relaxed text-tt-royal/75">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Card>

      <p className="mt-12 text-center font-sans text-sm text-tt-royal/70">
        Questions? Email{" "}
        <a
          href="mailto:hello@triptiles.app"
          className="font-semibold text-tt-royal underline underline-offset-2"
        >
          hello@triptiles.app
        </a>
      </p>

      <p className="mt-8 text-center font-sans text-sm text-tt-royal/55">
        <Link href="/" className="text-tt-royal underline underline-offset-2">
          ← Home
        </Link>
      </p>
    </main>
  );
}
