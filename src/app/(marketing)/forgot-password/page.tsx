import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_AUTH_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Forgot password · TripTiles",
  description: "Request an 8-digit code to reset your TripTiles password.",
};

const logoFocus =
  "inline-flex items-center rounded-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal";

export default function ForgotPasswordPage() {
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
          className="mt-8 flex-col items-center text-center [&>div]:items-center"
          title="Reset your password"
          subtitle="We&apos;ll email you an 8-digit code to continue."
        />
        <Suspense
          fallback={
            <div className="mt-8 h-32 animate-pulse rounded-tt-lg bg-tt-bg-soft" />
          }
        >
          <ForgotPasswordForm />
        </Suspense>
        <p className="mt-8 text-center font-sans text-sm text-tt-ink-soft">
          <Link
            href="/login"
            className="text-tt-royal underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
