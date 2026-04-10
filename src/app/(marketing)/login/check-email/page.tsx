import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="max-w-md rounded-2xl border border-royal/10 bg-white/90 p-8 text-center shadow-lg shadow-royal/5 md:p-10">
        <p className="font-serif text-2xl font-semibold text-gold">TripTiles</p>
        <h1 className="mt-6 font-serif text-2xl font-semibold text-royal">
          Check your email
        </h1>
        <p className="mt-4 font-serif text-base leading-relaxed text-royal/80">
          We sent you a magic link. Open it on this device to finish signing in.
        </p>
        <p className="mt-4 font-sans text-sm text-royal/60">
          Didn&apos;t get it? Check spam, or go back and try again.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg border-2 border-royal/30 px-6 py-3 font-serif text-sm font-medium text-royal transition hover:border-gold"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
