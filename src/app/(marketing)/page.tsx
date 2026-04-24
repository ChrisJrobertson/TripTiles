import { PlannerValueHighlights } from "@/components/marketing/PlannerValueHighlights";
import { TwoPathPlanningSection } from "@/components/marketing/TwoPathPlanningSection";
import { getFeaturedRegions } from "@/lib/db/regions";
import { getFeaturedPublicTrips } from "@/lib/db/trips";
import { getPublicSiteUrl } from "@/lib/site";
import { TIERS } from "@/lib/tiers";
import type { Trip } from "@/lib/types";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const revalidate = 300;

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "TripTiles — Plan your theme park trips in minutes",
  description:
    "Day timelines with clash checks, Smart Plan drafts with your must-dos and dining anchors, and plain-English nudges. PDFs, family sharing, 300+ parks.",
  openGraph: {
    title: "TripTiles — Plan your theme park trips in minutes",
    description:
      "Visual day planning with clash detection, Smart Plan, nudges, and print-ready PDFs for Disney, Universal, and more.",
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
      "One calendar for your trip: Smart Plan, clash-aware timelines, nudges, and PDFs.",
  },
};

const FEATURES_STATIC = [
  {
    icon: "📅",
    title: "Crowd-aware tips",
    body: "Heuristic crowd guidance helps you lean towards quieter days when your date window allows.",
  },
  {
    icon: "📄",
    title: "Beautiful PDFs",
    body: "Export full detail or a clean fridge calendar — your choice.",
  },
  {
    icon: "🌐",
    title: "Community plans",
    body: "Browse public itineraries, open a read-only preview, and clone a copy to edit with the same nudges and checks.",
  },
  {
    icon: "👨‍👩‍👧‍👦",
    title: "Family sharing",
    body: "Invite editors on the Family plan — one shared calendar, everyone aligned.",
  },
  {
    icon: "🌍",
    title: "300+ parks",
    body: "Disney, Universal, Legoland, SeaWorld, and regional favourites — same tools everywhere.",
  },
] as const;

const FAQ = [
  {
    q: "Is this a subscription?",
    a: "Pro and Family are billed monthly or annually through Stripe until you cancel. Free stays free with one trip and Smart Plan limits.",
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
    a: "Smart Plan uses heuristics and your stated preferences — the timeline also surfaces clashes and nudges so you can correct course. Always verify park hours and tickets before you travel.",
  },
  {
    q: "What does the planner check for?",
    a: "The day view flags common problems like overlapping major blocks, back-to-back rope drops, and return-time conflicts when you’ve stacked skip-the-line windows — with short explanations and suggestions.",
  },
  {
    q: "Can I share with my family?",
    a: "Yes. The Family plan includes collaborator invites for up to four family members.",
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

  const features = [
    ...FEATURES_STATIC,
    {
      icon: "💳",
      title: "Fair subscriptions",
      body: `From £${tierPro.monthlyGbp.toFixed(2)} a month on Pro — cancel anytime. Annual plans save up to £${tierFamily.annualSavingsVsMonthlyGbp.toFixed(2)}.`,
    },
  ];

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
              A theme park calendar that flags problems before you land
            </h1>
            <p className="mt-6 max-w-xl font-sans text-lg leading-relaxed text-royal/80">
              Smart Plan drafts from your must-dos and dining anchors, a
              day-by-day timeline with clash checks, and plain-English nudges
              when something won&apos;t work. Free to try, from £
              {tierPro.monthlyGbp.toFixed(2)}/month when you&apos;re ready —
              Disney, Universal, and 300+ parks worldwide.
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
                Community plans
              </Link>
            </div>
            <p className="mt-6 font-sans text-xs text-royal/55">
              Free forever plan · No credit card · 45 destinations · Clone any
              public itinerary into your own planner
            </p>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-royal/15 bg-white shadow-lg">
            <Image
              src="/marketing/hero-planner.png"
              alt="TripTiles planner: calendar with park days, dining slots, stats, and notes"
              width={1024}
              height={484}
              className="h-auto w-full object-cover object-top"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <figcaption className="border-t border-royal/10 bg-cream/95 px-4 py-3 text-center">
              <span className="font-serif text-sm font-semibold uppercase tracking-widest text-gold">
                Planner preview
              </span>
              <p className="mt-2 font-sans text-sm text-royal/60">
                Grid and timeline: drag it yourself, or run Smart Plan — clashes
                and nudges update as you go.
              </p>
            </figcaption>
          </figure>
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
                Drag tiles, or run Smart Plan from crowd patterns, dates, and
                group size — the timeline and nudges help you catch overloaded
                days before you go.
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

      <section className="border-t border-royal/10 bg-cream/40 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            The planner, not just a pretty PDF
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center font-sans text-sm leading-relaxed text-royal/70 md:text-base">
            Everything below is in the app today — the same experience whether
            you start from scratch, use Smart Plan, or clone a community trip.
          </p>
          <PlannerValueHighlights />
        </div>
      </section>

      <section className="border-t border-royal/10 bg-white/50 px-6 py-16 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
            Everything you need
          </h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
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

      <section className="border-t border-royal/10 bg-white/50 px-6 py-16 backdrop-blur-sm">
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
          <p className="mx-auto mt-4 max-w-xl text-center font-sans text-sm leading-relaxed text-royal/75">
            From £{tierPro.monthlyGbp.toFixed(2)} a month. Cancel anytime.
            Annual plans save up to £
            {tierFamily.annualSavingsVsMonthlyGbp.toFixed(2)}. Free
            forever for one trip.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-royal/10 bg-cream p-6 text-center">
              <p className="font-serif text-lg font-semibold text-royal">Free</p>
              <p className="mt-2 font-serif text-3xl text-gold">£0</p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                {tierFree.features.max_trips ?? 1} trip ·{" "}
                {tierFree.features.max_smart_plan_lifetime ?? 5} Smart Plan runs
                total
              </p>
            </div>
            <div className="rounded-2xl border-2 border-gold/50 bg-white p-6 text-center shadow-md">
              <p className="font-sans text-xs font-bold uppercase text-gold">
                Most popular
              </p>
              <p className="mt-1 font-serif text-lg font-semibold text-royal">
                Pro
              </p>
              <p className="mt-2 font-serif text-2xl font-semibold text-gold">
                £{tierPro.annualGbp.toFixed(2)}/year
              </p>
              <p className="mt-1 font-sans text-xs text-royal/60">
                or £{tierPro.monthlyGbp.toFixed(2)}/month
              </p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                Unlimited trips, Smart Plan, and custom tiles
              </p>
            </div>
            <div className="rounded-2xl border border-royal/10 bg-cream p-6 text-center">
              <p className="font-serif text-lg font-semibold text-royal">
                Family
              </p>
              <p className="mt-2 font-serif text-2xl font-semibold text-gold">
                £{tierFamily.annualGbp.toFixed(2)}/year
              </p>
              <p className="mt-1 font-sans text-xs text-royal/60">
                or £{tierFamily.monthlyGbp.toFixed(2)}/month
              </p>
              <p className="mt-3 font-sans text-xs text-royal/70">
                Share planning with family members
              </p>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex font-sans text-sm font-semibold text-royal underline decoration-gold/60 underline-offset-4 hover:text-gold"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-royal/10 bg-white/50 px-6 py-16 backdrop-blur-sm">
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
              Open a read-only preview, then clone — your copy runs on the same
              timeline, nudges, and Smart Plan tools as every other trip.
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
