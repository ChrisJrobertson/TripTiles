/**
 * Fixed application origins for auth email links and post-confirmation redirects.
 * Request host headers and callback parameters are never accepted as an origin.
 * Extra hosts come only from the exact list in TRIPTILES_AUTH_ORIGINS.
 */

const CANONICAL_ORIGIN = "https://www.triptiles.app";

const LOCAL_ORIGINS = new Set([
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

const PRODUCTION_ORIGINS = new Set([
  "https://triptiles.app",
  "https://www.triptiles.app",
]);

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

/**
 * HTTPS origins added for a named staging or preview host.
 * Entries with a path, query, userinfo, or a non-HTTPS scheme are dropped.
 */
export function configuredAuthOrigins(
  raw: string | null | undefined = process.env.TRIPTILES_AUTH_ORIGINS,
): readonly string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const origin = normalisedOrigin(part);
    if (!origin) continue;
    if (!origin.startsWith("https://")) continue;
    if (PRODUCTION_ORIGINS.has(origin)) continue;
    seen.add(origin);
  }
  return [...seen];
}

/** True only for local development, production, or an explicitly configured origin. */
export function isAuthorisedAppOrigin(
  raw: string | null | undefined,
  configured: readonly string[] = configuredAuthOrigins(),
): boolean {
  const origin = normalisedOrigin(raw);
  if (!origin) return false;
  if (LOCAL_ORIGINS.has(origin) || PRODUCTION_ORIGINS.has(origin)) return true;
  return configured.includes(origin);
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
