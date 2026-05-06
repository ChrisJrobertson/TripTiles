"use client";

import { Button } from "@/components/ui/Button";

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
      className="pointer-events-auto mx-auto max-w-md rounded-tt-xl border border-tt-line bg-tt-surface/95 p-5 shadow-tt-lg backdrop-blur-sm"
      role="region"
      aria-label="Get started with your calendar"
    >
      <div className="mb-4 flex justify-center" aria-hidden>
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-tt-gold/30 bg-tt-gold-soft/35 text-4xl shadow-tt-sm">
          ✨
        </div>
      </div>
      <p className="text-center font-heading text-lg font-semibold text-tt-royal">
        Your calendar is empty
      </p>
      <p className="mt-2 text-center font-sans text-sm text-tt-ink-muted">
        Let Trip draft your calendar with Smart Plan, or add parks manually —
        your choice.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Button
          type="button"
          onClick={onGenerateAi}
          className="flex-1 sm:min-w-[10rem]"
        >
          Ask Trip to plan ✨
        </Button>
        <Button
          type="button"
          onClick={onAddManually}
          variant="secondary"
          className="flex-1 sm:min-w-[10rem]"
        >
          Add manually
        </Button>
        {onSurpriseMe ? (
          <Button
            type="button"
            onClick={onSurpriseMe}
            variant="accent"
            className="flex-1 sm:min-w-[10rem]"
          >
            🎲 Surprise me
          </Button>
        ) : null}
      </div>
    </div>
  );
}
