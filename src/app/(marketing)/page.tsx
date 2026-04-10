import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-royal/10 bg-cream/95 px-6 py-4 backdrop-blur-sm">
        <Link
          href="/"
          className="font-serif text-xl font-semibold tracking-tight text-gold md:text-2xl"
        >
          TripTiles
        </Link>
        <nav>
          <Link
            href="/login"
            className="font-serif text-sm font-medium text-royal transition hover:text-gold"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-xl text-center">
          <p className="font-serif text-4xl font-semibold tracking-tight text-royal md:text-5xl">
            TripTiles
          </p>
          <p className="mt-4 font-serif text-lg text-royal/80">coming soon</p>
          <div
            className="mx-auto mt-10 h-1 w-24 rounded-full bg-gold"
            aria-hidden
          />
          <Link
            href="/login"
            className="mt-12 inline-flex min-h-12 items-center justify-center rounded-lg bg-royal px-8 py-3 font-serif text-base font-semibold text-cream shadow-md transition hover:bg-royal/90"
          >
            Start planning - it&apos;s free →
          </Link>
        </div>
      </main>
    </div>
  );
}
