"use client";

import type { Region } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "triptiles-recent-regions";
const MAX_RECENT = 5;

type Props = {
  regions: Region[];
  selectedRegionId: string | null;
  onChange: (id: string) => void;
};

const CONTINENT_ORDER = [
  "North America",
  "Europe",
  "Asia",
  "Middle East",
  "Oceania",
  "Cruise",
  "Other",
];

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  if (typeof window === "undefined") return;
  const prev = loadRecent().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, MAX_RECENT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function RegionPicker({
  regions,
  selectedRegionId,
  onChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const featured = useMemo(
    () => regions.filter((r) => r.is_featured),
    [regions],
  );

  const recentRegions = useMemo(() => {
    const map = new Map(regions.map((r) => [r.id, r]));
    return recent.map((id) => map.get(id)).filter(Boolean) as Region[];
  }, [recent, regions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.short_name.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q),
    );
  }, [regions, search]);

  const byContinent = useMemo(() => {
    const m = new Map<string, Region[]>();
    for (const r of filtered) {
      const c = r.continent || "Other";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(r);
    }
    return m;
  }, [filtered]);

  const continentKeys = useMemo(() => {
    const keys = [...byContinent.keys()];
    keys.sort((a, b) => {
      const ia = CONTINENT_ORDER.indexOf(a);
      const ib = CONTINENT_ORDER.indexOf(b);
      const fa = ia === -1 ? 999 : ia;
      const fb = ib === -1 ? 999 : ib;
      if (fa !== fb) return fa - fb;
      return a.localeCompare(b);
    });
    return keys;
  }, [byContinent]);

  function select(id: string) {
    onChange(id);
    saveRecent(id);
    setRecent(loadRecent());
  }

  function renderCard(r: Region, compact?: boolean) {
    const selected = selectedRegionId === r.id;
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => select(r.id)}
        className={`flex flex-col items-center rounded-xl border-2 px-3 py-4 text-center transition ${
          selected
            ? "border-gold bg-royal text-cream shadow-md"
            : "border-royal/15 bg-white/80 hover:border-gold/50"
        } ${compact ? "min-h-[5.5rem]" : ""}`}
      >
        <span className="text-3xl leading-none" aria-hidden>
          {r.flag_emoji ?? "🌍"}
        </span>
        <span
          className={`mt-2 font-sans text-sm font-semibold ${selected ? "text-cream" : "text-royal"}`}
        >
          {r.short_name}
        </span>
        <span
          className={`mt-0.5 font-sans text-xs ${selected ? "text-cream/80" : "text-royal/70"}`}
        >
          {r.country}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-sans text-sm font-medium text-royal">
          Search destinations
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search destinations..."
          className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-2.5 text-base text-royal"
        />
      </label>

      {recentRegions.length > 0 && !search.trim() ? (
        <div>
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-royal/60">
            Recently used
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recentRegions.map((r) => renderCard(r, true))}
          </div>
        </div>
      ) : null}

      {!search.trim() ? (
        <div>
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-royal/60">
            Featured
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {featured.map((r) => renderCard(r))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {filtered.map((r) => renderCard(r))}
        </div>
      )}

      {!search.trim() ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full rounded-lg border border-royal/25 bg-white py-2 font-sans text-sm font-medium text-royal"
        >
          {showAll ? "Hide extra destinations" : "Show all destinations"}
        </button>
      ) : null}

      {showAll && !search.trim() ? (
        <div className="space-y-6">
          {continentKeys.map((continent) => {
            const list = byContinent.get(continent);
            if (!list?.length) return null;
            return (
              <div key={continent}>
                <h3 className="mb-2 font-serif text-sm font-semibold text-royal">
                  {continent}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {list.map((r) => renderCard(r))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
