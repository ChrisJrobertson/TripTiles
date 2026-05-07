const TRUST_LINE =
  "Built in the UK · GDPR-first · Cancel anytime · 30-day refund · Pay nothing to try";

export function MarketingTrustStrip() {
  return (
    <div
      className="border-y border-tt-line-soft/80 bg-tt-surface-warm/85 px-6 py-10 backdrop-blur-sm"
      aria-label="Trust and safety"
    >
      <div className="mx-auto max-w-5xl text-center">
        <p className="font-sans text-sm font-medium leading-relaxed text-tt-royal/85 md:whitespace-nowrap">
          {TRUST_LINE}
        </p>
      </div>
    </div>
  );
}
