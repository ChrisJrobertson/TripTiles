import { TwoPathPlanningSection } from "@/components/marketing/TwoPathPlanningSection";
import { getFeaturedRegions } from "@/lib/db/regions";
import { getFeaturedPublicTrips } from "@/lib/db/trips";
import { getPublicSiteUrl } from "@/lib/site";
import { TIERS } from "@/lib/tiers";
import type { Trip } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 300;

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "TripTiles — Plan your theme park trips in minutes",
  description:
    "Ellie-powered itineraries for Disney, Universal, and 300+ parks worldwide. Beautiful PDFs. Family-friendly pricing.",
  openGraph: {
    title: "TripTiles — Plan your theme park trips in minutes",
    description:
      "Smart Plan itineraries, crowd-aware scheduling, and print-ready PDFs for theme park holidays.",
    url: site,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TripTiles",
    description:
      "Plan theme park trips on one visual calendar — Smart Plan, PDFs, Trip Passport.",
  },
};

const FEATURES = [
  {
    icon: "🤖",
    title: "Ellie-powered planning",
    body: "Ellie drafts a day-by-day plan using crowd patterns and your group.",
  },
  {
    icon: "📅",
    title: "Crowd-aware scheduling",
    body: "Lean towards quieter days for headline parks when your dates allow.",
  },
  {
    icon: "📄",
    title: "Beautiful PDFs",
    body: "Export full detail or a clean fridge calendar — your choice.",
  },
  {
    icon: "👨‍👩‍👧‍👦",
    title: "Family sharing",
    body: "Invite editors on Family and Premium — plan together in one place.",
  },
  {
    icon: "🌍",
    title: "300+ parks",
    body: "Disney, Universal, Legoland, SeaWorld, and regional favourites.",
  },
  {
    icon: "💳",
    title: "One-time pricing",
    body: "No subscriptions — pay once, keep access for that tier forever.",
  },
];

const FAQ = [
  {
    q: "Is this a subscription?",
    a: "No. TripTiles is a one-time purchase per tier. Your access does not expire.",
  },
  {
    q: "Which theme parks are included?",
    a: "We cover Disney, Universal, Legoland, SeaWorld, and hundreds of regional parks across 45 destinations.",
  },
  {
    q: "Do I need to create an account?",
    a: "Yes — a free account saves your trips, achievements, and Smart Plan history.",
  },
  {
    q: "How accurate are Smart Plan drafts?",
    a: "Ellie uses heuristic crowd data — always verify park hours and tickets before you travel.",
  },
  {
    q: "Can I share with my family?",
    a: "Yes. Family and Premium tiers include collaborator invites so you can plan together.",
  },
];

