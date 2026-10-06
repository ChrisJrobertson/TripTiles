"use client";

type Props = {
  queueTimes?: boolean;
  themeParksWiki?: boolean;
  /** Queue-Times credit. Kept so existing call sites stay correct. */
  visible?: boolean;
};

/** Provider terms — show once per surface that lists live waits. */
export function LiveWaitAttributionFooter({
  queueTimes,
  themeParksWiki,
  visible,
}: Props) {
  const showQueueTimes = queueTimes ?? visible ?? false;
  if (!showQueueTimes && !themeParksWiki) return null;
  return (
    <p className="mt-2 font-sans text-[10px] leading-relaxed text-royal/55">
      Live standby data:{" "}
      {showQueueTimes ? (
        <a
          href="https://queue-times.com/en-US"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-royal underline decoration-gold/40 underline-offset-2"
        >
          Powered by Queue-Times.com
        </a>
      ) : null}
      {showQueueTimes && themeParksWiki ? " · " : null}
      {themeParksWiki ? (
        <a
          href="https://themeparks.wiki/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-royal underline decoration-gold/40 underline-offset-2"
        >
          Powered by ThemeParks.wiki
        </a>
      ) : null}
    </p>
  );
}
