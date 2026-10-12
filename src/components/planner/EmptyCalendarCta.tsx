"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  onGenerateAi: () => void;
  onAddManually: () => void;
  onSurpriseMe?: () => void;
};

/**
 * Shown above the date grid when no day has a park or rest assignment yet.
 * The dates stay visible underneath.
 */
export function EmptyCalendarCta({
  onGenerateAi,
  onAddManually,
  onSurpriseMe,
}: Props) {
  return (
    <div
      className="mb-3 rounded-tt-lg border border-tt-line bg-tt-surface px-4 py-3"
      role="region"
      aria-label="Start assigning days"
    >
      <p className="font-heading text-sm font-semibold text-tt-royal">
        These are your holiday days
      </p>
      <p className="mt-1 font-sans text-sm leading-relaxed text-tt-ink-muted">
        Nothing is assigned yet. Pick a park, then tap a day — or let Trip
        draft the calendar.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={onAddManually}>
          Assign days
        </Button>
        <Button type="button" onClick={onGenerateAi} variant="secondary">
          Ask Trip to plan
        </Button>
        {onSurpriseMe ? (
          <Button type="button" onClick={onSurpriseMe} variant="accent">
            Surprise me
          </Button>
        ) : null}
      </div>
    </div>
  );
}
