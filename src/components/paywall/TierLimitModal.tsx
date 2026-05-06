"use client";

import Link from "next/link";
import {
  formatProductTierName,
  type ProductTier,
} from "@/lib/product-tier-labels";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";

type Variant = "trips" | "ai" | "custom";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  variant?: Variant;
  /** Paid plan to promote in the CTA. */
  upgradeTargetTier?: Exclude<ProductTier, "free">;
};

const ACCENT_LINK =
  "inline-flex flex-1 items-center justify-center gap-2 rounded-tt-md border-0 bg-tt-gold px-4 py-2 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-gold/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-gold sm:flex-none min-h-11";

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
    <ModalShell
      zClassName="z-[70]"
      overlayClassName="bg-tt-royal/70 backdrop-blur-[1px]"
      maxWidthClass="max-w-md"
      role="dialog"
      aria-modal={true}
      aria-labelledby="tier-limit-title"
    >
      <div className="p-6 sm:p-8">
        <h2
          id="tier-limit-title"
          className="font-heading text-xl font-semibold text-tt-royal"
        >
          {headingFor(variant, upgradeTargetTier)}
        </h2>
        <p className="mt-3 font-sans text-sm text-tt-royal/80">{reason}</p>
        <p className="mt-2 font-sans text-sm text-tt-royal/70">
          {subFor(variant, upgradeTargetTier)}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className={ACCENT_LINK}>
            {ctaLabel}
          </Link>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={onClose}
          >
            Maybe later
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
