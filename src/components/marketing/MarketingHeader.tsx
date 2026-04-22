import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-royal/10 bg-cream/95 px-6 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <TripTilesLogoLink
          href="/"
          height={48}
          imgClassName="h-12 w-auto max-h-[48px]"
        />
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 font-sans text-sm md:gap-x-5">
          <Link href="/plans" className="text-royal/80 hover:text-royal">
            Browse plans
          </Link>
          <Link href="/pricing" className="text-royal/80 hover:text-royal">
            Pricing
          </Link>
          <Link href="/feedback" className="text-royal/80 hover:text-royal">
            Feedback
          </Link>
          <Link
            href="/login?next=/planner"
            className="font-medium text-royal hover:text-gold"
          >
            Sign in
          </Link>
          <Link
            href="/signup?next=/planner"
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 py-2 font-sans text-sm font-semibold text-royal shadow-sm transition hover:opacity-95"
          >
            Sign up free
          </Link>
        </nav>
      </div>
    </header>
  );
}
