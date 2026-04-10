import { Calendar } from "@/components/planner/Calendar";
import { getAllParks } from "@/lib/db/parks";
import { getTripByPublicSlug } from "@/lib/db/trips";
import { legacyDestinationFromRegionId } from "@/lib/legacy-destination";
import type { Destination, Park } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripByPublicSlug(slug);
  if (!trip) return { title: "Trip · TripTiles" };
  return {
    title: `${trip.family_name} — ${trip.adventure_name} · TripTiles`,
    description: "Shared TripTiles calendar (read-only).",
    robots: { index: false, follow: false },
  };
}

function filterParksForTrip(parks: Park[], regionId: string | null): Park[] {
  if (!regionId) return parks;
  const legacy = legacyDestinationFromRegionId(regionId) as Destination;
  return parks.filter((p) => {
    if (p.region_ids?.length) return p.region_ids.includes(regionId);
    return legacy === "custom" || p.destinations.includes(legacy);
  });
}

export default async function PublicTripPage({ params }: Props) {
  const { slug } = await params;
  const trip = await getTripByPublicSlug(slug);
  if (!trip) notFound();

  const parks = filterParksForTrip(await getAllParks(), trip.region_id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-royal/10 bg-white/90 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-gold">
              Shared calendar
            </p>
            <h1 className="font-serif text-2xl font-semibold text-royal">
              {trip.family_name} — {trip.adventure_name}
            </h1>
            <p className="mt-1 font-sans text-sm text-royal/65">
              Read-only view · Times and hours are for planning only — confirm
              with official park schedules.
            </p>
          </div>
          <Link
            href="/login?next=/planner"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream"
          >
            Plan your own trip
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {parks.length === 0 ? (
          <p className="rounded-xl border border-royal/15 bg-white p-6 font-sans text-sm text-royal/75">
            No park tiles are available for this destination in our catalog
            yet. The calendar grid may still show saved assignments.
          </p>
        ) : null}
        <Calendar
          trip={trip}
          parks={parks}
          selectedParkId={null}
          readOnly
          onAssign={() => {}}
          onClear={() => {}}
          onNeedParkFirst={() => {}}
        />
      </main>
    </div>
  );
}
