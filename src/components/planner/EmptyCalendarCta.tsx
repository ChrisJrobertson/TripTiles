"use client";

type Props = {
  onGenerateAi: () => void;
  onAddManually: () => void;
};

/**
 * Fallback entry points when the calendar has no tiles yet — keeps Smart Plan
 * optional and discoverable after manual-first wizard paths.
 */
export function EmptyCalendarCta({ onGenerateAi, onAddManually }: Props) {
  return (
    <div
      className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-[var(--tt-primary-soft,#1a2f75)]/25 bg-white/95 p-5 shadow-lg backdrop-blur-sm"
      role="region"
      aria-label="Get started with your calendar"
    >
      <p className="text-center font-serif text-lg font-semibold text-[var(--tt-text,#0B1E5C)]">
        Your calendar is empty
      </p>
      <p className="mt-2 text-center font-sans text-sm text-[var(--tt-text-muted,#5c6480)]">
        Generate a draft with Smart Plan, or add parks manually — your choice.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onGenerateAi}
          className="min-h-[44px] flex-1 rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 py-3 font-serif text-sm font-semibold text-royal shadow-sm transition hover:opacity-95"
        >
          Generate AI plan ✨
        </button>
        <button
          type="button"
          onClick={onAddManually}
          className="min-h-[44px] flex-1 rounded-lg border border-[var(--tt-primary,#0B1E5C)]/25 bg-cream px-4 py-3 font-sans text-sm font-semibold text-[var(--tt-text,#0B1E5C)] transition hover:bg-white"
        >
          Add manually
        </button>
      </div>
    </div>
  );
}
