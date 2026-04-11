import { Calendar } from "@/components/planner/Calendar";
import { CopyPlanLinkButton } from "@/components/marketing/CopyPlanLinkButton";
import { PublicPlanActions } from "@/components/marketing/PublicPlanActions";
import { getUserCustomTiles } from "@/lib/db/custom-tiles";
import { getAllParks } from "@/lib/db/parks";
import { getRegionById } from "@/lib/db/regions";
import { incrementPublicTripViewCount } from "@/lib/db/public-trip-stats";
import { getTripByPublicSlug } from "@/lib/db/trips";
import { legacyDestinationFromRegionId } from "@/lib/legacy-destination";
import type { Destination, Park } from "@/lib/types";
import { customTileToPark } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { getCurrentUser } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripByPublicSlug(slug);
  if (!trip) return { title: "Plan · TripTiles" };

  const region = trip.region_id
    ? await getRegionById(trip.region_id)
    : null;
  const dest =
    region?.short_name?.trim() ||
    region?.name?.trim() ||
    "theme parks";
  const dayMs =
    new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime();
  const days = Math.max(1, Math.floor(dayMs / 86400000) + 1);

  const title = `${trip.adventure_name} · TripTiles`;
  const description = `A ${days}-day ${dest} plan from the TripTiles community — open, clone, and make it yours.`;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.triptiles.app";

  return {
    title,
    description,
    openGraph: {
      title: trip.adventure_name,
      description,
      images: [{ url: `${base}/plans/${slug}/opengraph-image` }],
    },
    twitter: {
      card: "summary_large_image",
      title: trip.adventure_name,
      description,
    },
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

function shareUrl(site: string, slug: string) {
  return `${site.replace(/\/$/, "")}/plans/${slug}`;
}

export default async function PublicPlanPage({ params }: Props) {
  const { slug } = await params;
  const trip = await getTripByPublicSlug(slug);
  if (!trip) notFound();

  void incrementPublicTripViewCount(slug);

  const user = await getCurrentUser();
  const isAuthed = Boolean(user);

  const [allParks, ownerCustomTiles, region] = await Promise.all([
    getAllParks(),
    getUserCustomTiles(trip.owner_id),
    trip.region_id ? getRegionById(trip.region_id) : Promise.resolve(null),
  ]);
  const parks: Park[] = [
    ...filterParksForTrip(allParks, trip.region_id),
    ...ownerCustomTiles.map(customTileToPark),
  ];

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.triptiles.app";
  const url = shareUrl(siteUrl, slug);
  const encoded = encodeURIComponent(url);
  const flag = region?.flag_emoji?.trim() || "🗺️";
  const destLabel =
    region?.short_name?.trim() || region?.name?.trim() || "Trip";

  const crowdRaw =
    typeof trip.preferences?.ai_crowd_summary === "string" &&
    trip.preferences.ai_crowd_summary.trim()
      ? trip.preferences.ai_crowd_summary.trim()
      : null;
  const crowd = crowdRaw ? sanitizeDayNote(crowdRaw) : null;

  return (
    <div className="min-h-screen bg-cream">
      <div className="border-b border-royal/10 bg-gold/15 px-4 py-3 text-center font-sans text-sm text-royal">
        <Link
          href="/signup?next=/planner"
          className="font-semibold underline decoration-gold/80"
        >
          Start planning your own trip for free
        </Link>
        <span className="text-royal/70"> — no credit card.</span>
      </div>

      <header className="border-b border-royal/10 bg-white/90 px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-gold">
              Community plan · {destLabel}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-royal md:text-3xl">
              <span className="mr-2" aria-hidden>
                {flag}
              </span>
              {trip.adventure_name}
            </h1>
            <p className="mt-2 font-sans text-sm text-royal/70">
              {trip.start_date} → {trip.end_date} · Family:{" "}
              <span className="text-royal">{trip.family_name}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 font-sans text-xs text-royal/55">
              <span className="rounded-full bg-cream px-2 py-0.5">
                {trip.clone_count ?? 0} clones
              </span>
              <span className="rounded-full bg-cream px-2 py-0.5">
                {trip.view_count ?? 0} views
              </span>
            </div>
            {crowd ? (
              <div
                className="mt-4 rounded-xl border border-gold/35 bg-white px-4 py-3 font-sans text-sm leading-relaxed text-royal/90 shadow-sm"
                role="status"
              >
                <span className="font-semibold text-royal">Crowd strategy — </span>
                {crowd}
              </div>
            ) : null}
          </div>
          <PublicPlanActions
            sourceTripId={trip.id}
            slug={slug}
            isAuthed={isAuthed}
          />
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

        <section className="mt-12 border-t border-royal/10 pt-10">
          <p className="font-sans text-sm font-semibold text-royal">
            Share this plan
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="rounded-lg border border-royal/15 bg-white px-3 py-2 font-sans text-xs font-medium text-royal hover:border-gold/40"
              href={`https://twitter.com/intent/tweet?url=${encoded}`}
              target="_blank"
              rel="noreferrer"
            >
              X / Twitter
            </a>
            <a
              className="rounded-lg border border-royal/15 bg-white px-3 py-2 font-sans text-xs font-medium text-royal hover:border-gold/40"
              href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
              target="_blank"
              rel="noreferrer"
            >
              Facebook
            </a>
            <a
              className="rounded-lg border border-royal/15 bg-white px-3 py-2 font-sans text-xs font-medium text-royal hover:border-gold/40"
              href={`https://wa.me/?text=${encoded}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
            <CopyPlanLinkButton url={url} />
          </div>
        </section>
      </main>
    </div>
  );
}
