const TRUST_SIGNALS: { icon: string; text: string }[] = [
  { icon: "🔒", text: "Card payments handled by Stripe" },
  { icon: "🧾", text: "Cancel anytime from your account" },
  { icon: "🛡️", text: "Privacy-first — we don’t sell planner data" },
  { icon: "🇬🇧", text: "UK-based team, clear support contact" },
];

export function MarketingTrustStrip() {
  return (
    <div
      className="border-y border-tt-line-soft/80 bg-tt-surface-warm/85 px-6 py-10 backdrop-blur-sm"
      aria-label="Trust and safety"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {TRUST_SIGNALS.map((row) => (
          <div
            key={row.text}
            className="flex max-w-[14rem] items-start gap-3 text-left sm:max-w-none"
          >
            <span className="text-xl" aria-hidden>
              {row.icon}
            </span>
            <p className="font-sans text-sm font-medium leading-snug text-tt-royal/85">
              {row.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
