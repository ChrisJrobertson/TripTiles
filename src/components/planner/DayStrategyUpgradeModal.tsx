"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics/client";

export function DayStrategyUpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-royal/50 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-strategy-upgrade-title"
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-gold/30 bg-cream p-6 shadow-2xl sm:rounded-2xl"
      >
        <h2
          id="day-strategy-upgrade-title"
          className="font-serif text-xl font-semibold text-royal"
        >
          Unlock AI Day Strategy ✨
        </h2>
        <p className="mt-4 font-sans text-sm leading-relaxed text-royal/85">
          Get sequenced ride plans that factor in:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-royal/85">
          <li>Lightning Lane Multi Pass strategy</li>
          <li>Universal Express Pass timing</li>
          <li>Single Rider lane recommendations</li>
          <li>Child height restrictions</li>
          <li>Optimal walking order between rides</li>
        </ul>
        <p className="mt-4 font-sans text-sm text-royal/75">
          This is a Pro feature designed for families who want to make every
          park hour count.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-royal px-4 py-3 font-sans text-sm font-semibold text-cream shadow-sm"
            onClick={() => {
              trackEvent("day_strategy_upgrade_cta", { target: "/pricing" });
              onClose();
            }}
          >
            Upgrade to Pro — £6.99/mo
          </Link>
          <button
            type="button"
            className="min-h-[48px] flex-1 rounded-lg border border-royal/20 bg-white px-4 py-3 font-sans text-sm font-medium text-royal"
            onClick={onClose}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
