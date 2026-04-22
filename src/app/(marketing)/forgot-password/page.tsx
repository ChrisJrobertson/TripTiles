import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Forgot password · TripTiles",
  description: "Reset your TripTiles password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={72}
            imgClassName="h-[4.5rem] w-auto max-h-[4.5rem] sm:h-20 sm:max-h-20"
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
          />
        </div>
        <h1 className="mt-8 text-center font-serif text-2xl font-semibold text-royal">
          Reset your password
        </h1>
        <p className="mt-3 text-center font-sans text-sm text-royal/70">
          We&apos;ll email you a link to set a new one.
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
