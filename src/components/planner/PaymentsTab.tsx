"use client";

import { markPaymentPaid, markPaymentUnpaid } from "@/actions/planning";
import {
  createPayment,
  deletePayment,
  updatePayment,
} from "@/actions/payments";
import { CountdownChip } from "@/components/planning/CountdownChip";
import { PdfExportButton } from "@/components/planner/PdfExportButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { currencyApproximationText, formatMoney } from "@/lib/format";
import { formatOutstandingPaymentsTotal } from "@/lib/payment-totals";
import { showToast } from "@/lib/toast";
import type { Trip } from "@/lib/types";
import type { PaymentCurrency, TripPayment } from "@/types/payments";
import { useCallback, useMemo, useState } from "react";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  embedded?: boolean;
  /** When false, hides the payments title row (use an outer SectionHeader). */
  showTitleRow?: boolean;
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
  paidAt: string | null,
): "overdue" | "due_soon" | "normal" {
  if (paidAt) return "normal";
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
  showTitleRow = true,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [unpaidConfirmId, setUnpaidConfirmId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [markingUnpaidId, setMarkingUnpaidId] = useState<string | null>(null);
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
    setUnpaidConfirmId(null);
  };

  const startEdit = (p: TripPayment) => {
    setAdding(false);
    setEditingId(p.id);
    setDeleteConfirmId(null);
    setUnpaidConfirmId(null);
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
      showToast("Enter a valid amount (zero or more, up to two decimal places).", {
        type: "error",
      });
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
        showToast(r.error, { type: "error" });
        return;
      }
      applyList(payments.map((x) => (x.id === editingId ? r.payment : x)));
      showToast("Payment updated", {
        type: "success",
        debounceKey: "payment-write",
        debounceMs: 500,
      });
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
      showToast(r.error, { type: "error" });
      return;
    }
    applyList([...payments, r.payment]);
    showToast("Payment added", {
      type: "success",
      debounceKey: "payment-write",
      debounceMs: 500,
    });
    cancelForm();
  };

  const onMarkPaid = async (p: TripPayment) => {
    const snapshot = payments;
    const optimistic: TripPayment = {
      ...p,
      paid_at: new Date().toISOString(),
    };
    applyList(snapshot.map((x) => (x.id === p.id ? optimistic : x)));
    setMarkingPaidId(p.id);
    const r = await markPaymentPaid(p.id);
    setMarkingPaidId(null);
    if (!r.ok) {
      applyList(snapshot);
      showToast(r.error, { type: "error" });
      return;
    }
    applyList(snapshot.map((x) => (x.id === p.id ? r.payment : x)));
    showToast("Marked as paid", {
      type: "success",
      debounceKey: "payment-write",
      debounceMs: 500,
    });
  };

  const onConfirmMarkUnpaid = async (p: TripPayment) => {
    const snapshot = payments;
    const optimistic: TripPayment = {
      ...p,
      paid_at: null,
      updated_at: new Date().toISOString(),
    };
    applyList(snapshot.map((x) => (x.id === p.id ? optimistic : x)));
    setUnpaidConfirmId(null);
    setMarkingUnpaidId(p.id);
    const r = await markPaymentUnpaid(p.id);
    setMarkingUnpaidId(null);
    if (!r.ok) {
      applyList(snapshot);
      showToast(r.error, { type: "error" });
      return;
    }
    applyList(snapshot.map((x) => (x.id === p.id ? r.payment : x)));
    showToast("Marked as unpaid", {
      type: "success",
      debounceKey: "payment-write",
      debounceMs: 500,
    });
  };

  const onConfirmDelete = async (id: string) => {
    setBusy(true);
    const r = await deletePayment(id);
    setBusy(false);
    if (!r.ok) {
      showToast(r.error, { type: "error" });
      return;
    }
    applyList(payments.filter((x) => x.id !== id));
    showToast("Payment deleted", {
      type: "success",
      debounceKey: "payment-write",
      debounceMs: 500,
    });
    setDeleteConfirmId(null);
  };

  const totalsLine = useMemo(
    () => formatOutstandingPaymentsTotal(payments),
    [payments],
  );

  const formActive = adding || editingId !== null;

  return (
    <section
      className={`space-y-6 font-sans text-tt-ink ${embedded ? "" : "mx-auto max-w-3xl pb-24"}`}
    >
      {showTitleRow ? (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Payments"
          subtitle="Track deposits, balances, tickets, and flights in one place."
          icon="💷"
        />
        <div className="flex flex-wrap items-center gap-2">
          <PdfExportButton
            tripId={trip.id}
            buttonLabel="Payments schedule PDF"
            defaultModeOnOpen="payments_schedule"
          />
          {!formActive ? (
            <Button
              type="button"
              onClick={startAdd}
            >
              Add payment
            </Button>
          ) : null}
        </div>
      </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PdfExportButton
            tripId={trip.id}
            buttonLabel="PDF"
            defaultModeOnOpen="payments_schedule"
          />
          {!formActive ? (
            <Button type="button" onClick={startAdd}>
              Add payment
            </Button>
          ) : null}
        </div>
      )}

      {formActive ? (
        <Card variant="default" className="p-4">
          <p className="font-heading text-sm font-semibold text-tt-royal">
            {editingId ? "Edit payment" : "New payment"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-tt-ink-muted">Label</span>
              <input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                maxLength={120}
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
                placeholder="e.g. Villa balance"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-tt-ink-muted">Amount</span>
              <input
                inputMode="decimal"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-tt-ink-muted">Currency</span>
              <select
                value={formCurrency}
                onChange={(e) =>
                  setFormCurrency(e.target.value as PaymentCurrency)
                }
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
              >
                <option value="GBP">£ GBP</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-tt-ink-muted">Booking date (optional)</span>
              <input
                type="date"
                value={formBooking}
                onChange={(e) => setFormBooking(e.target.value)}
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-tt-ink-muted">Due date (optional)</span>
              <input
                type="date"
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
                className="min-h-11 max-w-xs rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !formLabel.trim()}
              onClick={() => void onSave()}
              variant="accent"
            >
              Save
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={cancelForm}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {sorted.length === 0 && !formActive ? (
        <EmptyState
          icon="💷"
          title="No payments yet"
          description="Track cruise deposits, hotel balances, flights, tickets, and insurance here."
          action={<Button onClick={startAdd}>Add your first payment →</Button>}
        />
      ) : null}

      <ul className="space-y-3">
        {sorted.map((p) => {
          const st = paymentStatus(p.due_date, today, p.paid_at);
          const borderClass =
            st === "overdue"
              ? "border-l-4 border-l-red-500"
              : st === "due_soon"
                ? "border-l-4 border-l-amber-500"
                : "border-l-4 border-l-transparent";
          const isEditing = editingId === p.id;
          const statusBusy = markingPaidId === p.id || markingUnpaidId === p.id;
          if (isEditing) {
            return null;
          }
          return (
            <li
              key={p.id}
              className={`rounded-tt-lg border border-tt-line bg-tt-surface p-4 shadow-tt-sm ${borderClass}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-tt-ink">{p.label}</p>
                    {p.due_date || p.paid_at ? (
                      <CountdownChip
                        targetDate={p.due_date ?? p.paid_at!}
                        paidAt={p.paid_at}
                        label={`${p.label} due`}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-tt-royal">
                      {formatMoney(p.amount_pence, p.currency)}
                    </p>
                    {currencyApproximationText(p.amount_pence, p.currency, {
                      tripCurrency: trip.budget_currency,
                    }) ? (
                      <p className="text-xs text-tt-ink-soft">
                        {currencyApproximationText(p.amount_pence, p.currency, {
                          tripCurrency: trip.budget_currency,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-tt-ink-soft">
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
                  {!p.paid_at ? (
                    <button
                      type="button"
                      onClick={() => void onMarkPaid(p)}
                      disabled={busy || formActive || statusBusy}
                      className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-royal/25 bg-white px-3 py-2 text-sm font-semibold text-royal transition hover:bg-cream disabled:opacity-50"
                    >
                      Mark as paid ✓
                    </button>
                  ) : null}
                  {p.paid_at ? (
                    unpaidConfirmId === p.id ? (
                      <span className="flex flex-wrap items-center gap-2 text-sm text-royal/80">
                        <span>Mark unpaid?</span>
                        <button
                          type="button"
                          disabled={busy || statusBusy}
                          onClick={() => void onConfirmMarkUnpaid(p)}
                          className="min-h-[44px] rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-cream"
                        >
                          Yes, mark unpaid
                        </button>
                        <button
                          type="button"
                          disabled={busy || statusBusy}
                          onClick={() => setUnpaidConfirmId(null)}
                          className="min-h-[44px] rounded-lg border border-royal/20 px-3 py-2 text-sm font-medium"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setUnpaidConfirmId(p.id);
                          setDeleteConfirmId(null);
                          setAdding(false);
                          setEditingId(null);
                        }}
                        disabled={busy || formActive || statusBusy}
                        className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-royal/25 bg-white px-3 py-2 text-sm font-semibold text-royal transition hover:bg-cream disabled:opacity-50"
                      >
                        Mark as unpaid
                      </button>
                    )
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    disabled={busy || formActive || statusBusy}
                    className="min-h-[44px] min-w-[5rem] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-sm font-semibold text-royal transition hover:bg-cream/80 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === p.id ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm text-royal/80">
                      <span>Are you sure?</span>
                      <button
                        type="button"
                        disabled={busy || statusBusy}
                        onClick={() => void onConfirmDelete(p.id)}
                        className="min-h-[44px] rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Yes, delete
                      </button>
                      <button
                        type="button"
                        disabled={busy || statusBusy}
                        onClick={() => setDeleteConfirmId(null)}
                        className="min-h-[44px] rounded-lg border border-royal/20 px-3 py-2 text-sm font-medium"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || formActive || statusBusy}
                      onClick={() => {
                        setDeleteConfirmId(p.id);
                        setUnpaidConfirmId(null);
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
        <div className="rounded-tt-lg border border-tt-line bg-tt-surface-warm px-4 py-3 text-sm font-medium text-tt-royal shadow-tt-sm">
          Total outstanding: {totalsLine}
        </div>
      ) : null}
    </section>
  );
}
