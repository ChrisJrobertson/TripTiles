"use client";

import { GROUP_META, GROUP_ORDER } from "@/lib/group-meta";
import { legacyDestinationFromRegionId } from "@/lib/legacy-destination";
import type { Destination, Park } from "@/lib/types";

type Props = {
  parks: Park[];
  /** `regions.id` for the active trip; filters via `park.region_ids`. */
  regionId: string | null;
  selectedParkId: string | null;
  onSelectPark: (id: string | null) => void;
};

function matchesDestination(park: Park, dest: Destination): boolean {
  if (dest === "custom") return true;
  return park.destinations.includes(dest);
}

function matchesRegion(park: Park, regionId: string | null): boolean {
  if (!regionId) return true;
  if (park.region_ids?.length) {
    return park.region_ids.includes(regionId);
  }
  const legacy = legacyDestinationFromRegionId(regionId);
  return matchesDestination(park, legacy);
}

export function Palette({
  parks,
  regionId,
  selectedParkId,
  onSelectPark,
}: Props) {
  return (
    <aside className="rounded-2xl border-2 border-gold/70 bg-cream p-4 text-royal shadow-sm">
      <h2 className="mb-4 font-serif text-lg font-semibold text-royal">
        Parks
      </h2>
      <div className="flex flex-col gap-2">
        {GROUP_ORDER.map((groupKey) => {
          const meta = GROUP_META[groupKey];
          if (!meta) return null;
          const groupParks = parks.filter(
            (p) =>
              p.park_group === groupKey && matchesRegion(p, regionId),
          );
          if (groupParks.length === 0) return null;

          return (
            <details
              key={groupKey}
              open={meta.openByDefault}
              className="rounded-lg border border-royal/10 bg-white/60"
            >
              <summary className="cursor-pointer select-none px-3 py-2 font-sans text-sm font-semibold text-royal">
                {meta.label}
              </summary>
              <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1">
                {groupParks.map((park) => {
                  const selected = selectedParkId === park.id;
                  return (
                    <button
                      key={park.id}
                      type="button"
                      onClick={() =>
                        onSelectPark(selected ? null : park.id)
                      }
                      className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-2 text-left font-sans text-xs font-medium transition ${
                        selected
                          ? "scale-105 ring-2 ring-royal ring-offset-1"
                          : "hover:opacity-95"
                      }`}
                      style={{
                        backgroundColor: park.bg_colour,
                        color: park.fg_colour,
                      }}
                    >
                      {park.icon ? (
                        <span className="shrink-0" aria-hidden>
                          {park.icon}
                        </span>
                      ) : null}
                      <span className="truncate">{park.name}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </aside>
  );
}
