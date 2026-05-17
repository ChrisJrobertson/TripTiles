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
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Ref,
} from "react";
import { showToast } from "@/lib/toast";

type NavProps = {
  userEmail: string;
  displayName: string | null;
  userTier: UserTier | null;
  tierLoadError?: boolean;
  tripCount: number;
  freeTripLimit: number;
  planBadgeLabel?: string;
  activeTripCap?: number | "unlimited";
  showUpgradeNavCta?: boolean;
  stripeCustomerId?: string | null;
};

type NavLinkItem = {
  key: string;
  href: string;
  label: string;
  active: boolean;
};

type AppNavShellProps = NavProps & {
  brandHref: string;
  mainLinks: NavLinkItem[];
  productLinks: NavLinkItem[];
  upgradeNav: boolean;
  planPillTitle: string;
  planPillText: string;
  userLabel: string;
  userTitle: string;
  /** When this value changes, the mobile menu closes (route changes). */
  routeCloseKey: string;
};

const MOBILE_PANEL_LINK =
  "flex min-h-11 w-full items-center rounded-lg px-3 font-sans text-sm font-medium text-tt-ink-muted transition hover:bg-white/80 hover:text-tt-ink";

const MOBILE_PANEL_LINK_ACTIVE =
  "flex min-h-11 w-full items-center rounded-lg bg-[#e4ecf7] px-3 font-sans text-sm font-semibold text-tt-royal";

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
        "hidden shrink-0 items-center justify-center rounded-full border border-tt-line-soft bg-[#faf8f5] px-3 py-1.5 font-sans text-xs font-semibold text-tt-royal shadow-sm transition hover:bg-white disabled:opacity-60 lg:inline-flex"
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

function navUserLabel(displayName: string | null, email: string): string {
  const d = displayName?.trim();
  return d || email;
}

function navUserTitle(displayName: string | null, email: string): string {
  const d = displayName?.trim();
  const e = email.trim();
  if (d && e) return `${d} (${e})`;
  return e || d || "";
}

function resolveNavMeta(props: NavProps) {
  const {
    userTier,
    tierLoadError = false,
    tripCount,
    freeTripLimit,
    planBadgeLabel,
    activeTripCap,
    showUpgradeNavCta,
  } = props;
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
  return { upgradeNav, planPillTitle, planPillText };
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function MobilePanelDivider() {
  return (
    <li className="my-1 border-t border-tt-line/90" role="presentation" />
  );
}

function MobileNavLink({
  item,
  onNavigate,
  linkRef,
}: {
  item: NavLinkItem;
  onNavigate: () => void;
  linkRef?: Ref<HTMLAnchorElement>;
}) {
  const cls = item.active ? MOBILE_PANEL_LINK_ACTIVE : MOBILE_PANEL_LINK;
  return (
    <li>
      <Link
        ref={linkRef}
        href={item.href}
        className={cls}
        aria-current={item.active ? "page" : undefined}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    </li>
  );
}

function AppNavHeaderShell({
  brandHref,
  mainLinks,
  productLinks,
  upgradeNav,
  planPillTitle,
  planPillText,
  userEmail,
  displayName,
  userLabel,
  userTitle,
  stripeCustomerId,
  routeCloseKey,
}: AppNavShellProps) {
  const panelId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstPanelLinkRef = useRef<HTMLAnchorElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((v) => !v);
  }, []);

  useEffect(() => {
    closeMenu();
  }, [closeMenu, routeCloseKey]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = headerRef.current;
      if (!root?.contains(e.target as Node)) {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const t = window.setTimeout(() => {
      firstPanelLinkRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const desktopMainLink = (item: NavLinkItem) =>
    item.active ? (
      <span key={item.key} className={pillNavActive()} aria-current="page">
        {item.label}
      </span>
    ) : (
      <Link key={item.key} href={item.href} className={pillNavInactive()}>
        {item.label}
      </Link>
    );

  const mobileBillingClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-tt-line bg-white px-3 font-sans text-sm font-semibold text-tt-royal shadow-sm transition hover:bg-[#faf8f5] disabled:opacity-60";

  return (
    <header
      ref={headerRef}
      className="relative z-30 border-b border-tt-line/90 bg-white shadow-[0_1px_0_rgba(21,32,58,0.04)]"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-nowrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:gap-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-initial lg:gap-6">
          <TripTilesPlannerBrand href={brandHref} />
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Main navigation"
          >
            {mainLinks.map(desktopMainLink)}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            className="hidden h-5 w-px shrink-0 bg-tt-line lg:block"
            aria-hidden
          />
          <nav
            className="hidden shrink-0 items-center gap-1 lg:flex"
            aria-label="Product links"
          >
            {productLinks.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`${pillNavInactive()} whitespace-nowrap`}
              >
                {item.label}
              </Link>
            ))}
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
              className="hidden rounded-full bg-tt-gold px-3 py-1.5 font-sans text-xs font-semibold text-white shadow-sm transition hover:bg-tt-gold/92 lg:inline-flex"
            >
              Upgrade
            </Link>
          ) : null}
          <span
            className="hidden max-w-[9rem] truncate font-sans text-xs text-tt-ink-muted lg:inline lg:max-w-[12rem] lg:text-sm"
            title={userTitle}
          >
            {userLabel}
          </span>
          <UserAvatarInitial
            email={userEmail}
            displayName={displayName}
            className="flex"
          />
          <span className="hidden lg:inline">
            <SignOutButton />
          </span>
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-tt-line bg-[#faf8f5] text-tt-royal shadow-sm transition hover:bg-white motion-reduce:transition-none lg:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls={panelId}
            onClick={toggleMenu}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Main navigation"
          className="absolute inset-x-0 top-full z-50 border-b border-tt-line/90 bg-[#faf8f3] shadow-lg motion-reduce:transition-none lg:hidden"
        >
          <nav className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <ul className="flex flex-col gap-0.5 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {mainLinks.map((item, index) => (
                <MobileNavLink
                  key={item.key}
                  item={item}
                  onNavigate={closeMenu}
                  linkRef={index === 0 ? firstPanelLinkRef : undefined}
                />
              ))}
              <MobilePanelDivider />
              {productLinks.map((item) => (
                <MobileNavLink
                  key={item.key}
                  item={item}
                  onNavigate={closeMenu}
                />
              ))}
              {stripeCustomerId ? (
                <li className="pt-0.5">
                  <ManageSubscriptionControl className={mobileBillingClass} />
                </li>
              ) : null}
              {upgradeNav ? (
                <li>
                  <Link
                    href="/pricing"
                    className="flex min-h-11 w-full items-center justify-center rounded-lg bg-tt-gold px-3 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-tt-gold/92"
                    onClick={closeMenu}
                  >
                    Upgrade
                  </Link>
                </li>
              ) : null}
              <MobilePanelDivider />
              <li className="flex min-h-11 items-center px-3 [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:px-0 [&_button]:text-left [&_button]:font-sans [&_button]:text-sm [&_button]:font-medium [&_button]:text-tt-ink-muted [&_button]:no-underline [&_button]:hover:bg-white/80 [&_button]:hover:text-tt-ink">
                <SignOutButton />
              </li>
            </ul>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function fallbackNavLinks(): {
  brandHref: string;
  mainLinks: NavLinkItem[];
  productLinks: NavLinkItem[];
} {
  return {
    brandHref: "/planner",
    mainLinks: [
      { key: "planner", href: "/planner", label: "Planner", active: false },
      {
        key: "live-waits",
        href: "/today-at-park",
        label: "Live waits",
        active: false,
      },
      {
        key: "planning",
        href: "/planner?tab=planning",
        label: "Organise",
        active: false,
      },
      { key: "passport", href: "/passport", label: "Passport", active: false },
      {
        key: "settings",
        href: "/settings/profile",
        label: "Settings",
        active: false,
      },
    ],
    productLinks: [
      { key: "pricing", href: "/pricing", label: "Pricing", active: false },
      { key: "feedback", href: "/feedback", label: "Feedback", active: false },
    ],
  };
}

