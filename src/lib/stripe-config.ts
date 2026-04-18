/** Live Stripe price IDs (GBP). Validate checkout requests against this set. */

export function stripeNavigatorMonthlyPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_NAVIGATOR_MONTHLY?.trim();
}

export function stripeNavigatorYearlyPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_NAVIGATOR_YEARLY?.trim();
}

export function stripeCaptainMonthlyPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_CAPTAIN_MONTHLY?.trim();
}

export function stripeCaptainYearlyPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_CAPTAIN_YEARLY?.trim();
}

export function allowedStripePriceIds(): string[] {
  return [
    stripeNavigatorMonthlyPriceId(),
    stripeNavigatorYearlyPriceId(),
    stripeCaptainMonthlyPriceId(),
    stripeCaptainYearlyPriceId(),
  ].filter((x): x is string => Boolean(x));
}

export function isNavigatorPriceId(priceId: string): boolean {
  return (
    priceId === stripeNavigatorMonthlyPriceId() ||
    priceId === stripeNavigatorYearlyPriceId()
  );
}

export function tierFromStripePriceId(
  priceId: string,
): "navigator" | "captain" | null {
  const navM = stripeNavigatorMonthlyPriceId();
  const navY = stripeNavigatorYearlyPriceId();
  const capM = stripeCaptainMonthlyPriceId();
  const capY = stripeCaptainYearlyPriceId();
  const TIER_BY_PRICE: Record<string, "navigator" | "captain"> = {};
  if (navM) TIER_BY_PRICE[navM] = "navigator";
  if (navY) TIER_BY_PRICE[navY] = "navigator";
  if (capM) TIER_BY_PRICE[capM] = "captain";
  if (capY) TIER_BY_PRICE[capY] = "captain";
  return TIER_BY_PRICE[priceId] ?? null;
}
