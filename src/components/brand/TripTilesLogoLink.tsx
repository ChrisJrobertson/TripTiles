import Link from "next/link";

type Props = {
  href: string;
  /** Tailwind height classes; keep `w-auto` so the mark is not stretched. */
  imgClassName?: string;
  /** Passed through to `<img height>` for hinting only; layout is from classes. */
  height?: number;
  className?: string;
  /**
   * Pads the mark in solid white with a light ring (use for opaque marks on cream).
   * Default off: `logo-full.png` is RGBA with transparent edges.
   */
  framed?: boolean;
};

/** Full TripTiles logo (`/images/logo-full.png`, RGBA). */
export function TripTilesLogoLink({
  href,
  imgClassName = "h-10 w-auto",
  height = 40,
  className = "inline-flex shrink-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream rounded-sm",
  framed = false,
}: Props) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoid next/image (no new deps / config).
    <img
      src="/images/logo-full.png"
      alt="TripTiles"
      height={height}
      className={imgClassName}
    />
  );

  return (
    <Link href={href} className={className}>
      {framed ? (
        <span className="inline-flex rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-[#0B1E5C]/[0.08] sm:rounded-3xl sm:p-2">
          {img}
        </span>
      ) : (
        img
      )}
    </Link>
  );
}
