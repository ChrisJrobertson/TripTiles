"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string }[] = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/subscription", label: "Subscription" },
  { href: "/settings/data-privacy", label: "Data & privacy" },
];

type Props = { showTemplates: boolean };

export function SettingsSidebar({ showTemplates }: Props) {
  const pathname = usePathname();

  function isNavActive(href: string) {
    if (href === "/settings/profile") {
      return pathname === "/settings/profile" || pathname === "/settings";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function linkCls(href: string) {
    const active = isNavActive(href);
    return active
      ? "bg-royalSoft/20 font-semibold text-ink"
      : "text-ink/80 hover:bg-royalSoft/10";
  }

  const items = showTemplates
    ? [
        ...NAV.slice(0, 4),
        { href: "/settings/templates", label: "Day templates" },
      ]
    : NAV;

  const hrefSet = new Set(items.map((i) => i.href));
  const selectValue = hrefSet.has(pathname) ? pathname : "/settings/profile";

  return (
    <>
      <div className="md:hidden">
        <label className="sr-only" htmlFor="settings-section">
          Settings section
        </label>
        <select
          id="settings-section"
          className="w-full rounded-2xl border border-royal/12 bg-white/90 px-4 py-3 font-sans text-sm text-ink shadow-sm"
          value={selectValue}
          onChange={(e) => {
            window.location.href = e.target.value;
          }}
        >
          {items.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <nav
        className="hidden w-52 shrink-0 md:block"
        aria-label="Settings sections"
      >
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-xl px-3 py-2 font-sans text-sm transition ${linkCls(item.href)}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
