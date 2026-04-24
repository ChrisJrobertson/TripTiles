import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="relative z-20">
      <div className="tt-logo-band border-b border-white/20 bg-transparent">
        <div className="mx-auto flex max-w-5xl justify-center px-6 py-4 sm:justify-start">
          <TripTilesLogoLink
            href="/"
            imgClassName="h-24 w-auto max-w-[min(100%,24rem)] sm:h-28 md:h-32"
          />
        </div>
      </div>
      <div className="tt-nav-band border-b border-white/15 bg-transparent px-6 py-2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-x-4 gap-y-2 font-sans text-sm md:gap-x-5">
          <Link href="/plans" className="text-ink/80 hover:text-ink">
            Browse plans
          </Link>
          <Link href="/pricing" className="text-ink/80 hover:text-ink">
            Pricing
          </Link>
          <Link href="/feedback" className="text-ink/80 hover:text-ink">
            Feedback
          </Link>
          <Link
            href="/login?next=/planner"
            className="font-medium text-ink hover:text-royalSoft"
          >
            Sign in
          </Link>
          <Link
            href="/signup?next=/planner"
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 py-2 font-sans text-sm font-semibold text-ink shadow-sm transition hover:opacity-95"
          >
            Sign up free
          </Link>
        </div>
      </div>
    </header>
  );
}
