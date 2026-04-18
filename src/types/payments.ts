export type PaymentCurrency = "GBP" | "USD";

export type TripPayment = {
  id: string;
  trip_id: string;
  label: string;
  amount_pence: number;
  currency: PaymentCurrency;
  booking_date: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
