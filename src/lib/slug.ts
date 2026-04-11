/** URL-safe slug from user-facing text (lowercase, hyphens). */
export function slugifyAdventureName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : "plan";
}

/** `magical-adventure-08d552` style public slug (adventure + first 6 hex chars of UUID). */
export function defaultPublicTripSlug(
  tripId: string,
  adventureName: string,
): string {
  const compact = tripId.replace(/-/g, "");
  const suffix = compact.slice(0, 6);
  return `${slugifyAdventureName(adventureName)}-${suffix}`;
}
