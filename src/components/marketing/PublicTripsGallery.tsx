import { computeTripStats } from "@/lib/compute-trip-stats";
import { getAllParks } from "@/lib/db/parks";
import {
  listPublicTrips,
  tripCalendarDayCount,
  type PublicTripLengthBucket,
  type PublicTripListSort,
} from "@/lib/db/trips";
import { getAllRegions, getFeaturedRegions } from "@/lib/db/regions";
import Link from "next/link";

const PAGE_SIZE = 24;

type Props = {
  /** Used for filter and pagination links (`/plans` or `/gallery`). */
  basePath: "/plans" | "/gallery";
  regionFilter: string | null;
  offset: number;
  sort: PublicTripListSort;
  lengthBucket: PublicTripLengthBucket | null;
};

function qs(
  basePath: string,
  parts: Record<string, string | undefined>,
): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(parts)) {
    if (v !== undefined && v !== "") u.set(k, v);
  }
  const s = u.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export async function PublicTripsGallery({
  basePath,
  regionFilter,
  offset,
  sort,
  lengthBucket,
}: Props) {
  const [featuredRegions, trips, allRegions, parks] = await Promise.all([
    getFeaturedRegions(),
    listPublicTrips({
      regionId: regionFilter,
      limit: PAGE_SIZE + 1,
      offset,
      sort,
      lengthBucket,
    }),
    getAllRegions(),
    getAllParks(),
  ]);

  const hasMore = trips.length > PAGE_SIZE;
  const slice = hasMore ? trips.slice(0, PAGE_SIZE) : trips;
  const parkById = new Map(parks.map((p) => [p.id, p]));

  const regionLabels = new Map<string, { flag: string | null; short: string }>();
  for (const r of allRegions) {
    regionLabels.set(r.id, {
      flag: r.flag_emoji,
      short: r.short_name?.trim() || r.name,
    });
  }

  const commonLinkParams = {
    region: regionFilter ?? undefined,
    sort: sort === "clones" ? undefined : sort,
    length: lengthBucket ?? undefined,
  };

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip
          href={qs(basePath, { ...commonLinkParams, region: undefined })}
          label="All destinations"
          active={!regionFilter}
        />
        {featuredRegions.map((r) => (
          <FilterChip
            key={r.id}
            href={qs(basePath, {
              ...commonLinkParams,
              region: r.id,
            })}
            label={r.short_name || r.name}
            active={regionFilter === r.id}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="w-full font-sans text-xs font-semibold text-royal/60 sm:w-auto">
          Trip length
        </span>
        {(
          [
            { id: null as PublicTripLengthBucket | null, label: "Any" },
            { id: "short" as const, label: "1–5 days" },
            { id: "medium" as const, label: "6–10 days" },
            { id: "long" as const, label: "11+ days" },
          ] as const
        ).map(({ id, label }) => (
          <FilterChip
            key={label}
            href={qs(basePath, {
              ...commonLinkParams,
              length: id ?? undefined,
            })}
            label={label}
            active={lengthBucket === id}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="w-full font-sans text-xs font-semibold text-royal/60 sm:w-auto">
          Sort by
        </span>
        {(
          [
            { id: "newest" as const, label: "Newest" },
            { id: "clones" as const, label: "Most cloned" },
            { id: "longest" as const, label: "Most days" },
          ] as const
        ).map(({ id, label }) => (
          <FilterChip
            key={id}
            href={qs(basePath, {
              ...commonLinkParams,
              sort: id === "clones" ? undefined : id,
            })}
            label={label}
            active={sort === id}
          />
        ))}
      </div>

      {slice.length === 0 ? (
        <p className="mt-16 rounded-xl border border-royal/10 bg-white p-10 text-center font-sans text-royal/70">
          No public plans match those filters — try widening your search.
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {slice.map((trip) => {
            const reg = trip.region_id
              ? regionLabels.get(trip.region_id)
              : null;
            const slug = trip.public_slug;
            if (!slug) return null;
            const stats = computeTripStats(trip, parkById);
            const days = tripCalendarDayCount(trip);
            const dest =
              reg?.short ??
              (trip.region_id ? "Holiday" : "Trip");
            const owner =
              typeof trip.gallery_owner_label === "string" &&
              trip.gallery_owner_label.trim()
                ? trip.gallery_owner_label.trim()
                : "TripTiles planner";
            return (
              <li key={trip.id}>
                <article className="flex h-full flex-col rounded-2xl border border-royal/10 bg-white p-5 shadow-sm transition hover:border-gold/40 hover:shadow-md">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wide text-gold">
                    {reg?.flag ? `${reg.flag} ` : ""}
                    {dest}
                  </p>
                  <h2 className="mt-2 font-serif text-lg font-semibold leading-snug text-royal">
                    {trip.adventure_name}
                  </h2>
                  <p className="mt-2 font-sans text-xs text-royal/60">
                    {days} days · {stats.parkDays} park days · {stats.restDays}{" "}
                    rest days
                  </p>
                  <p className="mt-2 font-sans text-xs text-royal/55">
                    By {owner}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 font-sans text-[11px] text-royal/55">
                    <span className="rounded-full bg-cream px-2 py-0.5">
                      {trip.clone_count ?? 0} clones
                    </span>
                    <span className="rounded-full bg-cream px-2 py-0.5">
                      {trip.view_count ?? 0} views
                    </span>
                  </div>
                  <div className="mt-auto flex flex-col gap-2 pt-5">
                    <Link
                      href={`/plans/${slug}`}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-royal/20 bg-white py-2.5 font-sans text-sm font-semibold text-royal transition hover:border-gold/50"
                    >
                      View itinerary →
                    </Link>
                    <Link
                      href={`/plans/${slug}?clone=1`}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-royal py-2.5 font-sans text-sm font-semibold text-gold transition hover:bg-royal/90"
                    >
                      Clone this trip →
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
            href={qs(basePath, {
              ...commonLinkParams,
              offset: String(offset + PAGE_SIZE),
            })}
            className="rounded-lg border border-royal/20 bg-white px-6 py-2.5 font-sans text-sm font-semibold text-royal transition hover:border-gold/50"
          >
            Load more
          </Link>
        </div>
      ) : null}
    </>
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
