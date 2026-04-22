import Link from "next/link";

type Props = {
  href: string;
  /** Tailwind height classes; keep `w-auto` so the mark is not stretched. */
  imgClassName?: string;
  /** Passed through to `<img height>` for hinting only; layout is from classes. */
  height?: number;
  className?: string;
};

/**
 * Full TripTiles logo (white-backed PNG). Use only on cream/white surfaces.
 */
export function TripTilesLogoLink({
  href,
  imgClassName = "h-10 w-auto",
  height = 40,
  className = "inline-flex shrink-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded-sm",
}: Props) {
  return (
    <Link href={href} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoid next/image (no new deps / config). */}
      <img
        src="/images/logo-full.png"
        alt="TripTiles"
        height={height}
        className={imgClassName}
      />
    </Link>
  );
}
