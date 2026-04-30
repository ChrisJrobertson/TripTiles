import { formatOutstandingPaymentsTotal } from "@/lib/payment-totals";
import type { TripPayment } from "@/types/payments";

function payment(
  id: string,
  amountPence: number,
  paidAt: string | null,
): TripPayment {
  return {
    id,
    trip_id: "trip-1",
    label: id,
    amount_pence: amountPence,
    currency: "GBP",
    booking_date: null,
    due_date: "2026-06-01",
    paid_at: paidAt,
    category: null,
    sort_order: 0,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  };
}

function assertEquals(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const paidAt = "2026-04-30T09:00:00.000Z";
const basePayments = [
  payment("Disney Cruise Line", 5000, paidAt),
  payment("Villa Stay 1", 100, paidAt),
  payment("Villa Stay 2", 100, paidAt),
];

assertEquals(
  formatOutstandingPaymentsTotal(basePayments),
  "£0.00",
  "paid payments are excluded from outstanding",
);

assertEquals(
  formatOutstandingPaymentsTotal(
    basePayments.map((p) =>
      p.id === "Disney Cruise Line" ? { ...p, paid_at: null } : p,
    ),
  ),
  "£50.00",
  "reversing one paid payment increases outstanding",
);

assertEquals(
  formatOutstandingPaymentsTotal(
    basePayments.map((p) => ({ ...p, paid_at: null })),
  ),
  "£52.00",
  "reversing multiple payments accumulates outstanding",
);

console.log("payment-totals tests passed");
