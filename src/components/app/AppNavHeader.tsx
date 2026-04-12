"use client";

import { SignOutButton } from "@/components/auth/SignOutButton";
import type { UserTier } from "@/lib/types";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type NavProps = {
  userEmail: string;
  userTier: UserTier | null;
  tripCount: number;
  freeTripLimit: number;
};

function tierLabel(tier: UserTier | null): string {
  if (tier == null || tier === "free") return "Free";
  if (tier === "pro") return "Pro";
  if (tier === "family") return "Family";
  if (tier === "premium") return "Premium";
  if (tier === "concierge") return "Concierge";
  return "Pro+";
}

function plannerHrefPreservingQuery(
  searchParams: URLSearchParams,
  tab: "planner" | "budget" | "checklist",
): string {
  const next = new URLSearchParams(searchParams.toString());
  if (tab === "planner") next.delete("tab");
  else next.set("tab", tab);
  const q = next.toString();
  return q ? `/planner?${q}` : "/planner";
}

function AppNavHeaderFallback({
  userEmail,
  userTier,
  tripCount,
  freeTripLimit,
}: NavProps) {
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
            <Link
              href="/planner"
              className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
            >
              Planner
            </Link>
            <Link
              href="/planner?tab=budget"
              className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
            >
              Budget
            </Link>
            <Link
              href="/planner?tab=checklist"
              className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
            >
              Checklist
            </Link>
            <Link
              href="/achievements"
              className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
            >
              Passport
            </Link>
            <Link
              href="/settings"
              className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
            >
              Settings
            </Link>
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
              className="rounded-full bg-gold/90 px-3 py-1 font-sans text-xs font-semibold text-royal shadow-sm transition hover:bg-gold"
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

function AppNavHeaderInner({
  userEmail,
  userTier,
  tripCount,
  freeTripLimit,
}: NavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFree = userTier == null || userTier === "free";
  const onPlanner = pathname === "/planner";
  const tabRaw = searchParams.get("tab");
  const tab =
    tabRaw === "budget" || tabRaw === "checklist" ? tabRaw : "planner";

  const plannerHomeHref = onPlanner
    ? plannerHrefPreservingQuery(searchParams, "planner")
    : "/planner";
  const budgetHref = onPlanner
    ? plannerHrefPreservingQuery(searchParams, "budget")
    : "/planner?tab=budget";
  const checklistHref = onPlanner
    ? plannerHrefPreservingQuery(searchParams, "checklist")
    : "/planner?tab=checklist";

  const plannerHomeActive = onPlanner && tab === "planner";
  const budgetActive = onPlanner && tab === "budget";
  const checklistActive = onPlanner && tab === "checklist";

  const linkOrCurrent = (
    key: string,
    href: string,
    label: string,
    active: boolean,
  ) =>
    active ? (
      <span
        key={key}
        className="rounded-full bg-royal/10 px-3 py-1 font-sans text-sm font-medium text-royal"
        aria-current="page"
      >
        {label}
      </span>
    ) : (
      <Link
        key={key}
        href={href}
        className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
      >
        {label}
      </Link>
    );

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
            {linkOrCurrent("planner", plannerHomeHref, "Planner", plannerHomeActive)}
            {linkOrCurrent("budget", budgetHref, "Budget", budgetActive)}
            {linkOrCurrent(
              "checklist",
              checklistHref,
              "Checklist",
              checklistActive,
            )}
            {pathname === "/achievements" ||
            pathname?.startsWith("/achievements/") ? (
              <span
                key="passport"
                className="rounded-full bg-royal/10 px-3 py-1 font-sans text-sm font-medium text-royal"
                aria-current="page"
              >
                Passport
              </span>
            ) : (
              <Link
                key="passport"
                href="/achievements"
                className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
              >
                Passport
              </Link>
            )}
            {pathname === "/settings" || pathname?.startsWith("/settings/") ? (
              <span
                key="settings"
                className="rounded-full bg-royal/10 px-3 py-1 font-sans text-sm font-medium text-royal"
                aria-current="page"
              >
                Settings
              </span>
            ) : (
              <Link
                key="settings"
                href="/settings"
                className="rounded-full px-3 py-1 font-sans text-sm font-medium text-royal/70 transition hover:bg-royal/5 hover:text-royal"
              >
                Settings
              </Link>
            )}
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
              className="rounded-full bg-gold/90 px-3 py-1 font-sans text-xs font-semibold text-royal shadow-sm transition hover:bg-gold"
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

export function AppNavHeader(props: NavProps) {
  return (
    <Suspense fallback={<AppNavHeaderFallback {...props} />}>
      <AppNavHeaderInner {...props} />
    </Suspense>
  );
}
