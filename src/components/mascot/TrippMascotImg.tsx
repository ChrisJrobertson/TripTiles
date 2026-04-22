type Props = {
  className?: string;
  width: number;
  height: number;
  /** When false, alt defaults to empty decorative. */
  decorative?: boolean;
};

/**
 * Tripp mascot. Prefer `object-cover` for small circular crops;
 * use `object-contain` for larger marketing-style blocks.
 */
export function TrippMascotImg({
  className,
  width,
  height,
  decorative = true,
}: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static mascot; avoid next/image.
    <img
      src="/images/tripp-mascot.png"
      alt={decorative ? "" : "Tripp"}
      width={width}
      height={height}
      className={className}
      {...(decorative ? { "aria-hidden": true as const } : {})}
    />
  );
}
