"use client";

type Props = {
  visible: boolean;
};

/** Queue-Times API terms — show once per surface that lists live waits. */
export function LiveWaitAttributionFooter({ visible }: Props) {
  if (!visible) return null;
  return (
    <p className="mt-2 font-sans text-[10px] leading-relaxed text-royal/55">
      Live standby data:{" "}
      <a
        href="https://queue-times.com/en-US"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-royal underline decoration-gold/40 underline-offset-2"
      >
        Powered by Queue-Times.com
      </a>
    </p>
  );
}
