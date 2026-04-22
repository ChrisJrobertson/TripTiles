import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import Link from "next/link";

const DEST_LINKS: { label: string; href: string }[] = [
  { label: "Orlando", href: "/plans?region=orlando" },
  { label: "Paris", href: "/plans?region=paris" },
  { label: "Tokyo", href: "/plans?region=tokyo" },
  { label: "London", href: "/plans?region=london" },
  { label: "All destinations", href: "/plans" },
];

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-royal/10 bg-cream px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <TripTilesLogoLink
            href="/"
            height={36}
            imgClassName="h-9 w-auto max-h-9"
            className="inline-flex shrink-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded-sm"
          />
          <p className="mt-2 font-sans text-sm text-royal/70">
            Plan your theme park trips in minutes.
          </p>
        </div>
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/50">
            Product
          </p>
          <ul className="mt-3 space-y-2 font-sans text-sm text-royal/80">
            <li>
              <Link href="/plans" className="hover:text-royal">
                Browse plans
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-royal">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/signup?next=/planner" className="hover:text-royal">
                Sign up
              </Link>
            </li>
            <li>
              <Link href="/login?next=/planner" className="hover:text-royal">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/50">
            Destinations
          </p>
          <ul className="mt-3 space-y-2 font-sans text-sm text-royal/80">
            {DEST_LINKS.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="hover:text-royal">
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/50">
            Legal
          </p>
          <ul className="mt-3 space-y-2 font-sans text-sm text-royal/80">
            <li>
              <Link href="/privacy" className="hover:text-royal">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-royal">
                Terms of service
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-royal">
                Cookie policy
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@triptiles.app"
                className="hover:text-royal"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-5xl border-t border-royal/10 pt-8 text-center">
        <p className="font-sans text-xs text-royal/55">
          © {new Date().getFullYear()} TripTiles. Made in the UK.
        </p>
        <p className="mx-auto mt-3 max-w-2xl font-sans text-[11px] leading-relaxed text-royal/45">
          Affiliate disclosure: we earn commission from Booking.com and
          GetYourGuide when you book through our links, at no extra cost to you.
        </p>
      </div>
    </footer>
  );
}
