"use client";

import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { formatProductTierName } from "@/lib/product-tier-labels";
import { normalizeToRetailTier } from "@/lib/tiers";
import type { UserTier } from "@/lib/types";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { showToast } from "@/lib/toast";

type NavProps = {
  userEmail: string;
  userTier: UserTier | null;
  /** When true, the profile tier could not be loaded — do not show Free or Upgrade. */
  tierLoadError?: boolean;
  tripCount: number;
  /** Fallback trip cap when `activeTripCap` is omitted (e.g. settings). */
  freeTripLimit: number;
  /** Stripe-aware label from the planner; falls back to legacy `userTier` label. */
  planBadgeLabel?: string;
  activeTripCap?: number | "unlimited";
  /** When set, overrides whether the gold Upgrade CTA shows (Stripe product tier). */
  showUpgradeNavCta?: boolean;
  stripeCustomerId?: string | null;
};

function tierLabel(tier: UserTier | null, tierLoadError: boolean): string {
  if (tierLoadError) return "Plan unknown";
  if (tier == null || tier === "free") return "Free";
  if (tier === "concierge") return "Concierge";
  if (tier === "agent_admin" || tier === "agent_staff") return "Team";
  return formatProductTierName(normalizeToRetailTier(String(tier)));
}

function ManageSubscriptionControl({
  className = "hidden items-center justify-center rounded-full border border-royalSoft/25 bg-white/90 px-2.5 py-1.5 font-sans text-xs font-medium text-ink shadow-sm transition hover:bg-royalSoft/10 disabled:opacity-60 sm:inline-flex",
}: {
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const openPortal = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/customer-portal", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) {
        showToast(j.error ?? "Could not open the billing portal.", {
          type: "error",
        });
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void openPortal()}
      className={className}
    >
      {busy ? "Opening…" : "Manage subscription"}
    </button>
  );
}

function plannerHrefPreservingQuery(
  searchParams: URLSearchParams,
  tab: "planner" | "planning",
): string {
  const next = new URLSearchParams(searchParams.toString());
  if (tab === "planner") next.delete("tab");
  else next.set("tab", tab);
  const q = next.toString();
  return q ? `/planner?${q}` : "/planner";
}

function mobileNavLinkClass(active: boolean) {
  return active
    ? "block rounded-full bg-royalSoft/20 px-3 py-2 font-sans text-sm font-medium text-ink"
    : "block rounded-full px-3 py-2 font-sans text-sm font-medium text-ink/80 hover:bg-royalSoft/10";
}

