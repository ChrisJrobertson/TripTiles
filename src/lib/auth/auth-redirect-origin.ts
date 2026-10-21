/**
 * Fixed application origins for auth email links and post-confirmation redirects.
 * Request host headers and callback parameters are never accepted as an origin.
 */

const CANONICAL_ORIGIN = "https://www.triptiles.app";

function normalisedOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  return url.origin;
}

/** True only for this app's local, production, and TripTiles Vercel hosts. */
export function isAuthorisedAppOrigin(raw: string | null | undefined): boolean {
  const origin = normalisedOrigin(raw);
  if (!origin) return false;
  const url = new URL(origin);
  const host = url.hostname.toLowerCase();

  if (url.protocol === "http:") {
    return (host === "localhost" || host === "127.0.0.1") && url.port === "3001";
  }
  if (url.protocol !== "https:") return false;
  if (host === "triptiles.app" || host === "www.triptiles.app") return true;
  return host.endsWith(".vercel.app") && host.includes("triptiles");
}

/**
 * Origin written into Supabase `emailRedirectTo`.
 * Uses NEXT_PUBLIC_SITE_URL when that value is on the allowlist.
 * Otherwise the canonical production origin, never a request host.
 */
export function authorisedAuthRedirectOrigin(siteUrl: string | null | undefined): string {
  const configured = normalisedOrigin(siteUrl);
  if (configured && isAuthorisedAppOrigin(configured)) return configured;
  return CANONICAL_ORIGIN;
}

/**
 * Where `/auth/callback` sends the browser after the session cookie is set.
 * Stays on the request origin only when that origin is already allowlisted,
 * so a poisoned Host header cannot become the redirect target.
 */
export function callbackRedirectOrigin(
  requestOrigin: string | null | undefined,
  siteUrl: string | null | undefined,
): string {
  const request = normalisedOrigin(requestOrigin);
  if (request && isAuthorisedAppOrigin(request)) return request;
  return authorisedAuthRedirectOrigin(siteUrl);
}
