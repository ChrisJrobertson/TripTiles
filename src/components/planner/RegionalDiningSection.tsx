"use client";

import { getRegionalDining } from "@/data/regional-dining";
import { useMemo } from "react";

type Props = {
  regionId: string | null;
};

export function RegionalDiningSection({ regionId }: Props) {
  const items = useMemo(() => getRegionalDining(regionId), [regionId]);
  if (items.length === 0) return null;

  return (
    <details className="mt-4 rounded-lg border border-royal/10 bg-white/70">
      <summary className="min-h-[44px] cursor-pointer list-none px-3 py-2.5 font-sans text-sm font-semibold text-royal [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>🍽️</span>
          Popular restaurants nearby
        </span>
      </summary>
      <div className="space-y-2 border-t border-royal/10 px-3 pb-3 pt-2">
        <p className="font-sans text-xs leading-relaxed text-royal/65">
          Ideas for meals outside the parks — not tiles you can drag onto the
          calendar.
        </p>
        {items.map((d) => (
          <div
            key={`${d.name}-${d.priceRange}`}
            className="rounded-lg border border-royal/10 bg-cream px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-sans text-sm font-semibold text-royal">
                {d.name}
              </span>
              <span className="shrink-0 font-sans text-sm font-semibold text-gray-500">
                {d.priceRange}
              </span>
            </div>
            <p className="mt-1 font-sans text-sm text-gray-500">{d.description}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
