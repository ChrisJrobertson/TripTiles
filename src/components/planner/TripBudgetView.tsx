"use client";

import {
  deleteTripBudgetItemAction,
  insertTripBudgetItemAction,
  listTripBudgetItemsAction,
  updateTripBudgetItemAction,
  updateTripBudgetSettingsAction,
} from "@/actions/budget";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricPill } from "@/components/ui/MetricPill";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatMoney } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { BudgetCategory, Trip, TripBudgetItem } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const CATEGORIES: BudgetCategory[] = [
  "flights",
  "accommodation",
  "tickets",
  "dining",
  "transport",
  "insurance",
  "cruise",
  "shopping",
  "other",
];

const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  flights: "Flights",
  accommodation: "Accommodation",
  tickets: "Tickets",
  dining: "Dining",
  transport: "Transport",
  insurance: "Insurance",
  cruise: "Cruise",
  shopping: "Shopping",
  other: "Other",
};

const CURRENCIES = [
  { code: "GBP", label: "GBP (£)" },
  { code: "USD", label: "USD ($)" },
  { code: "EUR", label: "EUR (€)" },
  { code: "AUD", label: "AUD (A$)" },
  { code: "CAD", label: "CAD (C$)" },
  { code: "JPY", label: "JPY (¥)" },
  { code: "SGD", label: "SGD (S$)" },
  { code: "AED", label: "AED (د.إ)" },
];

type Props = {
  trip: Trip;
  onTripPatch: (patch: Partial<Trip>) => void;
  embedded?: boolean;
};

