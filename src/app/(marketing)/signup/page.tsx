import { SignupForm } from "@/components/auth/SignupForm";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create account · TripTiles",
  description: "Create your free TripTiles account and start planning.",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);

  return (
    <main className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <Link
          href="/"
          className="block text-center font-serif text-2xl font-semibold tracking-tight text-gold md:text-3xl"
        >
          TripTiles
        </Link>

        <h1 className="mt-8 text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
          Create your TripTiles account
        </h1>
        <p className="mt-3 text-center font-sans text-sm leading-relaxed text-royal/75">
          Free account. No credit card. Start planning in seconds.
        </p>

        <SignupForm next={next} />

        <p className="mt-6 text-center font-sans text-sm text-royal/70">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-semibold text-royal underline decoration-gold/60 underline-offset-2 hover:text-gold"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-8 text-center font-sans text-sm text-royal/50">
          <Link href="/" className="text-royal underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
