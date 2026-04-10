"use client";

import { SignOutButton } from "@/components/auth/SignOutButton";
import type { UserTier } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/planner", label: "Planner" },
  { href: "/achievements", label: "Passport" },
] as const;

function tierLabel(tier: UserTier | null): string {
  if (tier == null || tier === "free") return "Free";
  if (tier === "pro") return "Pro";
  if (tier === "family") return "Family";
  if (tier === "premium") return "Premium";
  if (tier === "concierge") return "Concierge";
  return "Pro+";
}

export function AppNavHeader({
  userEmail,
  userTier,
  tripCount,
  freeTripLimit,
}: {
  userEmail: string;
  userTier: UserTier | null;
  tripCount: number;
  freeTripLimit: number;
}) {
  const pathname = usePathname();
  const isFree = userTier == null || userTier === "free";

  return (
    <header className="sticky top-0 z-30 border-b border-royal/10 bg-cream/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/planner"
            className="font-serif text-lg font-semibold text-gold transition hover:text-gold/90"
          >
            TripTiles
          </Link>
          <nav
            className="flex flex-wrap items-center gap-1"
            aria-label="Main"
          >
            {NAV.map(({ href, label }) => {
              const active =
                pathname === href || pathname?.startsWith(`${href}/`);
              return active ? (
                <span
                  key={href}
                  className="rounded-full bg-royal/10 px-3 py-1 font-sans text-sm font-medium text-royal"
                  aria-current="page"
                >
                  {label}
                </span>
              ) : (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <span className="hidden h-4 w-px bg-royal/15 sm:block" aria-hidden />
          <Link
            href="/pricing"
            className="font-sans text-sm font-medium text-royal/60 hover:text-royal"
          >
            Pricing
          </Link>
          <Link
            href="/feedback"
            className="font-sans text-sm font-medium text-royal/60 hover:text-royal"
          >
            Feedback
          </Link>
          <span
            className="hidden rounded-full border border-royal/15 bg-white/80 px-2.5 py-0.5 font-sans text-xs font-medium text-royal/75 sm:inline"
            title="Your plan"
          >
            {tierLabel(userTier)}
            {isFree ? (
              <>
                {" "}
                · {tripCount}/{freeTripLimit} trip
                {freeTripLimit === 1 ? "" : "s"}
              </>
            ) : null}
          </span>
          {isFree ? (
            <Link
              href="/pricing"
              className="font-sans text-xs font-semibold text-gold underline-offset-2 hover:underline"
            >
              Upgrade
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className="font-sans text-sm text-royal/70">{userEmail}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
