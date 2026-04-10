import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="flex items-center justify-between border-b border-royal/10 px-6 py-4">
        <span className="font-serif text-xl font-semibold text-royal">
          TripTiles
        </span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 font-serif text-sm font-medium text-royal transition hover:bg-royal/5"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-royal px-4 py-2 font-serif text-sm font-medium text-cream transition hover:bg-royal/90"
          >
            Start planning
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
        </div>
      </main>
    </div>
  );
}
