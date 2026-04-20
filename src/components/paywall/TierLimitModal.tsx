"use client";

import Link from "next/link";
import {
  formatProductTierName,
  type ProductTier,
} from "@/lib/product-tier-labels";

type Variant = "trips" | "ai" | "custom";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  variant?: Variant;
  /** Paid plan to promote in the CTA. */
  upgradeTargetTier?: Exclude<ProductTier, "free">;
};

function headingFor(
  v: Variant,
  upgradeTargetTier: Exclude<ProductTier, "free">,
): string {
  const name = formatProductTierName(upgradeTargetTier);
  switch (v) {
    case "ai":
      return `Unlock Smart Plan with ${name}`;
    case "custom":
      return `${name} unlocks more custom tiles`;
    default:
      return `${name} unlocks more active trips`;
  }
}

function subFor(
  v: Variant,
  upgradeTargetTier: Exclude<ProductTier, "free">,
): string {
  const name = formatProductTierName(upgradeTargetTier);
  switch (v) {
    case "ai":
      return `${name} includes unlimited Smart Plan runs on your trips.`;
    case "custom":
      return `${name} raises your custom tile limit so you can build richer calendars.`;
    default:
      return `Free keeps one active trip at a time. ${name} raises your cap — pick the plan that fits on Pricing.`;
  }
}

export function TierLimitModal({
  isOpen,
  onClose,
  reason,
  variant = "trips",
  upgradeTargetTier = "pro",
}: Props) {
  if (!isOpen) return null;

  const ctaLabel = `Upgrade to ${formatProductTierName(upgradeTargetTier)}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(11,30,92,0.85)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tier-limit-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-[#FAF8F3] p-6 shadow-2xl sm:p-8">
        <h2
          id="tier-limit-title"
          className="font-serif text-xl font-semibold text-[#0B1E5C]"
        >
          {headingFor(variant, upgradeTargetTier)}
        </h2>
        <p className="mt-3 font-sans text-sm text-royal/80">{reason}</p>
        <p className="mt-2 font-sans text-sm text-royal/70">
          {subFor(variant, upgradeTargetTier)}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#C9A961] px-4 py-2.5 font-sans text-sm font-semibold text-[#0B1E5C] shadow-sm transition hover:bg-gold/90 sm:flex-none"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-royal/25 bg-white px-4 py-2.5 font-sans text-sm font-medium text-royal sm:flex-none"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
