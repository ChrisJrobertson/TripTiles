"use client";

import { parkChromaTileStyle } from "@/lib/theme-colours";
import type { ThemeKey } from "@/lib/themes";
import type { Park, SlotType } from "@/lib/types";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type ParkGroup = { name: string; parks: Park[] };

type Props = {
  open: boolean;
  onClose: () => void;
  parks: Park[];
  /** When set, picking a park assigns to this slot and closes. */
  pendingSlot: { dateKey: string; slot: SlotType } | null;
  onPickPark: (parkId: string) => void;
  colourTheme: ThemeKey;
};

function groupParks(parks: Park[]): ParkGroup[] {
  const map = new Map<string, Park[]>();
  for (const p of parks) {
    const g = p.park_group?.trim() || "Parks";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(p);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, plist]) => ({ name, parks: plist }));
}

export function MobileParksDrawer({
  open,
  onClose,
  parks,
  pendingSlot,
  onPickPark,
  colourTheme,
}: Props) {
  const titleId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => groupParks(parks), [parks]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        name: g.name,
        parks: g.parks.filter((p) => {
          const hay = `${p.name} ${p.icon ?? ""}`.toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter((g) => g.parks.length > 0);
  }, [groups, searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      return;
    }
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = drawerRef.current;
    if (!root) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...root.querySelectorAll<HTMLElement>(focusableSelector),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handlePick = useCallback(
    (parkId: string) => {
      onPickPark(parkId);
      onClose();
    },
    [onPickPark, onClose],
  );

  return (
    <div
      className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        role="presentation"
        tabIndex={-1}
        onClick={onClose}
        onKeyDown={undefined}
        style={{ touchAction: "none" }}
        className={`absolute inset-0 bg-royal/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl bg-cream shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-royal/20" aria-hidden />
        </div>

        <div className="flex items-center justify-between border-b border-gold/20 px-4 py-2">
          <h3
            id={titleId}
            className="font-serif text-lg font-bold text-royal"
          >
            {pendingSlot ? "Pick a park" : "Parks"}
          </h3>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-royal/60 transition active:bg-royal/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3">
          <input
            type="search"
            placeholder="Search parks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gold/30 bg-white px-4 py-3 font-sans text-sm text-royal placeholder:text-royal/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          {filteredGroups.length === 0 ? (
            <p className="py-6 text-center font-sans text-sm text-royal/60">
              No matches
            </p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.name} className="mb-6">
                <h4 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-gold">
                  {group.name}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.parks.map((park) => (
                    <button
                      key={park.id}
                      type="button"
                      onClick={() => handlePick(park.id)}
                      className="min-h-[44px] rounded-lg px-4 py-3 text-left font-sans text-sm font-medium transition hover:brightness-[1.05] active:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/50"
                      style={parkChromaTileStyle(
                        park.bg_colour,
                        park.fg_colour,
                        colourTheme,
                      )}
                    >
                      {park.icon ? `${park.icon} ` : ""}
                      {park.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
