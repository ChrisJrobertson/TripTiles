import type {
  PaymentCurrency,
  TripPayment,
  TripPaymentCategory,
} from "@/types/payments";

function mapCategory(v: unknown): TripPayment["category"] {
  if (v == null || v === "") return null;
  const s = String(v);
  const allowed: TripPaymentCategory[] = [
    "cruise",
    "villa",
    "hotel",
    "flights",
    "tickets",
    "insurance",
    "dining",
    "other",
  ];
  return allowed.includes(s as TripPaymentCategory)
    ? (s as TripPaymentCategory)
    : null;
}

export function mapPaymentRow(r: Record<string, unknown>): TripPayment {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    label: String(r.label ?? ""),
    amount_pence: Number(r.amount_pence ?? 0),
    currency: (r.currency === "USD" ? "USD" : "GBP") as PaymentCurrency,
    booking_date: r.booking_date != null ? String(r.booking_date) : null,
    due_date: r.due_date != null ? String(r.due_date) : null,
    paid_at: r.paid_at != null ? String(r.paid_at) : null,
    category: mapCategory(r.category),
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}
