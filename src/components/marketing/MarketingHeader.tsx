import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20">
      <div className="border-b border-white/15 bg-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-5xl justify-center px-6 py-4 sm:justify-start">
          <TripTilesLogoLink
            href="/"
            imgClassName="h-24 w-auto max-w-[min(100%,24rem)] sm:h-28 md:h-32"
          />
        </div>
      </div>
      <div className="border-b border-white/10 bg-white/[0.1] px-6 py-2 shadow-[0_1px_0_0_rgba(11,30,92,0.06)] backdrop-blur-2xl backdrop-saturate-150">
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
