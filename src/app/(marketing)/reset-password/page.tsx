import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Set new password · TripTiles",
  description: "Choose a new password for your TripTiles account.",
};

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <Link
          href="/"
          className="block text-center font-serif text-2xl font-semibold tracking-tight text-gold md:text-3xl"
        >
          TripTiles
        </Link>
        <p className="mt-8 text-center font-serif text-sm text-royal/70">
          Password reset
        </p>
        <ResetPasswordForm />
        <p className="mt-8 text-center font-sans text-sm text-royal/50">
          <Link href="/login" className="text-royal underline underline-offset-2">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
