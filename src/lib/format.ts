const SYMBOL_BY_CURRENCY: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  SGD: "S$",
  AED: "د.إ",
};

const FALLBACK_CURRENCY = "GBP";

export const USD_TO_GBP = 0.75;

function normaliseCurrency(raw: string | null | undefined): string {
  const code = (raw ?? "").toUpperCase().trim();
  return code || FALLBACK_CURRENCY;
}

export function formatMoney(
  amountPence: number | null | undefined,
  currency: string | null | undefined,
): string {
  const code = normaliseCurrency(currency);
  const safePence = Number.isFinite(amountPence) ? Number(amountPence) : 0;
  const symbol = SYMBOL_BY_CURRENCY[code] ?? SYMBOL_BY_CURRENCY[FALLBACK_CURRENCY];
  const major = safePence / 100;
  return `${symbol}${major.toFixed(2)}`;
}

export function currencyApproximationText(
  amountPence: number | null | undefined,
  currency: string | null | undefined,
  options?: { tripCurrency?: string | null },
): string | null {
  const code = normaliseCurrency(currency);
  const tripCurrency = normaliseCurrency(options?.tripCurrency);
  if (code !== "USD" || tripCurrency !== "GBP") return null;
  const safePence = Number.isFinite(amountPence) ? Number(amountPence) : 0;
  // TODO: Replace this fixed conversion with a dynamic exchange-rate source post-launch.
  const approxGbpPence = Math.round(safePence * USD_TO_GBP);
  return `≈ ${formatMoney(approxGbpPence, "GBP")}`;
}

export function formatMoneyMajor(
  amountMajor: number | null | undefined,
  currency: string | null | undefined,
): string {
  const safeMajor = Number.isFinite(amountMajor) ? Number(amountMajor) : 0;
  return formatMoney(Math.round(safeMajor * 100), currency);
}
