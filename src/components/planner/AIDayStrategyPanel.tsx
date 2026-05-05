"use client";

import { filterUserFacingAiWarningLinesForUi } from "@/lib/ai-user-facing-warnings";
import type { AIDayStrategy, AIDayStrategyRideStepType } from "@/lib/types";
import { useMemo } from "react";

function rideTypeEmoji(t: AIDayStrategyRideStepType): string {
  switch (t) {
    case "rope_drop":
      return "🚪";
    case "lightning_lane":
      return "⚡";
    case "express_pass":
      return "🎫";
    case "single_rider":
      return "🚶";
    case "meal":
      return "🍽️";
    case "show":
      return "🎭";
    case "indoor_break":
      return "🏠";
    case "rest":
      return "☕";
    case "shopping":
      return "🛍️";
    case "standby":
      return "🎢";
    default:
      return "🎢";
  }
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function AIDayStrategyPanel({
  strategy,
  onRegenerate,
  onViewParks,
}: {
  strategy: AIDayStrategy;
  onRegenerate?: () => void;
  onViewParks?: () => void;
}) {
  const rel = formatRelativeTime(strategy.generated_at);
  const qualityWarningsUi = useMemo(
    () =>
      filterUserFacingAiWarningLinesForUi(
        strategy.quality_warnings,
        "ai_day_strategy.quality_warnings",
      ),
    [strategy.quality_warnings],
  );
  const topWarningsUi = useMemo(
    () =>
      filterUserFacingAiWarningLinesForUi(
        strategy.warnings,
        "ai_day_strategy.warnings",
      ),
    [strategy.warnings],
  );
  return (
    <section className="mt-4 rounded-xl border border-gold/35 bg-cream p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-semibold text-royal">
            ✨ Your AI Day Strategy
          </h3>
          <p className="mt-1 font-sans text-xs text-royal/65">
            Generated {rel || "recently"} ·{" "}
            <span className="rounded bg-gold/25 px-1.5 py-0.5 font-semibold text-royal">
              Pro feature
            </span>
          </p>
        </div>
      </div>

      {qualityWarningsUi.length > 0 ? (
        <div
          className="mt-4 rounded-lg border border-gold/50 bg-gold/15 p-3"
          role="status"
        >
          <p className="font-sans text-xs font-semibold text-royal">
            Some details may be incomplete
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 font-sans text-xs text-royal/85">
            {qualityWarningsUi.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-royal/10 bg-white/90 p-3">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-gold">
          {strategy.arrival_recommendation.replace("_", " ")}
        </p>
        <p className="mt-1 font-sans text-sm leading-relaxed text-royal">
          {strategy.arrival_reason}
        </p>
      </div>

      <div className="mt-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
          Sequenced plan
        </p>
        <ul className="mt-2 space-y-3">
          {strategy.ride_sequence.map((row, i) => (
            <li
              key={i}
              className="border-b border-royal/10 pb-3 last:border-0 last:pb-0"
            >
              <div className="flex gap-2">
                <span className="w-14 shrink-0 font-mono text-xs font-semibold text-royal">
                  {row.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-semibold text-royal">
                    <span className="mr-1">{rideTypeEmoji(row.type)}</span>
                    {row.ride_or_event}
                  </p>
                  <p className="mt-0.5 font-sans text-xs leading-relaxed text-royal/75">
                    {row.notes}
                  </p>
                  {row.height_warning ? (
                    <p className="mt-1 font-sans text-[11px] text-royal/65">
                      {row.height_warning}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {strategy.optional_sequence_notes &&
      strategy.optional_sequence_notes.length > 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-royal/25 bg-royal/5 p-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
            Optional notes (not in sequenced plan)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 font-sans text-xs text-royal/75">
            {strategy.optional_sequence_notes.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {strategy.lightning_lane_strategy &&
      strategy.lightning_lane_strategy.multi_pass_bookings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-royal/10 bg-white/90 p-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
            ⚡ Lightning Lane bookings
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 font-sans text-sm text-royal/85">
            {strategy.lightning_lane_strategy.multi_pass_bookings.map((b, j) => (
              <li key={j}>
                {b.ride} — book for {b.book_for_time}
              </li>
            ))}
          </ul>
          {strategy.lightning_lane_strategy.single_pass_recommendations?.length ? (
            <p className="mt-2 font-sans text-xs text-royal/75">
              <span className="font-semibold">Single Pass ideas: </span>
              {strategy.lightning_lane_strategy.single_pass_recommendations.join(
                ", ",
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {strategy.express_pass_strategy ? (
        <div className="mt-4 rounded-lg border border-royal/10 bg-white/90 p-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
            🎟️ Express strategy
          </p>
          <p className="mt-1 font-sans text-xs text-royal/80">
            Priority: {strategy.express_pass_strategy.priority_rides.join(", ") || "—"}
          </p>
          <p className="mt-1 font-sans text-xs text-royal/80">
            Skip Express (not worth it):{" "}
            {strategy.express_pass_strategy.skip_with_express.join(", ") || "—"}
          </p>
        </div>
      ) : null}

      {topWarningsUi.length > 0 ? (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3">
          <p className="font-sans text-xs font-semibold text-royal">⚠️ Heads up</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 font-sans text-sm text-royal/85">
            {topWarningsUi.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {onRegenerate ? (
          <button
            type="button"
            className="min-h-[44px] rounded-lg border border-royal/25 bg-white px-4 py-2 font-sans text-sm font-medium text-royal"
            onClick={onRegenerate}
          >
            Regenerate strategy
          </button>
        ) : null}
        {onViewParks ? (
          <button
            type="button"
            className="min-h-[44px] rounded-lg border border-royal/25 bg-white px-4 py-2 font-sans text-sm font-medium text-royal"
            onClick={onViewParks}
          >
            View parks list
          </button>
        ) : null}
      </div>
    </section>
  );
}
