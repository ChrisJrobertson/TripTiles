"use client";

import {
  deleteTripChecklistItemAction,
  insertTripChecklistItemAction,
  listTripChecklistItemsAction,
  resetTripChecklistTemplateAction,
  seedTripChecklistIfEmptyAction,
  updateTripChecklistItemCheckedAction,
} from "@/actions/checklist";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricPill } from "@/components/ui/MetricPill";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
        <SectionHeader
          title="Trip checklist"
          subtitle="Prep, packing, and day-of essentials."
          icon="✓"
        />
      ) : null}

      <div className="rounded-tt-lg border border-tt-line bg-tt-surface p-4 shadow-tt-sm sm:p-5">
        <MetricPill
          label="Checklist progress"
          value={`${checkedCount}/${items.length} done · ${pct}%`}
          icon="🎒"
          variant="warm"
        />
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-tt-royal-soft">
          <div
            className="h-full rounded-full bg-tt-gold transition-all"
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
        <EmptyState
          icon="🎒"
          title="No todos yet"
          description="Add your first one to keep track of what's left before you travel, or start with suggested family-holiday items."
          action={
            <Button
              type="button"
              disabled={seeding}
              loading={seeding}
              loadingLabel="Working…"
              onClick={() => void seedSuggested()}
            >
              Generate suggested list
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {ORDER.map((cat) => {
            const list = byCat.get(cat) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={cat}>
                <div className="sticky top-0 z-10 -mx-1 border-b border-tt-line bg-tt-bg/95 px-1 py-2 backdrop-blur">
                  <h3 className="font-meta text-sm font-bold uppercase tracking-wide text-tt-royal">
                    {LABELS[cat]}
                  </h3>
                </div>
                <ul className="mt-2 space-y-2">
                  {list.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-start gap-3 rounded-tt-lg border border-tt-line bg-tt-surface p-3 shadow-tt-sm"
                    >
                      <button
                        type="button"
                        aria-checked={it.is_checked}
                        role="checkbox"
                        onClick={() => void toggle(it)}
                        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-tt-md border border-tt-line text-lg"
                      >
                        {it.is_checked ? "☑️" : "☐"}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-sans text-sm text-tt-ink ${
                            it.is_checked ? "opacity-55 line-through" : ""
                          }`}
                        >
                          {it.label}
                          {it.is_custom ? (
                            <Badge variant="warning" className="ml-2 normal-case">
                              Custom
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void del(it)}
                        className="min-h-11 min-w-11 shrink-0 rounded-tt-md border border-tt-line font-sans text-xs text-tt-ink-soft hover:bg-tt-bg-soft"
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
        <div className="space-y-4 rounded-tt-lg border border-tt-line bg-tt-surface p-4 shadow-tt-sm">
          <p className="font-sans text-sm font-semibold text-tt-royal">
            Add custom item
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value as ChecklistCategory)}
              className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-2 font-sans text-sm text-tt-ink"
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
              className="min-h-11 flex-1 rounded-tt-md border border-tt-line bg-tt-surface px-3 font-sans text-sm text-tt-ink"
            />
            <Button
              type="button"
              onClick={() => void addCustom()}
            >
              Add
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void resetTemplate()}
          >
            ↻ Reset suggested items
          </Button>
        </div>
      ) : null}
    </section>
  );
}