export function TripBudgetView({ trip, onTripPatch, embedded = false }: Props) {
  const [items, setItems] = useState<TripBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetDraft, setTargetDraft] = useState(
    trip.budget_target != null ? String(trip.budget_target) : "",
  );
  const [editing, setEditing] = useState<TripBudgetItem | "new" | null>(null);
  const [formCat, setFormCat] = useState<BudgetCategory>("other");
  const [formLabel, setFormLabel] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formPaid, setFormPaid] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await listTripBudgetItemsAction(trip.id);
    if (r.ok) setItems(r.items);
    setLoading(false);
  }, [trip.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setTargetDraft(trip.budget_target != null ? String(trip.budget_target) : "");
  }, [trip.budget_target, trip.id]);

  const totals = useMemo(() => {
    let sum = 0;
    let paid = 0;
    for (const it of items) {
      sum += it.amount;
      if (it.is_paid) paid += it.amount;
    }
    return { sum, paid, outstanding: sum - paid };
  }, [items]);

  const target =
    trip.budget_target != null && Number.isFinite(trip.budget_target)
      ? trip.budget_target
      : null;
  const pct =
    target != null && target > 0
      ? Math.min(150, Math.round((totals.sum / target) * 100))
      : null;
  const barClass =
    pct == null
      ? "bg-royal/20"
      : pct < 80
        ? "bg-emerald-500"
        : pct <= 100
          ? "bg-amber-500"
          : "bg-red-500";

  const openNew = () => {
    setEditing("new");
    setFormCat("other");
    setFormLabel("");
    setFormAmount("");
    setFormNotes("");
    setFormPaid(false);
  };

  const openEdit = (it: TripBudgetItem) => {
    setEditing(it);
    setFormCat(it.category);
    setFormLabel(it.label);
    setFormAmount(String(it.amount));
    setFormNotes(it.notes ?? "");
    setFormPaid(it.is_paid);
  };

  const saveTarget = async () => {
    const v = targetDraft.trim();
    const num = v === "" ? null : Number(v);
    if (num != null && (Number.isNaN(num) || num < 0)) return;
    const res = await updateTripBudgetSettingsAction({
      tripId: trip.id,
      budgetTarget: num,
      budgetCurrency: trip.budget_currency,
    });
    if (res.ok) {
      onTripPatch({ budget_target: num });
      showToast("Saved", {
        type: "success",
        debounceKey: "budget-settings-save",
        debounceMs: 500,
      });
    } else {
      showToast(res.error, { type: "error" });
    }
  };

  const saveCurrency = async (code: string) => {
    const res = await updateTripBudgetSettingsAction({
      tripId: trip.id,
      budgetTarget: trip.budget_target,
      budgetCurrency: code,
    });
    if (res.ok) {
      onTripPatch({ budget_currency: code });
      showToast("Saved", {
        type: "success",
        debounceKey: "budget-settings-save",
        debounceMs: 500,
      });
    } else {
      showToast(res.error, { type: "error" });
    }
  };

  const submitForm = async () => {
    const amt = Number(formAmount);
    if (!formLabel.trim() || Number.isNaN(amt) || amt < 0) return;
    if (editing === "new") {
      const r = await insertTripBudgetItemAction({
        tripId: trip.id,
        category: formCat,
        label: formLabel,
        amount: amt,
        notes: formNotes || null,
        isPaid: formPaid,
      });
      if (r.ok) {
        setEditing(null);
        void reload();
        showToast("Budget item added", { type: "success" });
      } else {
        showToast(r.error, { type: "error" });
      }
    } else if (editing) {
      const r = await updateTripBudgetItemAction({
        itemId: editing.id,
        tripId: trip.id,
        category: formCat,
        label: formLabel,
        amount: amt,
        notes: formNotes || null,
        isPaid: formPaid,
      });
      if (r.ok) {
        setEditing(null);
        void reload();
        showToast("Budget item updated", { type: "success" });
      } else {
        showToast(r.error, { type: "error" });
      }
    }
  };

  const togglePaid = async (it: TripBudgetItem) => {
    const r = await updateTripBudgetItemAction({
      itemId: it.id,
      tripId: trip.id,
      isPaid: !it.is_paid,
    });
    if (r.ok) {
      void reload();
      showToast("Saved", {
        type: "success",
        debounceKey: "budget-toggle-paid",
        debounceMs: 500,
      });
    } else {
      showToast(r.error, { type: "error" });
    }
  };

  const removeItem = async (it: TripBudgetItem) => {
    if (!confirm("Remove this item?")) return;
    const r = await deleteTripBudgetItemAction({ itemId: it.id, tripId: trip.id });
    if (r.ok) {
      void reload();
      showToast("Budget item deleted", { type: "success" });
    } else {
      showToast(r.error, { type: "error" });
    }
  };

  const byCategory = useMemo(() => {
    const m = new Map<BudgetCategory, TripBudgetItem[]>();
    for (const c of CATEGORIES) m.set(c, []);
    for (const it of items) {
      const list = m.get(it.category) ?? [];
      list.push(it);
      m.set(it.category, list);
    }
    return m;
  }, [items]);

  return (
    <section
      className={`space-y-6 ${embedded ? "" : "mx-auto max-w-3xl pb-24"}`}
    >
      {!embedded ? (
        <SectionHeader title="Trip budget" subtitle="Track costs against your target." icon="📊" />
      ) : null}

      <Card variant="default" className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <label className="font-sans text-sm text-tt-ink">
            <span className="font-semibold">Budget target</span>
            <input
              type="text"
              inputMode="decimal"
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              onBlur={() => void saveTarget()}
              placeholder="Optional"
              className="mt-1 block w-full min-h-11 max-w-xs rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-tt-ink sm:w-48"
            />
          </label>
          <label className="font-sans text-sm text-tt-ink">
            <span className="font-semibold">Currency</span>
            <select
              value={trip.budget_currency}
              onChange={(e) => void saveCurrency(e.target.value)}
              className="mt-1 block w-full min-h-11 max-w-xs rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-tt-ink"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetricPill label="Total" value={formatMoney(totals.sum, trip.budget_currency)} />
          <MetricPill
            label="Paid"
            value={formatMoney(totals.paid, trip.budget_currency)}
            variant="success"
          />
          <MetricPill
            label="Outstanding"
            value={formatMoney(totals.outstanding, trip.budget_currency)}
            variant="warning"
          />
          {target != null ? (
            <MetricPill
              label="Target"
              value={`${formatMoney(target, trip.budget_currency)}${pct != null ? ` · ${pct}%` : ""}`}
              variant="magic"
            />
          ) : null}
        </div>
        {target != null && target > 0 ? (
          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-tt-royal-soft"
            role="progressbar"
            aria-valuenow={pct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all ${barClass}`}
              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
            />
          </div>
        ) : null}
      </Card>

      {loading ? (
        <div className="space-y-3 rounded-2xl border border-royal/10 bg-white p-5">
          <div className="h-4 w-1/3 animate-pulse rounded bg-royal/10" />
          <div className="h-4 w-full animate-pulse rounded bg-royal/10" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-royal/10" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="💷"
          title="Set a total budget and break it down"
          description="Track flights, hotels, tickets, dining, and see how you're doing against your target."
          action={<Button onClick={openNew}>+ Add your first item</Button>}
        />
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map((cat) => {
            const list = byCategory.get(cat) ?? [];
            if (list.length === 0) return null;
            const sub = list.reduce((a, b) => a + b.amount, 0);
            return (
              <div key={cat}>
                <div className="sticky top-0 z-10 -mx-1 border-b border-tt-line bg-tt-bg/95 px-1 py-2 backdrop-blur">
                  <h3 className="font-meta text-sm font-bold uppercase tracking-wide text-tt-royal">
                    {CATEGORY_LABEL[cat]} ·{" "}
                    {formatMoney(sub, trip.budget_currency)}
                  </h3>
                </div>
                <ul className="mt-2 space-y-2">
                  {list.map((it) => (
                    <li
                      key={it.id}
                      className="flex flex-col gap-2 rounded-tt-lg border border-tt-line bg-tt-surface p-3 shadow-tt-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <button
                          type="button"
                          aria-label={it.is_paid ? "Mark unpaid" : "Mark paid"}
                          onClick={() => void togglePaid(it)}
                          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-tt-md border border-tt-line text-lg"
                        >
                          {it.is_paid ? "✅" : "⬜"}
                        </button>
                        <div className="min-w-0">
                          <p
                            className={`font-sans text-sm font-medium text-tt-ink ${
                              it.is_paid ? "opacity-60 line-through" : ""
                            }`}
                          >
                            {it.label}
                          </p>
                          {it.notes ? (
                            <p className="mt-0.5 font-sans text-xs text-tt-ink-soft">
                              {it.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <span className="font-sans text-sm font-semibold text-tt-royal">
                          {formatMoney(it.amount, it.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEdit(it)}
                          className="min-h-11 min-w-11 rounded-tt-md border border-tt-line px-2 font-sans text-xs text-tt-royal"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeItem(it)}
                          className="min-h-11 min-w-11 rounded-lg border border-red-200 px-2 font-sans text-xs text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 ? (
        <Button
          type="button"
          variant="secondary"
          onClick={openNew}
          className="w-full border-dashed"
        >
          + Add item
        </Button>
      ) : null}

      {editing ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-royal/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-royal/15 bg-cream p-5 shadow-xl">
            <h3 className="font-serif text-lg font-semibold text-royal">
              {editing === "new" ? "Add item" : "Edit item"}
            </h3>
            <div className="mt-4 space-y-3 font-sans text-sm">
              <label className="block text-royal">
                Category
                <select
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value as BudgetCategory)}
                  className="mt-1 w-full min-h-11 rounded-lg border border-royal/20 px-2"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-royal">
                Label
                <input
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  className="mt-1 w-full min-h-11 rounded-lg border border-royal/20 px-2"
                  autoFocus
                />
              </label>
              <label className="block text-royal">
                Amount
                <input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="mt-1 w-full min-h-11 rounded-lg border border-royal/20 px-2"
                />
              </label>
              <label className="block text-royal">
                Notes (optional)
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-royal/20 px-2 py-2"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-royal">
                <input
                  type="checkbox"
                  checked={formPaid}
                  onChange={(e) => setFormPaid(e.target.checked)}
                  className="h-5 w-5"
                />
                Paid
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="min-h-11 flex-1 rounded-lg border border-royal/25 px-4 py-2 font-sans text-sm text-royal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitForm()}
                className="min-h-11 flex-1 rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
