"use client";

import {
  deleteTripChecklistItemAction,
  insertTripChecklistItemAction,
  listTripChecklistItemsAction,
  resetTripChecklistTemplateAction,
  seedTripChecklistIfEmptyAction,
  updateTripChecklistItemCheckedAction,
} from "@/actions/checklist";
import type { ChecklistCategory, Trip, TripChecklistItem } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const ORDER: ChecklistCategory[] = [
  "packing_essentials",
  "packing_clothing",
  "packing_kids",
  "packing_tech",
  "before_you_go",
  "at_the_park",
];

const LABELS: Record<ChecklistCategory, string> = {
  packing_essentials: "Essentials",
  packing_clothing: "Clothing",
  packing_kids: "Kids",
  packing_tech: "Tech",
  before_you_go: "Before you go",
  at_the_park: "At the park",
};

type Props = {
  trip: Trip;
  embedded?: boolean;
};

export function TripChecklistView({ trip, embedded = false }: Props) {
  const [items, setItems] = useState<TripChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customLabel, setCustomLabel] = useState("");
  const [customCat, setCustomCat] = useState<ChecklistCategory>("packing_essentials");
  const [seeding, setSeeding] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await listTripChecklistItemsAction(trip.id);
    if (r.ok) setItems(r.items);
    setLoading(false);
  }, [trip.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const checkedCount = useMemo(
    () => items.filter((i) => i.is_checked).length,
    [items],
  );
  const pct =
    items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);

  const byCat = useMemo(() => {
    const m = new Map<ChecklistCategory, TripChecklistItem[]>();
    for (const c of ORDER) m.set(c, []);
    for (const it of items) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return m;
  }, [items]);

  const seedSuggested = async () => {
    setSeeding(true);
    const r = await seedTripChecklistIfEmptyAction({
      tripId: trip.id,
      regionId: trip.region_id ?? "orlando",
      startDate: trip.start_date,
      children: trip.children,
      hasCruise: trip.has_cruise,
    });
    setSeeding(false);
    if (r.ok) void reload();
  };

  const resetTemplate = async () => {
    if (
      !confirm(
        "Reset suggested items? Custom items stay; suggested packing rows are replaced.",
      )
    )
      return;
    const r = await resetTripChecklistTemplateAction({
      tripId: trip.id,
      regionId: trip.region_id ?? "orlando",
      startDate: trip.start_date,
      children: trip.children,
      hasCruise: trip.has_cruise,
    });
    if (r.ok) void reload();
  };

  const toggle = async (it: TripChecklistItem) => {
    const r = await updateTripChecklistItemCheckedAction({
      itemId: it.id,
      tripId: trip.id,
      isChecked: !it.is_checked,
    });
    if (r.ok) void reload();
  };

  const del = async (it: TripChecklistItem) => {
    if (!confirm("Remove this item?")) return;
    const r = await deleteTripChecklistItemAction({ itemId: it.id, tripId: trip.id });
    if (r.ok) void reload();
  };

  const addCustom = async () => {
    if (!customLabel.trim()) return;
    const r = await insertTripChecklistItemAction({
      tripId: trip.id,
      category: customCat,
      label: customLabel.trim(),
    });
    if (r.ok) {
      setCustomLabel("");
      void reload();
    }
  };

  return (
    <section className={`space-y-6 ${embedded ? "" : "mx-auto max-w-3xl pb-24"}`}>
      {!embedded ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-serif text-2xl font-semibold text-royal">
            Trip checklist
          </h2>
        </div>
      ) : null}

      <div className="rounded-2xl border border-royal/10 bg-white p-4 shadow-sm sm:p-6">
        <p className="font-sans text-sm text-royal/80">
          {checkedCount}/{items.length} items done · {pct}%
        </p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-royal/10">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-14 rounded-xl border border-royal/10 bg-royal/5 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-royal/20 bg-cream/60 p-8 text-center">
          <p className="font-sans text-sm text-royal/80">
            No todos yet. Add your first one to keep track of what&apos;s left before you travel.
          </p>
          <p className="mt-2 font-sans text-xs text-royal/65">
            Start with the suggested list, then customise items for your family.
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void seedSuggested()}
            className="mt-4 min-h-11 rounded-lg bg-royal px-5 py-2.5 font-sans text-sm font-semibold text-cream disabled:opacity-50"
          >
            {seeding ? "Working…" : "Generate suggested list"}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {ORDER.map((cat) => {
            const list = byCat.get(cat) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={cat}>
                <div className="sticky top-0 z-10 -mx-1 border-b border-gold/30 bg-cream/95 px-1 py-2 backdrop-blur">
                  <h3 className="font-sans text-sm font-bold uppercase tracking-wide text-royal">
                    {LABELS[cat]}
                  </h3>
                </div>
                <ul className="mt-2 space-y-2">
                  {list.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-start gap-3 rounded-xl border border-royal/10 bg-white p-3"
                    >
                      <button
                        type="button"
                        aria-checked={it.is_checked}
                        role="checkbox"
                        onClick={() => void toggle(it)}
                        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-royal/15 text-lg"
                      >
                        {it.is_checked ? "☑️" : "☐"}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-sans text-sm text-royal ${
                            it.is_checked ? "opacity-55 line-through" : ""
                          }`}
                        >
                          {it.label}
                          {it.is_custom ? (
                            <span className="ml-2 rounded bg-gold/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-royal">
                              Custom
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void del(it)}
                        className="min-h-11 min-w-11 shrink-0 rounded-lg border border-royal/15 font-sans text-xs text-royal/70"
                        aria-label="Delete item"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-royal/10 bg-white p-4">
          <p className="font-sans text-sm font-semibold text-royal">
            Add custom item
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value as ChecklistCategory)}
              className="min-h-11 rounded-lg border border-royal/20 px-2 font-sans text-sm"
            >
              {ORDER.map((c) => (
                <option key={c} value={c}>
                  {LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Gran’s birthday card"
              className="min-h-11 flex-1 rounded-lg border border-royal/20 px-3 font-sans text-sm"
            />
            <button
              type="button"
              onClick={() => void addCustom()}
              className="min-h-11 rounded-lg bg-royal px-4 font-sans text-sm font-semibold text-cream"
            >
              Add
            </button>
          </div>
          <button
            type="button"
            onClick={() => void resetTemplate()}
            className="min-h-11 w-full rounded-lg border border-royal/20 py-2 font-sans text-sm text-royal hover:bg-cream"
          >
            ↻ Reset suggested items
          </button>
        </div>
      ) : null}
    </section>
  );
}
