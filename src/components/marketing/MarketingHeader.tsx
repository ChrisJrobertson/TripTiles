import { Logo } from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/supabase/server";
import Link from "next/link";

const GOLD_CTA_CLASS =
  "inline-flex min-h-9 items-center justify-center rounded-tt-md bg-tt-gold px-4 py-2 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-gold/90";

export async function MarketingHeader() {
  const user = await getCurrentUser();
  const isAuthed = Boolean(user);
  const logoHref = isAuthed ? "/planner" : "/";

  return (
    <header className="relative z-20">
      <div className="tt-logo-band border-b border-tt-line-soft/80 bg-transparent">
        <div className="mx-auto flex max-w-5xl justify-center px-6 py-4 sm:justify-start">
          <Logo
            href={logoHref}
            variant="full"
            sizePreset="marketing"
            aria-label="TripTiles homepage"
            focusVisibleRingOffset="cream"
          />
        </div>
      </div>
      <div className="tt-nav-band border-b border-tt-line-soft/80 bg-transparent px-6 py-2">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-x-4 gap-y-2 font-sans text-sm md:gap-x-5">
          <Link
            href="/plans"
            className="text-tt-ink-muted/90 transition hover:text-tt-royal"
          >
            Browse plans
          </Link>
          <Link
            href="/today-at-park"
            className="text-tt-ink-muted/90 transition hover:text-tt-royal"
          >
            Live waits
          </Link>
          <Link
            href="/pricing"
            className="text-tt-ink-muted/90 transition hover:text-tt-royal"
          >
            Pricing
          </Link>
          <Link
            href="/feedback"
            className="text-tt-ink-muted/90 transition hover:text-tt-royal"
          >
            Feedback
          </Link>
          {isAuthed ? (
            <Link href="/planner" className={GOLD_CTA_CLASS}>
              Open planner
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/planner"
                className="font-medium text-tt-ink-muted transition hover:text-tt-royal"
              >
                Sign in
              </Link>
              <Link href="/signup?next=/planner" className={GOLD_CTA_CLASS}>
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
