"use client";

import { THEMES, THEME_KEYS, type ThemeKey } from "@/lib/themes";

type Props = {
  value: ThemeKey;
  onChange: (key: ThemeKey) => void;
  /** Compact row for menus; full grid for wizard. */
  layout?: "grid" | "row";
};

export function TripThemePicker({
  value,
  onChange,
  layout = "grid",
}: Props) {
  const wrap =
    layout === "grid"
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3"
      : "flex flex-wrap gap-2";

  return (
    <div className={wrap} role="listbox" aria-label="Colour theme">
      {THEME_KEYS.map((key) => {
        const t = THEMES[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tt-accent,#C9A961)] ${
              selected
                ? "border-[var(--tt-primary,#0B1E5C)] bg-white ring-2 ring-[var(--tt-primary,#0B1E5C)]/25"
                : "border-royal/15 bg-cream hover:border-royal/30"
            }`}
          >
            <span className="flex gap-1" aria-hidden>
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: t.primary }}
              />
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: t.accent }}
              />
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: t.background }}
              />
            </span>
            <span className="font-sans text-xs font-semibold text-royal">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
