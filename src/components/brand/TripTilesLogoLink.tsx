import Link from "next/link";
import { TRIP_TILES_LOGO_NAV_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";

type Props = {
  href: string;
  /** Tailwind height/width; keep `w-auto` so the mark is not stretched. */
  imgClassName?: string;
  /** Passed through to `<img height>` for hinting only; layout is from classes. */
  height?: number;
  className?: string;
  /**
   * Pads the mark in solid white with a light ring (for contrast on light backgrounds).
   * Default off: logo PNG has its own background treatment.
   */
  framed?: boolean;
};

/**
 * Full TripTiles wordmark for headers and footers (`/images/triptiles-logo.png`).
 * The Tripp mascot (`/images/tripp-mascot.png`) is for Tripp, chat, and spinners only.
 */
export function TripTilesLogoLink({
  href,
  imgClassName = TRIP_TILES_LOGO_NAV_IMG_CLASS,
  height = 200,
  className = "inline-flex shrink-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded-sm",
  framed = false,
}: Props) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoid next/image (no new deps / config).
    <img
      src="/images/triptiles-logo.png"
      alt="TripTiles"
      height={height}
      className={imgClassName}
    />
  );

  return (
    <Link href={href} className={className}>
      {framed ? (
        <span className="inline-flex rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-royal/[0.08] sm:rounded-3xl sm:p-2">
          {img}
        </span>
      ) : (
        img
      )}
    </Link>
  );
}
