import { Logo } from "@/components/brand/Logo";

export { UserAvatarInitial } from "@/components/brand/UserAvatarInitial";

/**
 * App shell compact lockup (icon + TripTiles wordmark — no tagline).
 */
export function TripTilesPlannerBrand({
  href,
  className = "",
}: {
  href: string;
  className?: string;
}) {
  return (
    <Logo href={href} variant="compact" sizePreset="nav" className={className} />
  );
}
