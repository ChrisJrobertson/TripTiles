"use client";

/** Matches `TripTilesLogoLink` asset. */
export const TRIP_TILES_LOGO_SRC = "/images/logo-full.png";

type Props = {
  /** Visual size of the logo mark (frame scales with it). */
  size?: "md" | "lg";
  className?: string;
  /**
   * Non-spinning frame behind the logo — match the surface it sits on
   * (cream vs royal) so it reads like a sticker on a static background.
   */
  surface?: "light" | "dark";
};

const sizeClasses = {
  md: {
    wrap: "h-24 w-24",
    img: "h-[3.75rem] w-auto max-w-[min(10rem,65vw)]",
  },
  lg: {
    wrap: "h-28 w-28",
    img: "h-[4.5rem] w-auto max-w-[min(12rem,70vw)]",
  },
} as const;

const staticFrame: Record<NonNullable<Props["surface"]>, string> = {
  light:
    "border-gold/30 bg-gradient-to-b from-white/50 to-gold/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
  dark:
    "border-cream/25 bg-gradient-to-b from-cream/[0.12] to-royal/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
};

/**
 * TripTiles logo as the only moving part: a static frame sits on the (page/overlay)
 * background while the mark rotates, similar to a simple GIF loader.
 */
export function TripTilesSpinningMark({
  size = "md",
  className = "",
  surface = "light",
}: Props) {
  const s = sizeClasses[size];
  return (
    <div
      className={`relative inline-flex items-center justify-center ${s.wrap} ${className}`.trim()}
    >
      {/* Static disc + ring — never rotates */}
      <div
        className={`pointer-events-none absolute inset-1 rounded-full ${staticFrame[surface]}`}
        aria-hidden
      />
      <div
        className="relative z-[1] flex items-center justify-center motion-safe:animate-spin motion-reduce:animate-none"
        style={{ animationDuration: "1.1s" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img
          src={TRIP_TILES_LOGO_SRC}
          alt="TripTiles"
          width={112}
          height={112}
          className={`object-contain drop-shadow-md ${s.img}`}
        />
      </div>
    </div>
  );
}
