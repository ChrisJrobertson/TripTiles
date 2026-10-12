"use client";

import { createPayment, updatePayment } from "@/actions/payments";
import { Button } from "@/components/ui/Button";
import { formatMoney, formatMoneyMajor } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { Trip, TripBudgetItem } from "@/lib/types";
import type { TripPayment } from "@/types/payments";
import { useState } from "react";

type StayType = "hotel" | "villa";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  budgetItems: TripBudgetItem[] | null;
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  onEditBudget: () => void;
};

const FIELD =
  "min-h-11 w-full max-w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-sm text-tt-ink";

function stayPayments(payments: TripPayment[]): TripPayment[] {
  return payments.filter((payment) => payment.category === "hotel" || payment.category === "villa");
}

function stayBudget(items: TripBudgetItem[] | null): TripBudgetItem[] {
  return (items ?? []).filter((item) => item.category === "accommodation");
}

function currencyFor(trip: Trip): "GBP" | "USD" {
  return trip.budget_currency === "USD" ? "USD" : "GBP";
}

export function OrganiseStay({
  trip,
  payments,
  budgetItems,
  onPaymentsChange,
  onEditBudget,
}: Props) {
  const stays = stayPayments(payments);
  const budgetStays = stayBudget(budgetItems);
  const loaded = budgetItems !== null || stays.length > 0;
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StayType>("hotel");
  const [amount, setAmount] = useState("");
  const [booked, setBooked] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setEditingId("new");
    setName("");
    setKind("hotel");
    setAmount("");
    setBooked("");
    setDue("");
  };

  const openEdit = (payment: TripPayment) => {
    setEditingId(payment.id);
    setName(payment.label);
    setKind(payment.category === "villa" ? "villa" : "hotel");
    setAmount(payment.amount_pence > 0 ? (payment.amount_pence / 100).toFixed(2) : "");
    setBooked(payment.booking_date ?? "");
    setDue(payment.due_date ?? "");
  };

  const save = async () => {
    const label = name.trim();
    if (!label) return;
    const parsed = amount.trim() === "" ? 0 : Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("Enter an amount, or leave it blank.", { type: "error" });
      return;
    }
    const amountPence = Math.round(parsed * 100);
    const currency = currencyFor(trip);
    setBusy(true);
    if (editingId && editingId !== "new") {
      const result = await updatePayment(editingId, {
        label,
        amountPence,
        currency,
        bookingDate: booked.trim() || null,
        dueDate: due.trim() || null,
        category: kind,
      });
      setBusy(false);
      if (!result.ok) {
        showToast(result.error, { type: "error" });
        return;
      }
      onPaymentsChange(
        trip.id,
        payments.map((payment) => (payment.id === editingId ? result.payment : payment)),
      );
      setEditingId(null);
      showToast("Stay updated", { type: "success" });
      return;
    }
    const result = await createPayment({
      tripId: trip.id,
      label,
      amountPence,
      currency,
      bookingDate: booked.trim() || null,
      dueDate: due.trim() || null,
      category: kind,
    });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, { type: "error" });
      return;
    }
    onPaymentsChange(trip.id, [...payments, result.payment]);
    setEditingId(null);
    showToast("Stay saved", { type: "success" });
  };

  if (!loaded) {
    return <p className="font-sans text-sm text-tt-ink-muted">Checking what’s saved…</p>;
  }

  return (
    <div className="space-y-4">
      {stays.length === 0 && budgetStays.length === 0 && editingId == null ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-sans text-sm font-semibold text-tt-ink">
              Add where you&apos;re staying
            </p>
            <p className="font-sans text-sm text-tt-ink-muted">
              This helps keep the whole trip together.
            </p>
          </div>
          <Button type="button" onClick={openNew}>
            Add stay
          </Button>
        </div>
      ) : null}

      {stays.length > 0 ? (
        <ul className="divide-y divide-tt-line-soft">
          {stays.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-sans text-sm font-medium text-tt-ink">{payment.label}</p>
                <p className="font-sans text-xs text-tt-ink-muted">
                  {payment.category === "villa" ? "Villa" : "Hotel"}
                  {" · "}
                  {formatMoney(payment.amount_pence, payment.currency)}
                  {payment.booking_date ? ` · Booked ${payment.booking_date}` : ""}
                  {payment.due_date ? ` · Balance due ${payment.due_date}` : ""}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(payment)}>
                Edit stay
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {budgetStays.length > 0 ? (
        <div>
          <p className="font-sans text-xs font-medium text-tt-ink-muted">Also in the budget</p>
          <ul className="mt-1 space-y-1">
            {budgetStays.map((item) => (
              <li key={item.id} className="font-sans text-sm text-tt-ink">
                {item.label}
                {" · "}
                {formatMoneyMajor(item.amount, item.currency)}
                {item.is_paid ? " · Paid" : " · Still to pay"}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onEditBudget}
            className="mt-2 inline-flex min-h-11 items-center font-sans text-sm font-semibold text-tt-royal underline decoration-tt-line underline-offset-4"
          >
            Edit in budget
          </button>
        </div>
      ) : null}

      {stays.length > 0 && editingId == null ? (
        <Button type="button" variant="ghost" size="sm" onClick={openNew}>
          Add another stay
        </Button>
      ) : null}

      {editingId != null ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1 font-sans text-sm sm:col-span-2">
            <span className="font-medium text-tt-ink-muted">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              className={FIELD}
              placeholder="e.g. Pop Century"
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-sm">
            <span className="font-medium text-tt-ink-muted">Type</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as StayType)}
              className={FIELD}
            >
              <option value="hotel">Hotel</option>
              <option value="villa">Villa</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 font-sans text-sm">
            <span className="font-medium text-tt-ink-muted">Amount</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={FIELD}
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-sm">
            <span className="font-medium text-tt-ink-muted">Booked</span>
            <input
              type="date"
              value={booked}
              onChange={(event) => setBooked(event.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 font-sans text-sm">
            <span className="font-medium text-tt-ink-muted">Balance due</span>
            <input
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              className={FIELD}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" variant="accent" disabled={busy || !name.trim()}>
              Save stay
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setEditingId(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
