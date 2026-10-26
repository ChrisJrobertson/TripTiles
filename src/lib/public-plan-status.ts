const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First path segment under `/plans/`, lowercased. Null when this is not a plan URL. */
export function publicPlanLookupSlug(pathname: string): string | null {
  if (pathname === "/plans" || !pathname.startsWith("/plans/")) return null;
  const raw = pathname.slice("/plans/".length).split("/")[0] ?? "";
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return "";
  }
}

/** Same slug rule as the public trip reader. */
export function isPublishedPlanSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG.test(slug);
}

export function missingPublicPlanHtml(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="robots" content="noindex"/><title>Not found</title></head><body><h1>This page could not be found.</h1></body></html>`;
}
