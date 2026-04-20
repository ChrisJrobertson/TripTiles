"use client";

import { RegionalDiningSection } from "@/components/planner/RegionalDiningSection";
import { GROUP_META, GROUP_ORDER } from "@/lib/group-meta";
import { isCruisePaletteTileName } from "@/lib/cruise-tiles";
import { isNamedRestaurantPark } from "@/lib/named-restaurant-tiles";
import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import { parkChromaTileStyle } from "@/lib/theme-colours";
import type { ThemeKey } from "@/lib/themes";
import type { CustomTile, Park } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";

type Props = {
  parks: Park[];
  customTiles: CustomTile[];
  /** `regions.id` for the active trip; filters via `park.region_ids`. */
  regionId: string | null;
  /** When false, cruise/ship tiles are hidden from the drawer (client-side). */
  showCruiseTiles: boolean;
  /** Active trip colour theme — transforms each tile's catalogue colour. */
  colourTheme: ThemeKey;
  selectedParkId: string | null;
  onSelectPark: (id: string | null) => void;
  onAddCustom: (group: string) => void;
  onEditCustom: (tile: CustomTile) => void;
  onDeleteCustom: (tileId: string) => void;
};

export function Palette({
  parks,
  customTiles,
  regionId,
  showCruiseTiles,
  colourTheme,
  selectedParkId,
  onSelectPark,
  onAddCustom,
  onEditCustom,
  onDeleteCustom,
}: Props) {
  const [menuTileId, setMenuTileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const normalisedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = useCallback(
    (name: string, icon?: string | null) => {
      if (!normalisedQuery) return true;
      const hay = `${name} ${icon ?? ""}`.toLowerCase();
      return hay.includes(normalisedQuery);
    },
    [normalisedQuery],
  );

  const builtInForRegion = useMemo(() => {
    const raw = parks.filter((p) => parkMatchesPlannerRegion(p, regionId));
    if (showCruiseTiles) return raw;
    return raw.filter((p) => !isCruisePaletteTileName(p.name));
  }, [parks, regionId, showCruiseTiles]);

  const hasCatalog = builtInForRegion.length > 0;
  const hasCustom = customTiles.length > 0;
  const hasVisibleResults = useMemo(() => {
    return GROUP_ORDER.some((groupKey) => {
      const groupParks = parks.filter(
        (p) =>
          p.park_group === groupKey &&
          parkMatchesPlannerRegion(p, regionId) &&
          (showCruiseTiles || !isCruisePaletteTileName(p.name)) &&
          matchesSearch(p.name, p.icon),
      );
      const groupCustom = customTiles.filter(
        (t) => t.park_group === groupKey && matchesSearch(t.name, t.icon),
      );
      return groupParks.length > 0 || groupCustom.length > 0;
    });
  }, [customTiles, matchesSearch, parks, regionId, showCruiseTiles]);

  if (!hasCatalog && !hasCustom) {
    return (
      <aside className="rounded-2xl border border-royal/12 bg-cream p-4 text-royal shadow-sm">
        <h2 className="mb-2 font-serif text-base font-semibold text-royal">
          Parks
        </h2>
        <p className="font-sans text-sm leading-relaxed text-royal/75">
          No park tiles are available for this destination in the catalog yet.
          Add your own with &quot;Add custom&quot; inside a category below, or
          try editing the trip region.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-royal/12 bg-cream p-4 text-royal shadow-sm">
      <h2 className="mb-3 font-serif text-base font-semibold text-royal">
        Parks
      </h2>
      <label className="mb-3 block">
        <span className="mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-royal/60">
          Search
        </span>
        <input
          data-planner-parks-search
          type="search"
          placeholder="Search parks…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-gold/30 bg-white px-3 py-2 font-sans text-sm text-royal placeholder:text-royal/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        />
      </label>
      <div className="flex flex-col gap-2">
        {GROUP_ORDER.map((groupKey) => {
          const meta = GROUP_META[groupKey];
          if (!meta) return null;
          const groupParks = parks.filter(
            (p) =>
              p.park_group === groupKey &&
              parkMatchesPlannerRegion(p, regionId) &&
              (showCruiseTiles || !isCruisePaletteTileName(p.name)) &&
              matchesSearch(p.name, p.icon),
          );
          const groupCustom = customTiles.filter(
            (t) => t.park_group === groupKey && matchesSearch(t.name, t.icon),
          );
          if (groupParks.length === 0 && groupCustom.length === 0) return null;

          const genericDiningParks =
            groupKey === "dining"
              ? groupParks.filter((p) => !isNamedRestaurantPark(p))
              : groupParks;
          const restaurantDiningParks =
            groupKey === "dining"
              ? groupParks.filter((p) => isNamedRestaurantPark(p))
              : [];

          return (
            <details
              key={groupKey}
              open={meta.openByDefault}
              className="rounded-lg border border-royal/10 bg-white/60"
            >
              <summary className="cursor-pointer select-none px-3 py-2 font-sans text-sm font-semibold text-royal">
                {meta.label}
              </summary>
              <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
                {groupKey === "dining" && genericDiningParks.length > 0 ? (
                  <div>
                    <p className="mb-1.5 px-0.5 font-sans text-[0.65rem] font-semibold uppercase tracking-wide text-royal/55">
                      Dining
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {genericDiningParks.map((park) => {
                        const selected = selectedParkId === park.id;
                        return (
                          <button
                            key={park.id}
                            type="button"
                            onClick={() =>
                              onSelectPark(selected ? null : park.id)
                            }
                            className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-2 text-left font-sans text-xs font-medium transition hover:brightness-[1.06] ${
                              selected
                                ? "scale-105 ring-2 ring-[color:var(--tt-ring)] ring-offset-1 ring-offset-cream"
                                : ""
                            }`}
                            style={parkChromaTileStyle(
                              park.bg_colour,
                              park.fg_colour,
                              colourTheme,
                            )}
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
                  </div>
                ) : groupKey !== "dining" ? (
                  <div className="flex flex-wrap gap-2">
                    {groupParks.map((park) => {
                      const selected = selectedParkId === park.id;
                      return (
                        <button
                          key={park.id}
                          type="button"
                          onClick={() =>
                            onSelectPark(selected ? null : park.id)
                          }
                          className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-2 text-left font-sans text-xs font-medium transition hover:brightness-[1.06] ${
                            selected
                              ? "scale-105 ring-2 ring-[color:var(--tt-ring)] ring-offset-1 ring-offset-cream"
                              : ""
                          }`}
                          style={parkChromaTileStyle(
                            park.bg_colour,
                            park.fg_colour,
                            colourTheme,
                          )}
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
                ) : null}

                {groupKey === "dining" && restaurantDiningParks.length > 0 ? (
                  <details
                    open
                    className="rounded-lg border border-royal/8 bg-white/40"
                  >
                    <summary className="cursor-pointer select-none px-2 py-1.5 font-sans text-xs font-semibold text-royal">
                      Restaurants
                    </summary>
                    <div className="flex flex-wrap gap-2 px-2 pb-2 pt-0.5">
                      {restaurantDiningParks.map((park) => {
                        const selected = selectedParkId === park.id;
                        return (
                          <button
                            key={park.id}
                            type="button"
                            data-tier-gate="none"
                            onClick={() =>
                              onSelectPark(selected ? null : park.id)
                            }
                            className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-2 text-left font-sans text-xs font-medium transition hover:brightness-[1.06] ${
                              selected
                                ? "scale-105 ring-2 ring-[color:var(--tt-ring)] ring-offset-1 ring-offset-cream"
                                : ""
                            }`}
                            style={parkChromaTileStyle(
                              park.bg_colour,
                              park.fg_colour,
                              colourTheme,
                            )}
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
                ) : null}

                <div className="flex flex-wrap gap-2">
                {groupCustom.map((tile) => {
                  const selected = selectedParkId === tile.id;
                  const menuOpen = menuTileId === tile.id;
                  return (
                    <div
                      key={tile.id}
                      className="relative inline-flex max-w-full items-stretch gap-0.5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onSelectPark(selected ? null : tile.id)
                        }
                        className={`relative inline-flex max-w-[calc(100%-1.75rem)] items-center gap-1 rounded-full pl-3 pr-2 py-2 text-left font-sans text-xs font-medium transition hover:brightness-[1.06] ${
                          selected
                            ? "scale-105 ring-2 ring-[color:var(--tt-ring)] ring-offset-1 ring-offset-cream"
                            : ""
                        }`}
                        style={parkChromaTileStyle(
                          tile.bg_colour,
                          tile.fg_colour,
                          colourTheme,
                        )}
                        title="Your custom tile"
                      >
                        <span
                          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[0.55rem] font-bold leading-none text-royal shadow-sm"
                          aria-hidden
                        >
                          ★
                        </span>
                        {tile.icon ? (
                          <span className="shrink-0" aria-hidden>
                            {tile.icon}
                          </span>
                        ) : null}
                        <span className="truncate">{tile.name}</span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-royal/25 bg-white px-1.5 font-sans text-xs font-bold text-royal hover:bg-cream"
                        aria-label="Tile menu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuTileId(menuOpen ? null : tile.id);
                        }}
                      >
                        ···
                      </button>
                      {menuOpen ? (
                        <div className="absolute right-0 top-full z-20 mt-1 min-w-[7.5rem] rounded-lg border border-royal/20 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left font-sans text-xs text-royal hover:bg-cream"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuTileId(null);
                              onEditCustom(tile);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left font-sans text-xs text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuTileId(null);
                              if (
                                confirm(
                                  `Delete “${tile.name}”? It will be removed from your calendar too.`,
                                )
                              ) {
                                onDeleteCustom(tile.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => onAddCustom(groupKey)}
                  className="flex min-h-[2.5rem] min-w-[6.5rem] flex-col items-center justify-center gap-0.5 rounded-full border-2 border-dashed border-royal/40 bg-transparent px-2 py-2 font-sans text-[0.65rem] font-semibold text-royal transition hover:border-royal hover:bg-royal/5"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>Add custom</span>
                </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      {!hasVisibleResults ? (
        <p className="mt-3 rounded-lg border border-dashed border-royal/20 bg-white/70 px-3 py-2 font-sans text-xs text-royal/70">
          No parks match your search yet.
        </p>
      ) : null}
      <RegionalDiningSection regionId={regionId} />
    </aside>
  );
}
