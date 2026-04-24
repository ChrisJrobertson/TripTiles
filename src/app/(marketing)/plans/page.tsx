import { PlannerValueHighlights } from "@/components/marketing/PlannerValueHighlights";
import { PublicTripsGallery } from "@/components/marketing/PublicTripsGallery";
import type {
  PublicTripLengthBucket,
  PublicTripListSort,
} from "@/lib/db/trips";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";

export const revalidate = 300;

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Community trip plans",
  description:
    "Browse real family itineraries, preview them in the planner, then clone — your copy includes Smart Plan, clash checks, and nudges on the day timeline.",
  openGraph: {
    title: "Community trip plans · TripTiles",
    description:
      "Open full previews. Clone a plan to edit with the same day timeline, nudges, and Smart Plan tools as any trip you build yourself.",
    url: `${site}/plans`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Community trip plans · TripTiles",
  },
};

function firstParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normaliseSort(raw: string | undefined): PublicTripListSort {
  if (raw === "newest" || raw === "longest") return raw;
  return "clones";
}

function normaliseLength(
  raw: string | undefined,
): PublicTripLengthBucket | null {
  if (raw === "short" || raw === "medium" || raw === "long") return raw;
  return null;
}

export default async function PlansGalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const regionFilter =
    firstParam(sp.region) && firstParam(sp.region) !== "all"
      ? firstParam(sp.region)!
      : null;
  const offset = Math.max(0, Number(firstParam(sp.offset) ?? "0") || 0);
  const sort = normaliseSort(firstParam(sp.sort));
  const lengthBucket = normaliseLength(firstParam(sp.length));

  return (
    <div className="min-h-screen bg-transparent">
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold text-royal md:text-4xl">
          Community plans — see the real planner before you sign up
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-base text-royal/75">
          Every listing opens as a read-only view of the same calendar, day
          timeline, and nudges you get after you start a trip. Clone to edit in
          your account — with clash checks, Smart Plan, and ride- or day-level
          detail.
        </p>
        <div className="mt-8 max-w-3xl">
          <PlannerValueHighlights variant="compact" />
        </div>

        <PublicTripsGallery
          basePath="/plans"
          regionFilter={regionFilter}
          offset={offset}
          sort={sort}
          lengthBucket={lengthBucket}
        />
      </main>
    </div>
  );
}
