"use client";

import Link from "next/link";

type Variant = "trips" | "ai" | "custom";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  variant?: Variant;
};

function headingFor(v: Variant): string {
  switch (v) {
    case "ai":
      return "Unlock unlimited Smart Plan";
    case "custom":
      return "Unlock unlimited custom tiles";
    default:
      return "Upgrade for unlimited trips";
  }
}

function subFor(v: Variant): string {
  switch (v) {
    case "ai":
      return "Pro and above include unlimited AI plans for every trip.";
    case "custom":
      return "Pro and above include unlimited custom tiles for your calendar.";
    default:
      return "The free plan includes one trip. Upgrade when you are ready for more.";
  }
}

export function TierLimitModal({
  isOpen,
  onClose,
  reason,
  variant = "trips",
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(11,30,92,0.85)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tier-limit-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-cream p-6 shadow-2xl sm:p-8">
        <h2
          id="tier-limit-title"
          className="font-serif text-xl font-semibold text-royal"
        >
          {headingFor(variant)}
        </h2>
        <p className="mt-3 font-sans text-sm text-royal/80">{reason}</p>
        <p className="mt-2 font-sans text-sm text-royal/70">{subFor(variant)}</p>
        <p className="mt-3 rounded-lg border border-royal/10 bg-white/80 px-3 py-2 font-sans text-xs leading-relaxed text-royal/75">
          Paying on Payhip? Use the <strong>same email</strong> as your
          TripTiles login so your upgrade applies automatically.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-gold px-4 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90 sm:flex-none"
          >
            See pricing →
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
