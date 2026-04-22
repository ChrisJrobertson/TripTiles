"use client";

import { TrippMascotImg } from "@/components/mascot/TrippMascotImg";

type Props = {
  onGenerateAi: () => void;
  onAddManually: () => void;
  onSurpriseMe?: () => void;
};

/**
 * Fallback entry points when the calendar has no tiles yet — keeps Smart Plan
 * optional and discoverable after manual-first wizard paths.
 */
export function EmptyCalendarCta({
  onGenerateAi,
  onAddManually,
  onSurpriseMe,
}: Props) {
  return (
    <div
      className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-royal/15 bg-white/95 p-5 shadow-lg backdrop-blur-sm"
      role="region"
      aria-label="Get started with your calendar"
    >
      <div className="mb-4 flex justify-center">
        <TrippMascotImg
          width={96}
          height={96}
          className="h-24 w-24 object-contain"
        />
      </div>
      <p className="text-center font-serif text-lg font-semibold text-royal">
        Your calendar is empty
      </p>
      <p className="mt-2 text-center font-sans text-sm text-royal/70">
        Let Trip draft your calendar with Smart Plan, or add parks manually —
        your choice.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <button
          type="button"
          onClick={onGenerateAi}
          className="min-h-[44px] flex-1 rounded-lg bg-[color:var(--tt-ring)] px-4 py-3 font-serif text-sm font-semibold text-white shadow-sm transition hover:brightness-105 sm:min-w-[10rem]"
        >
          Ask Trip to plan ✨
        </button>
        <button
          type="button"
          onClick={onAddManually}
          className="min-h-[44px] flex-1 rounded-lg border border-royal/20 bg-cream px-4 py-3 font-sans text-sm font-semibold text-royal transition hover:bg-white sm:min-w-[10rem]"
        >
          Add manually
        </button>
        {onSurpriseMe ? (
          <button
            type="button"
            onClick={onSurpriseMe}
            className="min-h-[44px] flex-1 rounded-lg border-2 border-gold/40 bg-white px-4 py-3 font-sans text-sm font-semibold text-royal transition hover:bg-cream sm:min-w-[10rem]"
          >
            🎲 Surprise me
          </button>
        ) : null}
      </div>
    </div>
  );
}
