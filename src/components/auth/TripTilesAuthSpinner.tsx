"use client";

/** Matches `TripTilesLogoLink` asset. */
const LOGO_SRC = "/images/logo-full.png";

type Props = {
  visible: boolean;
  /** Short line shown under the logo (UK English). */
  message: string;
};

/**
 * Full-viewport loading state for auth flows — TripTiles mark with a ring
 * spinner (no generic dot spinner).
 */
export function TripTilesAuthSpinner({ visible, message }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex flex-col items-center justify-center gap-5 bg-cream/92 px-6 py-10 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-gold/25 border-t-gold border-r-royal/80 motion-safe:animate-spin"
          style={{ animationDuration: "0.85s" }}
          aria-hidden
        />
        <div
          className="absolute inset-2 rounded-full border border-transparent border-b-gold/40 border-l-royal/50 motion-safe:animate-spin"
          style={{ animationDuration: "1.25s", animationDirection: "reverse" }}
          aria-hidden
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img
          src={LOGO_SRC}
          alt="TripTiles"
          width={112}
          height={112}
          className="relative z-[1] h-[4.5rem] w-auto max-w-[min(12rem,70vw)] object-contain drop-shadow-sm"
        />
      </div>
      <p className="max-w-sm text-center font-serif text-lg font-semibold tracking-tight text-royal">
        {message}
      </p>
      <p className="max-w-xs text-center font-sans text-sm text-royal/65">
        This only takes a moment.
      </p>
    </div>
  );
}