function AppNavHeaderFallback({
  userEmail,
  userTier,
  tierLoadError = false,
  tripCount,
  freeTripLimit,
  planBadgeLabel,
  activeTripCap,
  showUpgradeNavCta,
  stripeCustomerId,
}: NavProps) {
  const isLegacyFreeNav =
    !tierLoadError && (userTier == null || userTier === "free");
  const badge = planBadgeLabel?.trim() || tierLabel(userTier, tierLoadError);
  const cap =
    activeTripCap !== undefined
      ? activeTripCap
      : isLegacyFreeNav
        ? freeTripLimit
        : null;
  const showTripRatio = typeof cap === "number";
  const upgradeNav = showUpgradeNavCta ?? isLegacyFreeNav;
  return (
    <header className="sticky top-0 z-30">
      {/* No backdrop-blur here — blur hides the same sparkles/gradient as the page edges */}
      <div className="tt-logo-band border-b border-white/20 bg-transparent">
        <div className="mx-auto flex max-w-screen-2xl justify-center px-4 py-3 sm:justify-start sm:px-6 lg:px-8">
          <TripTilesLogoLink
            href="/planner"
            imgClassName="h-24 w-auto max-w-[min(100%,24rem)] sm:h-28 md:h-32"
            className="inline-flex shrink-0 items-center rounded-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          />
        </div>
      </div>
      <div className="tt-nav-band border-b border-white/15 bg-transparent px-4 py-1.5">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-x-2 sm:gap-x-3">
            <details className="relative sm:hidden">
              <summary className="list-none cursor-pointer rounded-full border border-royalSoft/30 bg-white/90 px-3 py-1.5 font-sans text-sm font-semibold text-ink shadow-sm [&::-webkit-details-marker]:hidden">
                Menu
              </summary>
              <nav
                className="absolute left-0 z-50 mt-2 w-56 rounded-2xl border border-royal/12 bg-white/95 p-2 shadow-xl backdrop-blur-xl"
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
                      href="/planner?tab=planning"
                      className={mobileNavLinkClass(false)}
                    >
                      Organise
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
                  {stripeCustomerId ? (
                    <li className="px-3 py-2">
                      <ManageSubscriptionControl className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-royalSoft/25 bg-white/90 px-3 font-sans text-sm font-semibold text-ink shadow-sm transition hover:bg-royalSoft/10 disabled:opacity-60 sm:hidden" />
                    </li>
                  ) : null}
                </ul>
              </nav>
            </details>
            <nav
              className="hidden flex-wrap items-center gap-1 sm:flex"
              aria-label="Main"
            >
              <Link
                href="/planner"
                className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
              >
                Planner
              </Link>
              <Link
                href="/planner?tab=planning"
                className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
              >
                Organise
              </Link>
              <Link
                href="/achievements"
                className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
              >
                Passport
              </Link>
              <Link
                href="/settings"
                className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
              >
                Settings
              </Link>
            </nav>
            <span className="hidden h-4 w-px bg-royal/12 sm:block" aria-hidden />
            <Link
              href="/pricing"
              className="hidden font-sans text-sm font-medium text-ink/60 hover:text-ink sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/feedback"
              className="hidden font-sans text-sm font-medium text-ink/60 hover:text-ink sm:inline"
            >
              Feedback
            </Link>
            <span
              className="hidden rounded-full border border-royalSoft/20 bg-white/80 px-2 py-0.5 font-sans text-xs font-medium text-ink/80 sm:inline"
              title={showTripRatio ? `Your plan: ${tripCount}/${cap} trips` : "Your plan"}
            >
              {badge}
            </span>
            {stripeCustomerId ? <ManageSubscriptionControl /> : null}
            {upgradeNav ? (
              <Link
                href="/pricing"
                className="hidden items-center justify-center rounded-full bg-gold/90 px-2.5 py-1.5 font-sans text-xs font-semibold text-ink shadow-sm transition hover:bg-gold sm:inline-flex"
              >
                Upgrade
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              className="hidden max-w-[10rem] truncate font-sans text-sm text-ink/70 sm:inline"
              title={userEmail}
            >
              {userEmail}
            </span>
            <SignOutButton />
          </div>
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
  planBadgeLabel,
  activeTripCap,
  showUpgradeNavCta,
  stripeCustomerId,
}: NavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLegacyFreeNav =
    !tierLoadError && (userTier == null || userTier === "free");
  const badge = planBadgeLabel?.trim() || tierLabel(userTier, tierLoadError);
  const cap =
    activeTripCap !== undefined
      ? activeTripCap
      : isLegacyFreeNav
        ? freeTripLimit
        : null;
  const showTripRatio = typeof cap === "number";
  const upgradeNav = showUpgradeNavCta ?? isLegacyFreeNav;
  const onPlanner = pathname === "/planner";
  const tabRaw = searchParams.get("tab");
  const tab =
    tabRaw === "planning" ||
    tabRaw === "budget" ||
    tabRaw === "payments" ||
    tabRaw === "checklist"
      ? "planning"
      : "planner";

  const plannerHomeHref = onPlanner
    ? plannerHrefPreservingQuery(searchParams, "planner")
    : "/planner";
  const planningHref = onPlanner
    ? plannerHrefPreservingQuery(searchParams, "planning")
    : "/planner?tab=planning";

  const plannerHomeActive = onPlanner && tab === "planner";
  const planningActive = onPlanner && tab === "planning";
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
        className="rounded-full bg-royalSoft/20 px-3 py-1 font-sans text-sm font-medium text-ink"
        aria-current="page"
      >
        {label}
      </span>
    ) : (
      <Link
        key={key}
        href={href}
        className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
      >
        {label}
      </Link>
    );

  return (
    <header className="sticky top-0 z-30">
      <div className="tt-logo-band border-b border-white/20 bg-transparent">
        <div className="mx-auto flex max-w-screen-2xl justify-center px-4 py-3 sm:justify-start sm:px-6 lg:px-8">
          <TripTilesLogoLink
            href={plannerHomeHref}
            imgClassName="h-24 w-auto max-w-[min(100%,24rem)] sm:h-28 md:h-32"
            className="inline-flex shrink-0 items-center rounded-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          />
        </div>
      </div>
      <div className="tt-nav-band border-b border-white/15 bg-transparent px-4 py-1.5">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-x-2 sm:gap-x-3">
            <details className="relative sm:hidden">
              <summary className="list-none cursor-pointer rounded-full border border-royalSoft/30 bg-white/90 px-3 py-1.5 font-sans text-sm font-semibold text-ink shadow-sm [&::-webkit-details-marker]:hidden">
                Menu
              </summary>
              <nav
                className="absolute left-0 z-50 mt-2 w-56 rounded-2xl border border-royal/12 bg-white/95 p-2 shadow-xl backdrop-blur-xl"
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
                      href={planningHref}
                      className={mobileNavLinkClass(planningActive)}
                      aria-current={planningActive ? "page" : undefined}
                    >
                      Organise
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
                  {stripeCustomerId ? (
                    <li className="px-3 py-2">
                      <ManageSubscriptionControl className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-royalSoft/25 bg-white/90 px-3 font-sans text-sm font-semibold text-ink shadow-sm transition hover:bg-royalSoft/10 disabled:opacity-60 sm:hidden" />
                    </li>
                  ) : null}
                </ul>
              </nav>
            </details>
            <nav
              className="hidden flex-wrap items-center gap-1 sm:flex"
              aria-label="Main"
            >
              {linkOrCurrent("planner", plannerHomeHref, "Planner", plannerHomeActive)}
              {linkOrCurrent(
                "planning",
                planningHref,
                "Organise",
                planningActive,
              )}
              {passportActive ? (
                <span
                  key="passport"
                  className="rounded-full bg-royalSoft/20 px-3 py-1 font-sans text-sm font-medium text-ink"
                  aria-current="page"
                >
                  Passport
                </span>
              ) : (
                <Link
                  key="passport"
                  href="/achievements"
                  className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
                >
                  Passport
                </Link>
              )}
              {settingsActive ? (
                <span
                  key="settings"
                  className="rounded-full bg-royalSoft/20 px-3 py-1 font-sans text-sm font-medium text-ink"
                  aria-current="page"
                >
                  Settings
                </span>
              ) : (
                <Link
                  key="settings"
                  href="/settings"
                  className="rounded-full px-3 py-1 font-sans text-sm font-medium text-ink/75 transition hover:bg-royalSoft/10 hover:text-ink"
                >
                  Settings
                </Link>
              )}
            </nav>
            <span className="hidden h-4 w-px bg-royal/12 sm:block" aria-hidden />
            <Link
              href="/pricing"
              className="hidden font-sans text-sm font-medium text-ink/60 hover:text-ink sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/feedback"
              className="hidden font-sans text-sm font-medium text-ink/60 hover:text-ink sm:inline"
            >
              Feedback
            </Link>
            <span
              className="hidden rounded-full border border-royalSoft/20 bg-white/80 px-2 py-0.5 font-sans text-xs font-medium text-ink/80 sm:inline"
              title={showTripRatio ? `Your plan: ${tripCount}/${cap} trips` : "Your plan"}
            >
              {badge}
            </span>
            {stripeCustomerId ? <ManageSubscriptionControl /> : null}
            {upgradeNav ? (
              <Link
                href="/pricing"
                className="hidden items-center justify-center rounded-full bg-gold/90 px-2.5 py-1.5 font-sans text-xs font-semibold text-ink shadow-sm transition hover:bg-gold sm:inline-flex"
              >
                Upgrade
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              className="hidden max-w-[10rem] truncate font-sans text-sm text-ink/70 sm:inline"
              title={userEmail}
            >
              {userEmail}
            </span>
            <SignOutButton />
          </div>
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
