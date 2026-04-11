import { getAllRegions } from "@/lib/db/regions";
import { getFeaturedPublicTrips } from "@/lib/db/trips";
import type { Trip } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "TripTiles — Visual theme park trip planner",
  description:
    "Plan your theme park holiday on one calendar — parks, dining, Smart Plan AI, and Trip Passport stamps.",
};

export default async function MarketingHomePage() {
  let featuredTrips: Trip[] = [];
  try {
    featuredTrips = await getFeaturedPublicTrips(6);
  } catch {
    featuredTrips = [];
  }
  const allRegions = await getAllRegions().catch(() => []);
  const regionById = new Map(allRegions.map((r) => [r.id, r]));

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-20 border-b border-royal/10 bg-cream/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link
            href="/"
            className="font-serif text-xl font-semibold tracking-tight text-gold md:text-2xl"
          >
            TripTiles
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 font-sans text-sm">
            <Link href="/plans" className="text-royal/80 hover:text-royal">
              Browse plans
            </Link>
            <Link href="/pricing" className="text-royal/80 hover:text-royal">
              Pricing
            </Link>
            <Link href="/feedback" className="text-royal/80 hover:text-royal">
              Feedback
            </Link>
            <Link
              href="/signup?next=/planner"
              className="font-medium text-royal hover:text-gold"
            >
              Sign up
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

      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-40"
            style={{
              backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -20%, rgba(201, 169, 97, 0.25), transparent),
                radial-gradient(ellipse 60% 40% at 100% 50%, rgba(11, 30, 92, 0.06), transparent)`,
            }}
            aria-hidden
          />
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Theme park trips, visually planned
            </p>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight tracking-tight text-royal md:text-5xl md:leading-tight">
              See your whole holiday on one calendar
            </h1>
            <p className="mx-auto mt-6 max-w-xl font-sans text-lg leading-relaxed text-royal/80">
              Drag parks, meals, and rest days onto your stay — then let Smart
              Plan suggest a crowd-aware itinerary. Collect stamps in your Trip
              Passport as you plan.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login?next=/planner"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-royal px-8 py-3 font-serif text-base font-semibold text-cream shadow-lg shadow-royal/20 transition hover:bg-royal/90"
              >
                Start planning — free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-royal/25 bg-white px-6 py-3 font-sans text-sm font-semibold text-royal transition hover:bg-cream"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>

        {featuredTrips.length > 0 ? (
          <section className="border-t border-royal/10 bg-white/70 px-6 py-16">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
                Loved by families
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-center font-sans text-sm text-royal/75">
                Real itineraries shared by the community. Open a plan or clone
                it into your account.
              </p>
              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredTrips.map((trip) => {
                  const slug = trip.public_slug;
                  if (!slug) return null;
                  const reg = trip.region_id
                    ? regionById.get(trip.region_id)
                    : null;
                  return (
                    <li key={trip.id}>
                      <Link
                        href={`/plans/${slug}`}
                        className="block h-full rounded-2xl border border-royal/10 bg-cream p-5 text-left shadow-sm transition hover:border-gold/40 hover:shadow-md"
                      >
                        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-gold">
                          {(reg?.flag_emoji ?? "").trim()}{" "}
                          {reg?.short_name?.trim() || reg?.name || "Trip"}
                        </p>
                        <p className="mt-2 font-serif text-lg font-semibold text-royal">
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
                  See all community plans
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-royal/10 bg-white/60 px-6 py-16">
          <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4 md:gap-8">
            {[
              {
                step: "1",
                title: "Create your trip",
                body: "Dates, destination, and who’s travelling — set it up in the wizard in a minute.",
              },
              {
                step: "2",
                title: "Fill your calendar",
                body: "Pick parks and dining from your palette. Your plan saves as you go.",
              },
              {
                step: "3",
                title: "Smart Plan (optional)",
                body: "Generate an AI draft that respects arrival day, cruise nights, and crowd hints.",
              },
              {
                step: "4",
                title: "Export & book",
                body: "📄 Export beautiful PDFs — watermarked on Free, premium design on Premium. Book hotels and experiences through partner links that support TripTiles.",
              },
            ].map((item) => (
              <div key={item.step} className="text-left">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 font-sans text-sm font-bold text-royal">
                  {item.step}
                </span>
                <h2 className="mt-4 font-serif text-xl font-semibold text-royal">
                  {item.title}
                </h2>
                <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-gold/35 bg-white px-8 py-10 text-center shadow-sm">
            <h2 className="font-serif text-2xl font-semibold text-royal">
              Built for friends &amp; family first
            </h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
              We&apos;re polishing the experience before a wider launch. If
              something breaks or feels unclear, we want to know — it helps
              everyone.
            </p>
            <Link
              href="/feedback"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-royal/20 bg-cream px-6 py-2.5 font-sans text-sm font-semibold text-royal transition hover:border-gold/50"
            >
              Send feedback
            </Link>
          </div>
        </section>

        <footer className="mt-auto border-t border-royal/10 bg-cream px-6 py-10">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 sm:flex-row">
            <span className="font-serif text-lg font-semibold text-gold">
              TripTiles
            </span>
            <div className="flex flex-wrap justify-center gap-6 font-sans text-sm text-royal/70">
              <Link href="/plans" className="hover:text-royal">
                Browse plans
              </Link>
              <Link href="/pricing" className="hover:text-royal">
                Pricing
              </Link>
              <Link href="/feedback" className="hover:text-royal">
                Feedback
              </Link>
              <Link href="/signup?next=/planner" className="hover:text-royal">
                Sign up
              </Link>
              <Link href="/login?next=/planner" className="hover:text-royal">
                Sign in
              </Link>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-5xl text-center font-sans text-xs text-royal/45">
            Smart Plan uses AI; always double-check times and park hours before
            you travel.
          </p>
        </footer>
      </main>
    </div>
  );
}
