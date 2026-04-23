import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_AUTH_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Forgot password · TripTiles",
  description: "Request an 8-digit code to reset your TripTiles password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={200}
            imgClassName={TRIP_TILES_LOGO_AUTH_IMG_CLASS}
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
          />
        </div>
        <h1 className="mt-8 text-center font-serif text-2xl font-semibold text-royal">
          Reset your password
        </h1>
        <p className="mt-3 text-center font-sans text-sm text-royal/70">
          We&apos;ll email you an 8-digit code to continue.
        </p>
        <Suspense fallback={<div className="mt-8 h-32 animate-pulse rounded-lg bg-royal/10" />}>
          <ForgotPasswordForm />
        </Suspense>
        <p className="mt-8 text-center font-sans text-sm text-royal/50">
          <Link href="/login" className="text-royal underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
