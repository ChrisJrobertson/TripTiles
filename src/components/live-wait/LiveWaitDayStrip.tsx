"use client";

type Props = {
  /** True when `/api/live-wait/current` returned at least one mapped row. */
  hasLiveRows: boolean;
  showQueueTimesAttribution: boolean;
  loading: boolean;
};

/**
 * Lightweight day-level hint — does not block planning if empty or loading.
 */
export function LiveWaitDayStrip({
  hasLiveRows,
  showQueueTimesAttribution,
  loading,
}: Props) {
  if (loading) return null;
  if (!hasLiveRows) return null;

  return (
    <div className="mt-3 rounded-lg border border-royal/12 bg-white/80 px-3 py-2 font-sans text-[11px] leading-relaxed text-royal/80">
      <span className="font-semibold text-royal">Posted waits — </span>
      Crowd-sourced standby times may appear on ride rows below. Advisory only;
      Smart Plan does not depend on them.
      {showQueueTimesAttribution ? (
        <>
          {" "}
          <a
            href="https://queue-times.com/en-US"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-royal underline decoration-gold/50 underline-offset-2"
          >
            Powered by Queue-Times.com
          </a>
          .
        </>
      ) : null}
    </div>
  );
}
