/**
 * Public site origin (no trailing slash). Used for metadata and absolute links.
 */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
}
