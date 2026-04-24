"use client";

import { useRef } from "react";
import {
  ADVENTURE_TITLE_COLOR_KEY,
  DEFAULT_ADVENTURE_TITLE_COLOR,
  normalizeAdventureTitleColor,
  resolvedAdventureTitleColor,
} from "@/lib/adventure-title-color";

const PRESETS: { label: string; hex: string; useDefault: boolean }[] = [
  { label: "Default blue", hex: DEFAULT_ADVENTURE_TITLE_COLOR, useDefault: true },
  { label: "Gold", hex: "#dd4e14", useDefault: false },
  { label: "Magic", hex: "#3fa2ec", useDefault: false },
  { label: "Ink", hex: "#3d4a5c", useDefault: false },
  { label: "Lime", hex: "#a2df56", useDefault: false },
  { label: "Plum", hex: "#6b2d8b", useDefault: false },
];

type Props = {
  preferences: Record<string, unknown> | null | undefined;
  onColorChange: (value: string | null) => void;
};

export function AdventureTitleColorControl({ preferences, onColorChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const resolved = resolvedAdventureTitleColor(preferences);
  const stored = normalizeAdventureTitleColor(
    preferences?.[ADVENTURE_TITLE_COLOR_KEY],
  );

  const close = () => {
    detailsRef.current?.removeAttribute("open");
  };

  return (
    <details
      ref={detailsRef}
      className="relative inline-flex [open]:z-20"
    >
      <summary
        className="inline-flex h-8 w-8 list-none cursor-pointer items-center justify-center rounded-lg border border-royal/20 bg-white/50 text-royal/70 transition hover:border-royal/40 hover:bg-white/80 hover:text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 [&::-webkit-details-marker]:hidden"
        title="Adventure title colour"
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-royal/20 shadow-sm"
          style={{ backgroundColor: resolved }}
        />
        <span className="sr-only">Choose adventure title colour</span>
      </summary>
      <div
        className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,12rem)] rounded-xl border border-royal/15 bg-cream/95 p-2 shadow-lg backdrop-blur-sm"
        onMouseDown={(e) => e.preventDefault()}
      >
        <p className="px-1 pb-1.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-royal/55">
          Adventure title
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active =
              p.useDefault
                ? stored === null
                : stored === p.hex.toLowerCase();
            return (
              <button
                key={p.label}
                type="button"
                title={p.label}
                onClick={() => {
                  onColorChange(p.useDefault ? null : p.hex);
                  close();
                }}
                className={`h-7 w-7 rounded-full border-2 transition hover:scale-105 ${
                  active
                    ? "border-royal ring-1 ring-royal/30"
                    : "border-white/60 shadow-sm"
                }`}
                style={{ backgroundColor: p.hex }}
              />
            );
          })}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-royal/10 bg-white/60 px-2 py-1.5 font-sans text-xs text-royal/80">
          <span>Custom</span>
          <input
            type="color"
            value={resolved}
            onChange={(e) => {
              const next = normalizeAdventureTitleColor(e.target.value);
              if (next) {
                onColorChange(next);
                close();
              }
            }}
            className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            aria-label="Custom colour"
          />
        </label>
        {stored !== null ? (
          <button
            type="button"
            className="mt-1 w-full rounded-md py-1 text-center font-sans text-xs font-medium text-royal/60 hover:text-royal"
            onClick={() => {
              onColorChange(null);
              close();
            }}
          >
            Reset to default
          </button>
        ) : null}
      </div>
    </details>
  );
}
