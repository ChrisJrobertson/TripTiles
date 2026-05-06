"use client";

import {
  TripTilesPlannerBrand,
  UserAvatarInitial,
} from "@/components/brand/TripTilesPlannerBrand";
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

function pillNavInactive() {
  return "rounded-full px-3 py-1.5 font-sans text-sm font-medium text-tt-ink-muted transition hover:bg-[#f3f4f6] hover:text-tt-ink";
}

function pillNavActive() {
  return "rounded-full bg-[#e4ecf7] px-3 py-1.5 font-sans text-sm font-semibold text-tt-royal";
}

function mobileMenuLink() {
  return "block w-full rounded-full px-3 py-2 text-left font-sans text-sm font-medium text-tt-ink-muted hover:bg-[#f3f4f6]";
}

function ManageSubscriptionControl({
  className = "",
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
      className={
        className ||
        "hidden shrink-0 items-center justify-center rounded-full border border-tt-line-soft bg-[#faf8f5] px-3 py-1.5 font-sans text-xs font-semibold text-tt-royal shadow-sm transition hover:bg-white disabled:opacity-60 sm:inline-flex"
      }
    >
      {busy ? "Opening…" : "Manage billing"}
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
    ? "block rounded-full bg-[#e4ecf7] px-3 py-2 font-sans text-sm font-semibold text-tt-royal"
    : "block rounded-full px-3 py-2 font-sans text-sm font-medium text-tt-ink-muted hover:bg-[#f3f4f6]";
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
  const planPillTitle = showTripRatio
    ? `Your plan: ${tripCount}/${cap} trips · ${badge}`
    : badge;
  const planPillText = tierLoadError ? "Plan" : `${badge} plan`;

  return (
    <header className="relative z-30 border-b border-tt-line/90 bg-white shadow-[0_1px_0_rgba(21,32,58,0.04)]">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:gap-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-6 lg:flex-initial">
          <details className="relative shrink-0 md:hidden">
            <summary className="list-none cursor-pointer rounded-full border border-tt-line bg-[#faf8f5] px-3 py-1.5 font-sans text-sm font-semibold text-tt-ink shadow-sm [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav
              className="absolute left-0 z-50 mt-2 w-56 rounded-2xl border border-tt-line/90 bg-white p-2 shadow-xl"
              aria-label="Main mobile"
            >
              <ul className="flex flex-col gap-0.5">
                <li>
                  <Link href="/planner" className={mobileMenuLink()}>
                    Planner
                  </Link>
                </li>
                <li>
                  <Link
                    href="/planner?tab=planning"
                    className={mobileMenuLink()}
                  >
                    Organise
                  </Link>
                </li>
                <li>
                  <Link href="/passport" className={mobileMenuLink()}>
                    Passport
                  </Link>
                </li>
                <li>
                  <Link href="/settings/profile" className={mobileMenuLink()}>
                    Settings
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className={mobileMenuLink()}>
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/feedback" className={mobileMenuLink()}>
                    Feedback
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
          <TripTilesPlannerBrand href="/planner" />
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            <Link href="/planner" className={pillNavInactive()}>
              Planner
            </Link>
            <Link href="/planner?tab=planning" className={pillNavInactive()}>
              Organise
            </Link>
            <Link href="/passport" className={pillNavInactive()}>
              Passport
            </Link>
            <Link href="/settings/profile" className={pillNavInactive()}>
              Settings
            </Link>
          </nav>
        </div>

        <div className="flex max-w-[100vw] items-center gap-2 sm:gap-3">
          <span
            className="hidden h-5 w-px shrink-0 bg-tt-line md:block"
            aria-hidden
          />
          <nav
            className="hidden shrink-0 items-center gap-1 md:flex"
            aria-label="Product links"
          >
            <Link
              href="/pricing"
              className={`${pillNavInactive()} whitespace-nowrap`}
            >
              Pricing
            </Link>
            <Link
              href="/feedback"
              className={`${pillNavInactive()} whitespace-nowrap`}
            >
              Feedback
            </Link>
          </nav>
          <span
            className="rounded-full bg-gradient-to-br from-[#fde8d9] to-[#ffe7cc] px-2.5 py-1 font-sans text-xs font-semibold text-[#92400e] ring-1 ring-amber-200/90"
            title={planPillTitle}
          >
            {planPillText}
          </span>
          {stripeCustomerId ? <ManageSubscriptionControl /> : null}
          {upgradeNav ? (
            <Link
              href="/pricing"
              className="hidden rounded-full bg-tt-gold px-3 py-1.5 font-sans text-xs font-semibold text-white shadow-sm transition hover:bg-tt-gold/92 sm:inline-flex"
            >
              Upgrade
            </Link>
          ) : null}
          <span
            className="hidden max-w-[9rem] truncate font-sans text-xs text-tt-ink-muted lg:inline lg:max-w-[12rem] lg:text-sm"
            title={userEmail}
          >
            {userEmail}
          </span>
          <UserAvatarInitial email={userEmail} className="hidden sm:flex" />
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
  const planPillTitle = showTripRatio
    ? `Your plan: ${tripCount}/${cap} trips · ${badge}`
    : badge;
  const planPillText = tierLoadError ? "Plan" : `${badge} plan`;
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
  const passportAreaActive =
    pathname === "/passport" ||
    pathname?.startsWith("/passport/") ||
    pathname === "/achievements" ||
    pathname?.startsWith("/achievements/");
  const settingsActive =
    pathname === "/settings" || pathname?.startsWith("/settings/");

  const linkPrimary = (
    key: string,
    href: string,
    label: string,
    active: boolean,
  ) =>
    active ? (
      <span key={key} className={pillNavActive()} aria-current="page">
        {label}
      </span>
    ) : (
      <Link key={key} href={href} className={pillNavInactive()}>
        {label}
      </Link>
    );

  return (
    <header className="relative z-30 border-b border-tt-line/90 bg-white shadow-[0_1px_0_rgba(21,32,58,0.04)]">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:gap-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-6 lg:flex-initial">
          <details className="relative shrink-0 md:hidden">
            <summary className="list-none cursor-pointer rounded-full border border-tt-line bg-[#faf8f5] px-3 py-1.5 font-sans text-sm font-semibold text-tt-ink shadow-sm [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <nav
              className="absolute left-0 z-50 mt-2 w-56 rounded-2xl border border-tt-line/90 bg-white p-2 shadow-xl"
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
                    href="/passport"
                    className={mobileNavLinkClass(passportAreaActive)}
                    aria-current={passportAreaActive ? "page" : undefined}
                  >
                    Passport
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/profile"
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
                  <li className="px-2 py-2">
                    <ManageSubscriptionControl className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-tt-line bg-[#faf8f5] px-3 font-sans text-sm font-semibold text-tt-royal shadow-sm transition hover:bg-white disabled:opacity-60" />
                  </li>
                ) : null}
              </ul>
            </nav>
          </details>

          <TripTilesPlannerBrand href={plannerHomeHref} />

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {linkPrimary("planner", plannerHomeHref, "Planner", plannerHomeActive)}
            {linkPrimary("planning", planningHref, "Organise", planningActive)}
            {passportAreaActive ? (
              <span className={pillNavActive()} aria-current="page">
                Passport
              </span>
            ) : (
              <Link href="/passport" className={pillNavInactive()}>
                Passport
              </Link>
            )}
            {settingsActive ? (
              <span className={pillNavActive()} aria-current="page">
                Settings
              </span>
            ) : (
              <Link href="/settings/profile" className={pillNavInactive()}>
                Settings
              </Link>
            )}
          </nav>
        </div>

        <div className="flex max-w-[100vw] items-center gap-2 sm:gap-3">
          <span
            className="hidden h-5 w-px shrink-0 bg-tt-line md:block"
            aria-hidden
          />
          <nav
            className="hidden shrink-0 items-center gap-1 md:flex"
            aria-label="Product links"
          >
            <Link
              href="/pricing"
              className={`${pillNavInactive()} whitespace-nowrap`}
            >
              Pricing
            </Link>
            <Link
              href="/feedback"
              className={`${pillNavInactive()} whitespace-nowrap`}
            >
              Feedback
            </Link>
          </nav>
          <span
            className="rounded-full bg-gradient-to-br from-[#fde8d9] to-[#ffe7cc] px-2.5 py-1 font-sans text-xs font-semibold text-[#92400e] ring-1 ring-amber-200/90"
            title={planPillTitle}
          >
            {planPillText}
          </span>
          {stripeCustomerId ? <ManageSubscriptionControl /> : null}
          {upgradeNav ? (
            <Link
              href="/pricing"
              className="hidden rounded-full bg-tt-gold px-3 py-1.5 font-sans text-xs font-semibold text-white shadow-sm transition hover:bg-tt-gold/92 sm:inline-flex"
            >
              Upgrade
            </Link>
          ) : null}
          <span
            className="hidden max-w-[9rem] truncate font-sans text-xs text-tt-ink-muted lg:inline lg:max-w-[12rem] lg:text-sm"
            title={userEmail}
          >
            {userEmail}
          </span>
          <UserAvatarInitial email={userEmail} className="hidden sm:flex" />
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