export default async function MarketingHomePage() {
  let featuredTrips: Trip[] = [];
  try {
    featuredTrips = await getFeaturedPublicTrips(6);
  } catch {
    featuredTrips = [];
  }
  const featuredRegions = await getFeaturedRegions().catch(() => []);
  const tierFree = TIERS.free;
  const tierPro = TIERS.pro;
  const tierFamily = TIERS.family;
  const tierPremium = TIERS.premium;

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden px-6 pb-16 pt-12 md:pb-24 md:pt-16">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -20%, rgba(201, 169, 97, 0.25), transparent),
              radial-gradient(ellipse 60% 40% at 100% 50%, rgba(11, 30, 92, 0.06), transparent)`,
          }}
          aria-hidden
        />
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Theme park trips, visually planned
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight text-royal md:text-5xl md:leading-tight">
              Plan your theme park trip in minutes, not hours
            </h1>
            <p className="mt-6 max-w-xl font-sans text-lg leading-relaxed text-royal/80">
              Plan every detail yourself, or let Ellie build your itinerary in
              seconds — then export a beautiful PDF to take with you. Disney,
              Universal, and 300+ parks worldwide. Family-friendly pricing.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/signup?next=/planner"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-8 py-3 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95"
              >
                Start planning free
              </Link>
              <Link
                href="/plans"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-royal/25 bg-white px-6 py-3 font-sans text-sm font-semibold text-royal transition hover:bg-cream"
              >
                See example plans
              </Link>
            </div>
            <p className="mt-6 font-sans text-xs text-royal/55">
              Free forever plan · No credit card · 45 destinations
            </p>
          </div>
          <div
            className="flex min-h-[220px] items-center justify-center rounded-2xl border border-royal/15 bg-royal/5 p-8 text-center shadow-inner md:min-h-[320px]"
            aria-hidden
          >
            <div>
              <p className="font-serif text-sm font-semibold uppercase tracking-widest text-gold">
                Planner preview
              </p>
              <p className="mt-3 font-sans text-sm text-royal/60">
                Drag everything yourself, or tap Smart Plan for a first draft —
                then tweak.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-royal/10 bg-white/80 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center font-sans text-sm text-royal/70">
            Two paths, one calendar — pick what fits your family, then refine
            whenever you like.
          </p>
          <div className="mt-12">
            <TwoPathPlanningSection />
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            <div className="text-center">
              <p className="text-3xl" aria-hidden>
                🌍
              </p>
              <h3 className="mt-3 font-serif text-lg font-semibold text-royal">
                Pick your destination
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                Choose from 45 destinations worldwide — Orlando, Paris, Tokyo,
                Dubai, and more.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl" aria-hidden>
                📅
              </p>
              <h3 className="mt-3 font-serif text-lg font-semibold text-royal">
                Fill your calendar
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                Drag tiles on yourself, or run Smart Plan and let Ellie draft
                days from crowd patterns, your dates, and group size — then edit
                freely.
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl" aria-hidden>
                📄
              </p>
              <h3 className="mt-3 font-serif text-lg font-semibold text-royal">
                Export, share, book
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                Download PDFs, share public plans, and book hotels and experiences
                when partner links are enabled.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-royal/10 bg-cream px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            Everything you need
          </h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-royal/10 bg-white p-5 shadow-sm"
              >
                <p className="text-2xl" aria-hidden>
                  {f.icon}
                </p>
                <h3 className="mt-2 font-serif text-lg font-semibold text-royal">
                  {f.title}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center">
            <Link
              href="/gallery"
              className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-royal underline decoration-gold/50 underline-offset-4 transition hover:text-royal/80"
            >
              Browse trip ideas →
            </Link>
          </p>
        </div>
      </section>

      {featuredRegions.length > 0 ? (
        <section className="border-t border-royal/10 bg-white/70 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
              Featured destinations
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredRegions.slice(0, 8).map((r) => (
                <Link
                  key={r.id}
                  href={`/gallery?region=${encodeURIComponent(r.id)}`}
                  className="rounded-xl border border-royal/10 bg-cream p-4 text-left shadow-sm transition hover:border-gold/50"
                >
                  <span className="text-2xl" aria-hidden>
                    {r.flag_emoji ?? "🗺️"}
                  </span>
                  <p className="mt-2 font-serif text-base font-semibold text-royal">
                    {r.short_name?.trim() || r.name}
                  </p>
                  <p className="mt-1 font-sans text-xs text-royal/55">
                    {r.country}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-royal/10 bg-cream px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-sans text-xs font-semibold uppercase tracking-widest text-gold">
            Beta tester feedback
          </p>
          <h2 className="mt-2 text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            What early planners say
          </h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                quote:
                  "Saved me 10 hours of research for our Disney World trip.",
                who: "Sarah",
                where: "Manchester",
              },
              {
                quote: "The PDF export alone is worth the Pro upgrade.",
                who: "James",
                where: "London",
              },
              {
                quote: "Finally a planner that understands Paris Disneyland.",
                who: "Céline",
                where: "Nice",
              },
            ].map((t) => (
              <li
                key={t.who}
                className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm"
              >
                <p className="text-gold" aria-hidden>
                  ★★★★★
                </p>
                <p className="mt-3 font-sans text-sm leading-relaxed text-royal/85">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-4 font-sans text-xs font-semibold text-royal/60">
                  — {t.who}, {t.where}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-royal/10 bg-white/80 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            Simple pricing
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-royal/10 bg-cream p-6 text-center">
              <p className="font-serif text-lg font-semibold text-royal">Free</p>
              <p className="mt-2 font-serif text-3xl text-gold">£0</p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                {tierFree.features.max_trips ?? 1} trip ·{" "}
                {tierFree.features.max_ai_per_trip ?? 5} Smart Plan runs per trip
              </p>
            </div>
            <div className="rounded-2xl border-2 border-gold/50 bg-white p-6 text-center shadow-md">
              <p className="font-sans text-xs font-bold uppercase text-gold">
                Most popular
              </p>
              <p className="mt-1 font-serif text-lg font-semibold text-royal">
                Pro
              </p>
              <p className="mt-2 font-serif text-3xl text-gold">
                £{tierPro.price_gbp.toFixed(2)}
              </p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                Unlimited trips, Smart Plan, and custom tiles
              </p>
            </div>
            <div className="rounded-2xl border border-royal/10 bg-cream p-6 text-center">
              <p className="font-serif text-lg font-semibold text-royal">
                Family
              </p>
              <p className="mt-2 font-serif text-3xl text-gold">
                £{tierFamily.price_gbp.toFixed(2)}
              </p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                Share planning with family members
              </p>
            </div>
            <div className="rounded-2xl border border-royal/10 bg-cream p-6 text-center">
              <p className="font-serif text-lg font-semibold text-royal">
                Premium
              </p>
              <p className="mt-2 font-serif text-3xl text-gold">
                £{tierPremium.price_gbp.toFixed(2)}
              </p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                Enhanced Smart Plan (Sonnet model)
              </p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex font-sans text-sm font-semibold text-royal underline decoration-gold/60 underline-offset-4 hover:text-gold"
            >
              See full comparison →
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-royal/10 bg-cream px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            FAQ
          </h2>
          <dl className="mt-10 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-serif text-base font-semibold text-royal">
                  {item.q}
                </dt>
                <dd className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {featuredTrips.length > 0 ? (
        <section className="border-t border-royal/10 bg-white/70 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
              From the community
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center font-sans text-sm text-royal/75">
              Real itineraries you can open or clone into your account.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTrips.map((trip) => {
                const slug = trip.public_slug;
                if (!slug) return null;
                return (
                  <li key={trip.id}>
                    <Link
                      href={`/plans/${slug}`}
                      className="block h-full rounded-2xl border border-royal/10 bg-cream p-5 text-left shadow-sm transition hover:border-gold/40 hover:shadow-md"
                    >
                      <p className="font-serif text-lg font-semibold text-royal">
                        {trip.adventure_name}
                      </p>
                      <p className="mt-2 font-sans text-xs text-royal/55">
                        {trip.clone_count ?? 0} clones · {trip.view_count ?? 0}{" "}
                        views
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-10 text-center">
              <Link
                href="/plans"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-royal/20 bg-white px-6 py-2.5 font-sans text-sm font-semibold text-royal transition hover:border-gold/50"
              >
                Browse all plans
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-royal/10 bg-royal px-6 py-16 text-center">
        <h2 className="font-serif text-2xl font-semibold text-cream md:text-3xl">
          Ready when you are
        </h2>
        <Link
          href="/signup?next=/planner"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-10 py-3 font-serif text-base font-semibold text-royal shadow-lg"
        >
          Start planning free
        </Link>
      </section>
    </main>
  );
}
