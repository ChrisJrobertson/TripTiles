import { formatMoney } from "@/lib/format";
import type { TripPayment } from "@/types/payments";

export function formatOutstandingPaymentsTotal(payments: TripPayment[]): string {
  const unpaidPayments = payments.filter((payment) => !payment.paid_at);
  const gbp = unpaidPayments
    .filter((payment) => payment.currency === "GBP")
    .reduce((sum, payment) => sum + payment.amount_pence, 0);
  const usd = unpaidPayments
    .filter((payment) => payment.currency === "USD")
    .reduce((sum, payment) => sum + payment.amount_pence, 0);
  const parts: string[] = [];
  if (gbp > 0) parts.push(formatMoney(gbp, "GBP"));
  if (usd > 0) parts.push(formatMoney(usd, "USD"));
  return parts.length > 0 ? parts.join(" + ") : "£0.00";
}
