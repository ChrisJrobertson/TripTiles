import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_AUTH_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { SignupForm } from "@/components/auth/SignupForm";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create your free TripTiles account — theme park planner with Smart Plan and PDF export.",
  openGraph: {
    title: "Create account · TripTiles",
    description: "Free TripTiles account — no credit card required.",
    url: `${site}/signup`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create account · TripTiles",
  },
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

const logoFocus =
  "inline-flex items-center rounded-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal";

export default async function SignupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);

  return (
    <main className="min-h-screen bg-transparent px-4 py-12">
      <Card
        variant="elevated"
        className="mx-auto w-full max-w-md border border-tt-line/15 bg-tt-surface/92 p-8 shadow-tt-md backdrop-blur-sm md:p-10"
      >
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={200}
            imgClassName={TRIP_TILES_LOGO_AUTH_IMG_CLASS}
            className={logoFocus}
          />
        </div>

        <SectionHeader
          compact
          className="mt-8 flex-col items-center text-center [&>div:first-child]:items-center [&>div:last-child]:w-full [&_p]:mx-auto [&_p]:max-w-md"
          title="Create your TripTiles account"
          subtitle="Free account. No credit card. Start planning in seconds."
        />

        <SignupForm next={next} />

        <p className="mt-8 text-center font-sans text-sm text-tt-ink-soft">
          <Link href="/" className="text-tt-royal underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </Card>
    </main>
  );
}
