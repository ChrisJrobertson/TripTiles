"use client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function SmartPlanModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-royal/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-plan-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-cream p-8 shadow-xl">
        <h2
          id="smart-plan-title"
          className="font-serif text-xl font-semibold text-royal"
        >
          Smart Plan Generator
        </h2>
        <p className="mt-4 font-sans text-sm leading-relaxed text-royal/80">
          Coming soon — we&apos;re wiring up real AI in the next session
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-lg bg-royal py-3 font-serif text-sm font-semibold text-cream transition hover:bg-royal/90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
