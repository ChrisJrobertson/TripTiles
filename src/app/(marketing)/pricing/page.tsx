import { TIERS, PUBLIC_TIERS, type Tier } from "@/lib/tiers";
import type { Metadata } from "next";
import Link from "next/link";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Pricing - TripTiles",
  description:
    "One-time pricing for TripTiles — unlimited trips, Smart Plan AI, and Trip Passport. No subscriptions.",
  openGraph: {
    title: "Pricing - TripTiles",
    description:
      "Pick your perfect plan. One-time payment. No subscriptions. Yours forever.",
    url: `${siteUrl}/pricing`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - TripTiles",
    description:
      "Pick your perfect plan. One-time payment. No subscriptions. Yours forever.",
  },
};

const FAQ = [
  {
    q: "Is this a subscription?",
    a: "No. You pay once and keep access forever — no renewals, no surprise charges.",
  },
  {
    q: "What if I don't like it?",
    a: "We offer a 30-day money-back guarantee. Email us and we'll sort it out.",
  },
  {
    q: "Can I upgrade later?",
    a: "Yes. You can upgrade anytime — you'll typically pay the difference between tiers.",
  },
  {
    q: "Do I need an account?",
    a: "Yes — create a free account to start planning. Upgrade when you're ready for more.",
  },
  {
    q: "What happens to my trips if I don't renew?",
    a: "Nothing disappears. There is no renewal — your access is permanent after purchase.",
  },
  {
    q: "Can I share with my family?",
    a: "Family and Premium include sharing trips with up to four family members (sharing features roll out in a future update).",
  },
  {
    q: "Why is Premium worth it?",
    a: "Premium uses Claude Sonnet for noticeably richer itineraries, plus premium PDF layout and priority email support.",
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

function tierCardClass(tier: Tier): string {
  if (tier === "pro") {
    return "border-gold/60 ring-2 ring-gold/25 shadow-lg shadow-royal/10 md:scale-[1.02]";
  }
  if (tier === "premium") {
    return "border-royal/20 bg-gradient-to-b from-white to-cream/90";
  }
  return "border-royal/10";
}

function PriceBlock({ tier }: { tier: Tier }) {
  const cfg = TIERS[tier];
  if (cfg.price_pence === 0) {
    return (
      <p className="mt-4 font-serif text-4xl font-semibold text-royal">Free</p>
    );
  }
  return (
    <p className="mt-4 font-serif text-4xl font-semibold text-royal">
      £{cfg.price_gbp.toFixed(2)}
    </p>
  );
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-20 border-b border-royal/10 bg-cream/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-gold md:text-2xl"
          >
            TripTiles
          </Link>
          <nav className="flex items-center gap-4 font-sans text-sm">
            <Link href="/feedback" className="text-royal/75 hover:text-royal">
              Feedback
            </Link>
            <Link
              href="/login?next=/planner"
              className="font-medium text-royal hover:text-gold"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-14">
        <p className="text-center font-sans text-xs font-semibold uppercase tracking-widest text-gold">
          Planning your holiday since April 2026
        </p>
        <h1 className="mt-3 text-center font-serif text-4xl font-semibold tracking-tight text-royal md:text-5xl">
          Pick your perfect plan
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center font-sans text-lg leading-relaxed text-royal/80">
          One-time payment. No subscriptions. Yours forever.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_TIERS.map((tierKey) => {
            const cfg = TIERS[tierKey];
            const href =
              tierKey === "free" ? "/login?next=/planner" : cfg.payhip_url ?? "/pricing";
            const isPayhip = tierKey !== "free" && cfg.payhip_url;

            return (
              <section
                key={tierKey}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${tierCardClass(tierKey)}`}
              >
                {tierKey === "pro" ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 font-sans text-xs font-semibold text-royal">
                    Most popular
                  </span>
                ) : null}
                {tierKey === "premium" ? (
                  <span className="absolute -top-3 right-4 rounded-full bg-royal px-3 py-0.5 font-sans text-xs font-semibold text-cream">
                    Best value
                  </span>
                ) : null}

                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl font-semibold text-royal">
                    {cfg.name}
                  </h2>
                  <span aria-hidden className="text-xl">
                    {cfg.badge_emoji}
                  </span>
                </div>
                <PriceBlock tier={tierKey} />
                <p className="mt-2 min-h-[3rem] font-sans text-sm text-royal/75">
                  {cfg.description}
                </p>

                <ul className="mt-5 flex-1 space-y-2.5 font-sans text-sm text-royal/85">
                  <li className="flex gap-2">
                    <span className="text-gold">✓</span>
                    {cfg.features.max_trips == null
                      ? "Unlimited trips"
                      : `${cfg.features.max_trips} trip`}
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gold">✓</span>
                    {cfg.features.max_ai_per_trip == null
                      ? "Unlimited AI plans (Smart Plan)"
                      : `${cfg.features.max_ai_per_trip} AI plans per trip`}
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gold">✓</span>
                    All 42 destinations &amp; 351 parks
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gold">✓</span>
                    {cfg.features.max_custom_tiles == null
                      ? "Unlimited custom tiles"
                      : `${cfg.features.max_custom_tiles} custom tiles`}
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gold">✓</span>
                    {cfg.features.pdf_watermark
                      ? "Watermarked PDFs"
                      : "Watermark-free PDFs"}
                  </li>
                  {cfg.features.family_sharing ? (
                    <li className="flex gap-2">
                      <span className="text-gold">✓</span>
                      Share with up to 4 family members
                    </li>
                  ) : null}
                  {cfg.features.ai_model === "claude-sonnet-4-6" ? (
                    <li className="flex gap-2">
                      <span className="text-gold">✓</span>
                      Enhanced AI with Claude Sonnet
                    </li>
                  ) : null}
                  {cfg.features.pdf_design === "premium" ? (
                    <li className="flex gap-2">
                      <span className="text-gold">✓</span>
                      Premium PDF design
                    </li>
                  ) : null}
                  {cfg.features.priority_support ? (
                    <li className="flex gap-2">
                      <span className="text-gold">✓</span>
                      Priority email support
                    </li>
                  ) : null}
                </ul>

                <div className="mt-6">
                  {tierKey === "free" ? (
                    <Link
                      href={href}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-royal/25 bg-white px-4 py-2.5 text-center font-sans text-sm font-semibold text-royal transition hover:bg-cream"
                    >
                      Start planning
                    </Link>
                  ) : isPayhip ? (
                    <a
                      href={cfg.payhip_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-gold px-4 py-2.5 text-center font-sans text-sm font-semibold text-royal shadow-md transition hover:bg-gold/90"
                    >
                      Get {cfg.name} →
                    </a>
                  ) : (
                    <span
                      className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-royal/25 bg-cream/80 px-4 py-2.5 text-center font-sans text-sm text-royal/50"
                      title="Set NEXT_PUBLIC_PAYHIP_*_URL in the host environment."
                    >
                      Checkout link not configured
                    </span>
                  )}
                </div>
              </section>
            );
          })}
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
            href="mailto:hello@triptiles.app"
            className="font-semibold text-royal underline underline-offset-2"
          >
            hello@triptiles.app
          </a>
        </p>

        <p className="mt-8 text-center font-sans text-sm text-royal/55">
          <Link href="/" className="text-royal underline underline-offset-2">
            ← Home
          </Link>
        </p>
      </main>
    </div>
  );
}
