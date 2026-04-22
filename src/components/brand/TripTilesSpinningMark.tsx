"use client";

/** Matches `TripTilesLogoLink` asset. */
export const TRIP_TILES_LOGO_SRC = "/images/logo-full.png";

type Props = {
  /** Visual size of the logo mark (rings scale with it). */
  size?: "md" | "lg";
  className?: string;
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

/** TripTiles logo with dual ring spinners — use inside overlays or route loading. */
export function TripTilesSpinningMark({ size = "md", className = "" }: Props) {
  const s = sizeClasses[size];
  return (
    <div
      className={`relative inline-flex items-center justify-center ${s.wrap} ${className}`.trim()}
    >
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
        src={TRIP_TILES_LOGO_SRC}
        alt="TripTiles"
        width={112}
        height={112}
        className={`relative z-[1] object-contain drop-shadow-sm ${s.img}`}
      />
    </div>
  );
}
