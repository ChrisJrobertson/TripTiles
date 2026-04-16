"use client";

import { SignOutButton } from "@/components/auth/SignOutButton";
import type { UserTier } from "@/lib/types";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type NavProps = {
  userEmail: string;
  userTier: UserTier | null;
  /** When true, the profile tier could not be loaded — do not show Free or Upgrade. */
  tierLoadError?: boolean;
  tripCount: number;
  freeTripLimit: number;
};

function tierLabel(tier: UserTier | null, tierLoadError: boolean): string {
  if (tierLoadError) return "Plan unknown";
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

function mobileNavLinkClass(active: boolean) {
  return active
    ? "block rounded-full bg-royal/10 px-3 py-2 font-sans text-sm font-medium text-royal"
    : "block rounded-full px-3 py-2 font-sans text-sm font-medium text-royal/80 hover:bg-royal/10";
}

function AppNavHeaderFallback({
  userEmail,
  userTier,
  tierLoadError = false,
  tripCount,
  freeTripLimit,
}: NavProps) {
  const isFree =
    !tierLoadError && (userTier == null || userTier === "free");
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
          <details className="relative sm:hidden">
            <summary className="list-none cursor-pointer rounded-full border border-royal/20 bg-white/90 px-3 py-1.5 font-sans text-sm font-semibold text-royal shadow-sm [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav
              className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-royal/15 bg-cream p-2 shadow-xl"
              aria-label="Main mobile"
            >
              <ul className="flex flex-col gap-0.5">
                <li>
                  <Link href="/planner" className={mobileNavLinkClass(false)}>
                    Planner
                  </Link>
                </li>
                <li>
                  <Link
                    href="/planner?tab=budget"
                    className={mobileNavLinkClass(false)}
                  >
                    Budget
                  </Link>
                </li>
                <li>
                  <Link
                    href="/planner?tab=checklist"
                    className={mobileNavLinkClass(false)}
                  >
                    Checklist
                  </Link>
                </li>
                <li>
                  <Link href="/achievements" className={mobileNavLinkClass(false)}>
                    Passport
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className={mobileNavLinkClass(false)}>
                    Settings
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className={mobileNavLinkClass(false)}>
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/feedback" className={mobileNavLinkClass(false)}>
                    Feedback
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
          <nav
            className="hidden flex-wrap items-center gap-1 sm:flex"
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
            className="hidden font-sans text-sm font-medium text-royal/60 hover:text-royal sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/feedback"
            className="hidden font-sans text-sm font-medium text-royal/60 hover:text-royal sm:inline"
          >
            Feedback
          </Link>
          <span
            className="hidden rounded-full border border-royal/15 bg-white/80 px-2.5 py-0.5 font-sans text-xs font-medium text-royal/75 sm:inline"
            title="Your plan"
          >
            {tierLabel(userTier, tierLoadError)}
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
              className="hidden rounded-full bg-gold/90 px-3 py-1 font-sans text-xs font-semibold text-royal shadow-sm transition hover:bg-gold sm:inline-flex"
            >
              Upgrade
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span
            className="max-w-[min(100%,14rem)] truncate font-sans text-sm text-royal/70"
            title={userEmail}
          >
            {userEmail}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

function AppNavHeaderInner({
  userEmail,
  userTier,
  tierLoadError = false,
  tripCount,
  freeTripLimit,
}: NavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFree =
    !tierLoadError && (userTier == null || userTier === "free");
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
  const passportActive =
    pathname === "/achievements" || pathname?.startsWith("/achievements/");
  const settingsActive =
    pathname === "/settings" || pathname?.startsWith("/settings/");

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
          <details className="relative sm:hidden">
            <summary className="list-none cursor-pointer rounded-full border border-royal/20 bg-white/90 px-3 py-1.5 font-sans text-sm font-semibold text-royal shadow-sm [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav
              className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-royal/15 bg-cream p-2 shadow-xl"
              aria-label="Main mobile"
            >
              <ul className="flex flex-col gap-0.5">
                <li>
                  <Link
                    href={plannerHomeHref}
                    className={mobileNavLinkClass(plannerHomeActive)}
                    aria-current={plannerHomeActive ? "page" : undefined}
                  >
                    Planner
                  </Link>
                </li>
                <li>
                  <Link
                    href={budgetHref}
                    className={mobileNavLinkClass(budgetActive)}
                    aria-current={budgetActive ? "page" : undefined}
                  >
                    Budget
                  </Link>
                </li>
                <li>
                  <Link
                    href={checklistHref}
                    className={mobileNavLinkClass(checklistActive)}
                    aria-current={checklistActive ? "page" : undefined}
                  >
                    Checklist
                  </Link>
                </li>
                <li>
                  <Link
                    href="/achievements"
                    className={mobileNavLinkClass(passportActive)}
                    aria-current={passportActive ? "page" : undefined}
                  >
                    Passport
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings"
                    className={mobileNavLinkClass(settingsActive)}
                    aria-current={settingsActive ? "page" : undefined}
                  >
                    Settings
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className={mobileNavLinkClass(false)}>
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/feedback" className={mobileNavLinkClass(false)}>
                    Feedback
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
          <nav
            className="hidden flex-wrap items-center gap-1 sm:flex"
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
            {passportActive ? (
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
            {settingsActive ? (
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
            className="hidden font-sans text-sm font-medium text-royal/60 hover:text-royal sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/feedback"
            className="hidden font-sans text-sm font-medium text-royal/60 hover:text-royal sm:inline"
          >
            Feedback
          </Link>
          <span
            className="hidden rounded-full border border-royal/15 bg-white/80 px-2.5 py-0.5 font-sans text-xs font-medium text-royal/75 sm:inline"
            title="Your plan"
          >
            {tierLabel(userTier, tierLoadError)}
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
              className="hidden rounded-full bg-gold/90 px-3 py-1 font-sans text-xs font-semibold text-royal shadow-sm transition hover:bg-gold sm:inline-flex"
            >
              Upgrade
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span
            className="max-w-[min(100%,14rem)] truncate font-sans text-sm text-royal/70"
            title={userEmail}
          >
            {userEmail}
          </span>
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
