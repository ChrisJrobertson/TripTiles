import { getAllRegions, getFeaturedRegions } from "@/lib/db/regions";
import { listPublicTrips } from "@/lib/db/trips";
import type { Trip } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Community trip plans · TripTiles",
  description:
    "Browse real family itineraries from the TripTiles community. Clone any plan to start yours.",
};

const PAGE_SIZE = 24;

function tripDayCount(trip: Trip): number {
  const s = new Date(trip.start_date).getTime();
  const e = new Date(trip.end_date).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  return Math.floor((e - s) / 86400000) + 1;
}

export default async function PlansGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; offset?: string }>;
}) {
  const sp = await searchParams;
  const regionFilter =
    sp.region && sp.region !== "all" ? sp.region : null;
  const offset = Math.max(0, Number(sp.offset ?? "0") || 0);

  const [featuredRegions, trips, allRegions] = await Promise.all([
    getFeaturedRegions(),
    listPublicTrips({
      regionId: regionFilter,
      limit: PAGE_SIZE + 1,
      offset,
    }),
    getAllRegions(),
  ]);

  const hasMore = trips.length > PAGE_SIZE;
  const slice = hasMore ? trips.slice(0, PAGE_SIZE) : trips;

  const regionLabels = new Map<string, { flag: string | null; short: string }>();
  for (const r of allRegions) {
    regionLabels.set(r.id, {
      flag: r.flag_emoji,
      short: r.short_name?.trim() || r.name,
    });
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-royal/10 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-serif text-xl font-semibold text-gold">
            TripTiles
          </Link>
          <nav className="flex flex-wrap gap-4 font-sans text-sm text-royal/80">
            <Link href="/plans" className="font-medium text-royal">
              Browse plans
            </Link>
            <Link href="/pricing" className="hover:text-royal">
              Pricing
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

      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold text-royal md:text-4xl">
          Trip plans from the TripTiles community
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-base text-royal/75">
          Browse real family itineraries. Clone any plan to start yours.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <FilterChip
            href="/plans"
            label="All"
            active={!regionFilter}
          />
          {featuredRegions.map((r) => (
            <FilterChip
              key={r.id}
              href={`/plans?region=${encodeURIComponent(r.id)}`}
              label={r.short_name || r.name}
              active={regionFilter === r.id}
            />
          ))}
        </div>

        {slice.length === 0 ? (
          <p className="mt-16 rounded-xl border border-royal/10 bg-white p-10 text-center font-sans text-royal/70">
            No public plans yet — be the first to share!
          </p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {slice.map((trip) => {
              const reg = trip.region_id
                ? regionLabels.get(trip.region_id)
                : null;
              const slug = trip.public_slug;
              if (!slug) return null;
              return (
                <li key={trip.id}>
                  <article className="flex h-full flex-col rounded-2xl border border-royal/10 bg-white p-5 shadow-sm transition hover:border-gold/40 hover:shadow-md">
                    <p className="font-sans text-xs font-semibold uppercase tracking-wide text-gold">
                      {reg?.flag ? `${reg.flag} ` : ""}
                      {reg?.short ?? "Trip"}
                    </p>
                    <h2 className="mt-2 font-serif text-lg font-semibold leading-snug text-royal">
                      {trip.adventure_name}
                    </h2>
                    <p className="mt-2 font-sans text-xs text-royal/60">
                      {trip.start_date} → {trip.end_date} · {tripDayCount(trip)}{" "}
                      days · {trip.adults + trip.children} travellers
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 font-sans text-[11px] text-royal/55">
                      <span className="rounded-full bg-cream px-2 py-0.5">
                        {trip.clone_count ?? 0} clones
                      </span>
                      <span className="rounded-full bg-cream px-2 py-0.5">
                        {trip.view_count ?? 0} views
                      </span>
                    </div>
                    <div className="mt-auto pt-5">
                      <Link
                        href={`/plans/${slug}`}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-royal py-2.5 font-sans text-sm font-semibold text-gold transition hover:bg-royal/90"
                      >
                        View plan →
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore ? (
          <div className="mt-10 flex justify-center">
            <Link
              href={`/plans?${new URLSearchParams({
                ...(regionFilter ? { region: regionFilter } : {}),
                offset: String(offset + PAGE_SIZE),
              }).toString()}`}
              className="rounded-lg border border-royal/20 bg-white px-6 py-2.5 font-sans text-sm font-semibold text-royal transition hover:border-gold/50"
            >
              Load more
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 font-sans text-sm font-medium transition ${
        active
          ? "bg-royal text-cream"
          : "border border-royal/15 bg-white text-royal hover:border-gold/40"
      }`}
    >
      {label}
    </Link>
  );
}
