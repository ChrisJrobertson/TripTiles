"use client";

import {
  createPayment,
  deletePayment,
  updatePayment,
} from "@/actions/payments";
import { PdfExportButton } from "@/components/planner/PdfExportButton";
import { currencyApproximationText, formatMoney } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { Trip } from "@/lib/types";
import type { PaymentCurrency, TripPayment } from "@/types/payments";
import { useCallback, useMemo, useState } from "react";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  embedded?: boolean;
};

function sortPayments(items: TripPayment[]): TripPayment[] {
  return [...items].sort((a, b) => {
    const da = a.due_date;
    const db = b.due_date;
    if (da == null && db == null) return a.sort_order - b.sort_order;
    if (da == null) return 1;
    if (db == null) return -1;
    if (da < db) return -1;
    if (da > db) return 1;
    return a.sort_order - b.sort_order;
  });
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysKey(dateKey: string, days: number): string {
  const [y, mo, da] = dateKey.split("-").map(Number);
  const d = new Date(y!, (mo ?? 1) - 1, da);
  d.setDate(d.getDate() + days);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseAmountToPence(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function paymentStatus(
  due: string | null,
  today: string,
): "overdue" | "due_soon" | "normal" {
  if (!due) return "normal";
  if (due < today) return "overdue";
  if (due <= addDaysKey(today, 14)) return "due_soon";
  return "normal";
}

export function PaymentsTab({
  trip,
  payments,
  onPaymentsChange,
  embedded = false,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState<PaymentCurrency>("GBP");
  const [formBooking, setFormBooking] = useState("");
  const [formDue, setFormDue] = useState("");

  const sorted = useMemo(() => sortPayments(payments), [payments]);
  const today = useMemo(() => todayKey(), []);

  const resetForm = useCallback(() => {
    setFormLabel("");
    setFormAmount("");
    setFormCurrency("GBP");
    setFormBooking("");
    setFormDue("");
  }, []);

  const startAdd = () => {
    resetForm();
    setEditingId(null);
    setAdding(true);
    setDeleteConfirmId(null);
  };

  const startEdit = (p: TripPayment) => {
    setAdding(false);
    setEditingId(p.id);
    setDeleteConfirmId(null);
    setFormLabel(p.label);
    setFormAmount((p.amount_pence / 100).toFixed(2));
    setFormCurrency(p.currency);
    setFormBooking(p.booking_date ?? "");
    setFormDue(p.due_date ?? "");
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    resetForm();
  };

  const applyList = useCallback(
    (next: TripPayment[]) => {
      onPaymentsChange(trip.id, sortPayments(next));
    },
    [onPaymentsChange, trip.id],
  );

  const onSave = async () => {
    const pence = parseAmountToPence(formAmount);
    if (pence === null) {
      showToast("Enter a valid amount (zero or more, up to two decimal places).");
      return;
    }
    setBusy(true);
    if (editingId) {
      const r = await updatePayment(editingId, {
        label: formLabel,
        amountPence: pence,
        currency: formCurrency,
        bookingDate: formBooking.trim() || null,
        dueDate: formDue.trim() || null,
      });
      setBusy(false);
      if (!r.ok) {
        showToast(r.error);
        return;
      }
      applyList(payments.map((x) => (x.id === editingId ? r.payment : x)));
      cancelForm();
      return;
    }
    const r = await createPayment({
      tripId: trip.id,
      label: formLabel,
      amountPence: pence,
      currency: formCurrency,
      bookingDate: formBooking.trim() || null,
      dueDate: formDue.trim() || null,
    });
    setBusy(false);
    if (!r.ok) {
      showToast(r.error);
      return;
    }
    applyList([...payments, r.payment]);
    cancelForm();
  };

  const onConfirmDelete = async (id: string) => {
    setBusy(true);
    const r = await deletePayment(id);
    setBusy(false);
    if (!r.ok) {
      showToast(r.error);
      return;
    }
    applyList(payments.filter((x) => x.id !== id));
    setDeleteConfirmId(null);
  };

  const totalsLine = useMemo(() => {
    const gbp = payments
      .filter((p) => p.currency === "GBP")
      .reduce((s, p) => s + p.amount_pence, 0);
    const usd = payments
      .filter((p) => p.currency === "USD")
      .reduce((s, p) => s + p.amount_pence, 0);
    const parts: string[] = [];
    if (gbp > 0) parts.push(formatMoney(gbp, "GBP"));
    if (usd > 0) parts.push(formatMoney(usd, "USD"));
    if (parts.length === 0) return "£0.00";
    return parts.join(" + ");
  }, [payments]);

  const formActive = adding || editingId !== null;

  return (
    <section
      className={`space-y-6 font-sans text-royal ${embedded ? "" : "mx-auto max-w-3xl pb-24"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-royal">
            Payments
          </h2>
          <p className="mt-1 text-sm text-royal/65">
            Track deposits, balances, tickets, and flights in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PdfExportButton
            tripId={trip.id}
            buttonLabel="Payments schedule PDF"
            defaultModeOnOpen="payments_schedule"
          />
          {!formActive ? (
            <button
              type="button"
              onClick={startAdd}
              className="min-h-[44px] rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-royal/90"
            >
              Add payment
            </button>
          ) : null}
        </div>
      </div>

      {formActive ? (
        <div className="rounded-2xl border border-royal/15 bg-white p-4 shadow-sm">
          <p className="font-serif text-sm font-semibold text-royal">
            {editingId ? "Edit payment" : "New payment"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-royal/80">Label</span>
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                maxLength={120}
                className="min-h-[44px] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-royal"
                placeholder="e.g. Villa balance"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-royal/80">Amount</span>
              <input
                inputMode="decimal"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="min-h-[44px] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-royal"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-royal/80">Currency</span>
              <select
                value={formCurrency}
                onChange={(e) =>
                  setFormCurrency(e.target.value as PaymentCurrency)
                }
                className="min-h-[44px] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-royal"
              >
                <option value="GBP">£ GBP</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-royal/80">Booking date (optional)</span>
              <input
                type="date"
                value={formBooking}
                onChange={(e) => setFormBooking(e.target.value)}
                className="min-h-[44px] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-royal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-royal/80">Due date (optional)</span>
              <input
                type="date"
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
                className="min-h-[44px] max-w-xs rounded-lg border border-royal/20 bg-cream px-3 py-2 text-royal"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !formLabel.trim()}
              onClick={() => void onSave()}
              className="min-h-[44px] min-w-[7rem] rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelForm}
              className="min-h-[44px] rounded-lg border border-royal/20 bg-white px-4 py-2 text-sm font-medium text-royal/80 transition hover:bg-cream disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {sorted.length === 0 && !formActive ? (
        <div className="rounded-2xl border border-dashed border-royal/20 bg-white/80 px-4 py-10 text-center text-sm text-royal/70">
          <p>
            Track cruise deposits, hotel balances, flights, tickets, and insurance
            here.
          </p>
          <button
            type="button"
            onClick={startAdd}
            className="mt-4 min-h-[44px] rounded-lg bg-royal px-4 py-2 font-semibold text-cream shadow-sm transition hover:bg-royal/90"
          >
            Add your first payment →
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {sorted.map((p) => {
          const st = paymentStatus(p.due_date, today);
          const borderClass =
            st === "overdue"
              ? "border-l-4 border-l-red-500"
              : st === "due_soon"
                ? "border-l-4 border-l-amber-500"
                : "border-l-4 border-l-transparent";
          const isEditing = editingId === p.id;
          if (isEditing) {
            return null;
          }
          return (
            <li
              key={p.id}
              className={`rounded-xl border border-royal/10 bg-white p-4 shadow-sm ${borderClass}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-royal">{p.label}</p>
                    {st === "overdue" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Overdue
                      </span>
                    ) : null}
                    {st === "due_soon" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Due soon
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-royal">
                      {formatMoney(p.amount_pence, p.currency)}
                    </p>
                    {currencyApproximationText(p.amount_pence, p.currency, {
                      tripCurrency: trip.budget_currency,
                    }) ? (
                      <p className="text-xs text-royal/50">
                        {currencyApproximationText(p.amount_pence, p.currency, {
                          tripCurrency: trip.budget_currency,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-royal/65">
                    {p.booking_date ? (
                      <span>Booked {p.booking_date}</span>
                    ) : null}
                    {p.due_date ? <span>Due {p.due_date}</span> : null}
                    {!p.booking_date && !p.due_date ? (
                      <span>No dates set</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    disabled={busy || formActive}
                    className="min-h-[44px] min-w-[5rem] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-sm font-semibold text-royal transition hover:bg-cream/80 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === p.id ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm text-royal/80">
                      <span>Are you sure?</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onConfirmDelete(p.id)}
                        className="min-h-[44px] rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDeleteConfirmId(null)}
                        className="min-h-[44px] rounded-lg border border-royal/20 px-3 py-2 text-sm font-medium"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || formActive}
                      onClick={() => {
                        setDeleteConfirmId(p.id);
                        setAdding(false);
                        setEditingId(null);
                      }}
                      className="min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {sorted.length > 0 ? (
        <div className="rounded-xl border border-royal/15 bg-cream/80 px-4 py-3 text-sm font-medium text-royal">
          Total outstanding: {totalsLine}
        </div>
      ) : null}
    </section>
  );
}
