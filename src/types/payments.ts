export type PaymentCurrency = "GBP" | "USD";

export type TripPaymentCategory =
  | "cruise"
  | "villa"
  | "hotel"
  | "flights"
  | "tickets"
  | "insurance"
  | "dining"
  | "other";

export type TripPayment = {
  id: string;
  trip_id: string;
  label: string;
  amount_pence: number;
  currency: PaymentCurrency;
  booking_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  category: TripPaymentCategory | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
