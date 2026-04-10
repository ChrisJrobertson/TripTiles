"use client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
};

export function TierLimitModal({ isOpen, onClose, reason }: Props) {
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
          Upgrade to plan more trips
        </h2>
        <p className="mt-3 font-sans text-sm text-royal/80">{reason}</p>
        <p className="mt-2 font-sans text-sm text-royal/70">
          The free plan includes 1 trip. Unlock unlimited trips with TripTiles
          Pro.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/pricing"
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream sm:flex-none"
          >
            See pricing
          </a>
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
