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
  title: "Trip ideas gallery",
  description:
    "Browse public family itineraries for theme park holidays. Clone any plan to start yours.",
  openGraph: {
    title: "Trip ideas gallery · TripTiles",
    description:
      "Public itineraries from the TripTiles community — inspiration you can clone.",
    url: `${site}/gallery`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trip ideas gallery · TripTiles",
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

export default async function GalleryPage({
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
    <div className="min-h-screen bg-cream">
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold text-royal md:text-4xl">
          Trip ideas gallery
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-base text-royal/75">
          Every plan here was shared on purpose by its owner — browse for
          inspiration, then clone to your account and make it yours.
        </p>

        <PublicTripsGallery
          basePath="/gallery"
          regionFilter={regionFilter}
          offset={offset}
          sort={sort}
          lengthBucket={lengthBucket}
        />
      </main>
    </div>
  );
}