function AppNavHeaderFallback(props: NavProps) {
  const { upgradeNav, planPillTitle, planPillText } = resolveNavMeta(props);
  const { brandHref, mainLinks, productLinks } = fallbackNavLinks();
  const userLabel = navUserLabel(props.displayName, props.userEmail);
  const userTitle = navUserTitle(props.displayName, props.userEmail);

  return (
    <AppNavHeaderShell
      {...props}
      brandHref={brandHref}
      mainLinks={mainLinks}
      productLinks={productLinks}
      upgradeNav={upgradeNav}
      planPillTitle={planPillTitle}
      planPillText={planPillText}
      userLabel={userLabel}
      userTitle={userTitle}
      routeCloseKey="fallback"
    />
  );
}

function AppNavHeaderInner(props: NavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { upgradeNav, planPillTitle, planPillText } = resolveNavMeta(props);

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
  const liveWaitsActive = pathname === "/today-at-park";
  const passportAreaActive =
    pathname === "/passport" ||
    pathname?.startsWith("/passport/") ||
    pathname === "/achievements" ||
    pathname?.startsWith("/achievements/");
  const settingsActive =
    pathname === "/settings" || pathname?.startsWith("/settings/");

  const mainLinks: NavLinkItem[] = [
    {
      key: "planner",
      href: plannerHomeHref,
      label: "Planner",
      active: plannerHomeActive,
    },
    {
      key: "live-waits",
      href: "/today-at-park",
      label: "Live waits",
      active: liveWaitsActive,
    },
    {
      key: "planning",
      href: planningHref,
      label: "Organise",
      active: planningActive,
    },
    {
      key: "passport",
      href: "/passport",
      label: "Passport",
      active: passportAreaActive,
    },
    {
      key: "settings",
      href: "/settings/profile",
      label: "Settings",
      active: settingsActive,
    },
  ];

  const productLinks: NavLinkItem[] = [
    { key: "pricing", href: "/pricing", label: "Pricing", active: false },
    { key: "feedback", href: "/feedback", label: "Feedback", active: false },
  ];

  const userLabel = navUserLabel(props.displayName, props.userEmail);
  const userTitle = navUserTitle(props.displayName, props.userEmail);
  const routeCloseKey = `${pathname}?${searchParams.toString()}`;

  return (
    <AppNavHeaderShell
      {...props}
      brandHref={plannerHomeHref}
      mainLinks={mainLinks}
      productLinks={productLinks}
      upgradeNav={upgradeNav}
      planPillTitle={planPillTitle}
      planPillText={planPillText}
      userLabel={userLabel}
      userTitle={userTitle}
      routeCloseKey={routeCloseKey}
    />
  );
}

export function AppNavHeader(props: NavProps) {
  return (
    <Suspense fallback={<AppNavHeaderFallback {...props} />}>
      <AppNavHeaderInner {...props} />
    </Suspense>
  );
}
