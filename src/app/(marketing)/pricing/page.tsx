import {
  getAllPayhipCheckoutUrls,
  hasPayhipCheckoutConfigured,
  payhipEnvKeyForPlan,
  type PayhipPlanKey,
} from "@/lib/pricing/payhip";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing · TripTiles",
  description:
    "TripTiles Pro — unlimited trips, higher Smart Plan limits, and premium AI when you need it.",
};

const PLANS: {
  key: PayhipPlanKey;
  name: string;
  blurb: string;
  bullets: string[];
}[] = [
  {
    key: "pro",
    name: "TripTiles Pro",
    blurb: "For families who plan multiple holidays a year.",
    bullets: [
      "Unlimited trips",
      "Higher Smart Plan (AI) limits",
      "Full Trip Passport stamps",
    ],
  },
  {
    key: "family",
    name: "Family",
    blurb: "More room for larger groups and longer itineraries.",
    bullets: ["Everything in Pro", "Tuned for bigger parties", "Priority feature access"],
  },
  {
    key: "premium",
    name: "Premium",
    blurb: "Best models and concierge-style planning support.",
    bullets: ["Premium AI models where available", "Maximum Smart Plan headroom"],
  },
];

function CheckoutLink({
  planKey,
  href,
  children,
}: {
  planKey: PayhipPlanKey;
  href: string | null;
  children: ReactNode;
}) {
  const envName = payhipEnvKeyForPlan(planKey);

  if (!href) {
    return (
      <span
        className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-royal/25 bg-cream/80 px-4 py-2.5 text-center font-sans text-sm font-medium text-royal/50"
        title={`Host: set ${envName} in .env.local to your Payhip product link.`}
      >
        Checkout link not configured
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-royal px-4 py-2.5 text-center font-sans text-sm font-semibold text-cream shadow-md transition hover:bg-royal/90"
    >
      {children}
    </a>
  );
}

export default function PricingPage() {
  const urls = getAllPayhipCheckoutUrls();
  const configured = hasPayhipCheckoutConfigured();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-20 border-b border-royal/10 bg-cream/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
        <p className="text-center font-sans text-xs font-semibold uppercase tracking-widest text-gold">
          Simple pricing
        </p>
        <h1 className="mt-3 text-center font-serif text-4xl font-semibold tracking-tight text-royal md:text-5xl">
          Plan trips like a pro
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center font-sans text-base leading-relaxed text-royal/75">
          Start free with one trip. Upgrade when you want unlimited trips,
          more Smart Plan generations, and the full Trip Passport experience.
        </p>

        {!configured ? (
          <p
            className="mx-auto mt-6 max-w-xl rounded-xl border border-gold/30 bg-white/90 px-4 py-3 text-center font-sans text-sm text-royal/80"
            role="status"
          >
            <strong className="font-semibold text-royal">Host setup:</strong> add
            your Payhip product URLs to{" "}
            <code className="rounded bg-cream px-1 text-xs">
              NEXT_PUBLIC_PAYHIP_*_URL
            </code>{" "}
            in <code className="rounded bg-cream px-1 text-xs">.env.local</code>{" "}
            — buttons below activate automatically.
          </p>
        ) : null}

        <div className="mt-12 overflow-x-auto rounded-2xl border border-royal/10 bg-white shadow-sm">
          <table className="w-full min-w-[40rem] border-collapse text-left font-sans text-sm">
            <caption className="sr-only">
              Feature comparison by tier
            </caption>
            <thead>
              <tr className="border-b border-royal/10 bg-cream/90">
                <th className="p-3 font-semibold text-royal">Feature</th>
                <th className="p-3 font-medium text-royal/80">Free</th>
                <th className="p-3 font-medium text-royal/80">Pro</th>
                <th className="p-3 font-medium text-royal/80">Family</th>
                <th className="p-3 font-medium text-royal/80">Premium</th>
              </tr>
            </thead>
            <tbody className="text-royal/85">
              <tr className="border-b border-royal/5">
                <td className="p-3 font-medium text-royal">Trips</td>
                <td className="p-3">1</td>
                <td className="p-3">Unlimited</td>
                <td className="p-3">Unlimited</td>
                <td className="p-3">Unlimited</td>
              </tr>
              <tr className="border-b border-royal/5">
                <td className="p-3 font-medium text-royal">
                  Smart Plan (AI) per trip
                </td>
                <td className="p-3">5 generations</td>
                <td className="p-3">Higher limits</td>
                <td className="p-3">Higher limits</td>
                <td className="p-3">Highest + premium models</td>
              </tr>
              <tr className="border-b border-royal/5">
                <td className="p-3 font-medium text-royal">Trip Passport</td>
                <td className="p-3">✓</td>
                <td className="p-3">✓</td>
                <td className="p-3">✓</td>
                <td className="p-3">✓</td>
              </tr>
              <tr className="border-b border-royal/5">
                <td className="p-3 font-medium text-royal">Share read-only link</td>
                <td className="p-3">✓</td>
                <td className="p-3">✓</td>
                <td className="p-3">✓</td>
                <td className="p-3">✓</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-royal">Typical AI model</td>
                <td className="p-3">Haiku-class</td>
                <td className="p-3">Haiku-class</td>
                <td className="p-3">Haiku-class</td>
                <td className="p-3">Sonnet-class where used</td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-royal/10 px-4 py-2 font-sans text-xs text-royal/55">
            Exact limits match what the app enforces in code; Smart Plan also
            depends on Anthropic availability.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <section
              key={plan.key}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.key === "pro"
                  ? "border-gold/50 ring-2 ring-gold/20 md:scale-[1.02]"
                  : "border-royal/10"
              }`}
            >
              <h2 className="font-serif text-xl font-semibold text-royal">
                {plan.name}
              </h2>
              <p className="mt-2 font-sans text-sm text-royal/70">{plan.blurb}</p>
              <ul className="mt-4 flex-1 space-y-2 font-sans text-sm text-royal/85">
                {plan.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-gold" aria-hidden>
                      ✓
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CheckoutLink planKey={plan.key} href={urls[plan.key]}>
                  {plan.key === "pro" ? "Get Pro" : `Choose ${plan.name}`}
                </CheckoutLink>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-royal/10 bg-white/80 px-6 py-8">
          <h2 className="text-center font-serif text-xl font-semibold text-royal">
            Free
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center font-sans text-sm text-royal/75">
            One active trip, Smart Plan with generous limits to try the product,
            and Trip Passport stamps for milestones. No card required.
          </p>
        </div>

        <p className="mt-10 text-center font-sans text-sm text-royal/55">
          <Link href="/" className="text-royal underline underline-offset-2">
            ← Home
          </Link>
        </p>
      </main>
    </div>
  );
}
