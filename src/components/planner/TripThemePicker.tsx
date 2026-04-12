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
            className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
              selected
                ? "border-2 border-transparent bg-white shadow-sm"
                : "border border-royal/15 bg-cream hover:border-royal/30"
            }`}
            style={
              selected
                ? {
                    borderColor: t.ring,
                    boxShadow: `0 0 0 1px ${t.ring}40`,
                  }
                : undefined
            }
          >
            <span
              className="h-8 w-14 shrink-0 rounded-md border-2 shadow-sm"
              style={{
                backgroundColor: t.tile,
                borderColor: t.accent,
              }}
              aria-hidden
            />
            <span className="font-sans text-xs font-semibold text-royal">
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
