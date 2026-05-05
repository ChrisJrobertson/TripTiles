"use client";

import { filterUserFacingAiWarningLinesForUi } from "@/lib/ai-user-facing-warnings";
import type {
  ParkDaySequenceItem,
  ParkDaySequenceOutput,
} from "@/lib/day-sequencer";
import { useMemo } from "react";

export interface SequenceTimelineProps {
  sequence: ParkDaySequenceOutput;
  attractionNameById: Record<string, string>;
  onRegenerate: () => void;
}

function rideTitle(
  item: Extract<ParkDaySequenceItem, { type: "ride" }>,
  names: Record<string, string>,
): string {
  return names[item.attraction_id] ?? "Ride";
}

export function SequenceTimeline({
  sequence,
  attractionNameById,
  onRegenerate,
}: SequenceTimelineProps) {
  const warningsUi = useMemo(
    () =>
      filterUserFacingAiWarningLinesForUi(
        sequence.warnings,
        "park_day_sequence.warnings",
      ),
    [sequence.warnings],
  );
  const rope = sequence.rope_drop_recommendation?.trim();

  return (
    <div className="space-y-4 text-royal">
      {rope ? (
        <div
          className="flex gap-2 rounded-lg px-3 py-3 shadow-sm"
          style={{ backgroundColor: "#2455ac", color: "#fce7cc" }}
        >
          <span aria-hidden className="shrink-0 text-lg">
            ✨
          </span>
          <p className="font-sans text-sm leading-relaxed">{rope}</p>
        </div>
      ) : null}

      <ol className="space-y-3">
        {sequence.sequence.map((item) => {
          if (item.type === "ride") {
            const title = rideTitle(item, attractionNameById);
            return (
              <li
                key={`${item.type}-${item.order}`}
                className="rounded-r-lg border-l-4 border-royal bg-white/90 py-3 pl-3 pr-2 shadow-sm"
              >
                <div className="font-mono text-sm font-medium text-royal">
                  {item.time_estimate}
                </div>
                <h3 className="font-display text-base font-semibold text-royal">
                  {title}
                </h3>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 font-sans text-xs font-medium text-royal"
                  style={{ backgroundColor: "rgba(201, 169, 97, 0.35)" }}
                >
                  {item.expected_wait_band}
                </span>
                {item.note ? (
                  <p className="mt-1 font-sans text-xs leading-relaxed text-royal/75">
                    {item.note}
                  </p>
                ) : null}
              </li>
            );
          }
          return (
            <li
              key={`${item.type}-${item.order}`}
              className="rounded-r-lg border-l-4 border-gold py-3 pl-3 pr-2 shadow-sm"
              style={{ backgroundColor: "rgba(250, 248, 243, 0.65)" }}
            >
              <div
                className="font-mono text-sm font-medium"
                style={{ color: "#dd4e14" }}
              >
                {item.time_window}
              </div>
              <h3 className="font-display text-base font-semibold text-[#0B1E5C]">
                {item.name}
              </h3>
              {item.note ? (
                <p className="mt-1 font-sans text-xs leading-relaxed text-[#0B1E5C]/75">
                  {item.note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {sequence.dining_suggestions.length > 0 ? (
        <div className="rounded-lg border-2 border-gold/80 bg-white/90 px-3 py-3">
          <h4 className="font-sans text-sm font-semibold text-royal">
            Dining gap noticed
          </h4>
          <ul className="mt-2 list-inside list-disc space-y-1 font-sans text-sm text-royal/85">
            {sequence.dining_suggestions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warningsUi.length > 0 ? (
        <div className="rounded-lg border-2 border-amber-400/90 bg-amber-50/90 px-3 py-3">
          <h4 className="font-sans text-sm font-semibold text-amber-950">
            Heads up
          </h4>
          <ul className="mt-2 list-inside list-disc space-y-1 font-sans text-sm text-amber-950/90">
            {warningsUi.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-royal/15 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 font-sans text-xs text-royal/75">
          <p>
            <span className="font-semibold text-royal">Pace:</span>{" "}
            {sequence.pace_applied}
          </p>
          {sequence.anchor_confirmation ? (
            <p className="mt-1 text-royal/65">{sequence.anchor_confirmation}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg border border-royal/25 bg-white px-3 py-2 font-sans text-sm font-medium text-royal hover:bg-cream"
          >
            Regenerate
          </button>
          <button
            type="button"
            disabled
            title="Saving generated sequences to a day is not wired yet."
            className="rounded-lg bg-royal px-3 py-2 font-sans text-sm font-semibold text-cream opacity-50"
          >
            Save to day
          </button>
        </div>
      </div>

      {/* TODO(V1.1): Persist touring sequence on "Save to day" when schema supports it (client scratch only for now). */}

      <p className="font-sans text-[0.7rem] leading-snug text-royal/55">
        Draft plan based on historic averages. Actual waits will vary — always
        check posted times in-park.
      </p>
    </div>
  );
}
