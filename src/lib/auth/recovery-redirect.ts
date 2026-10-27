import { authorisedAuthRedirectOrigin } from "@/lib/auth/auth-redirect-origin";
import { safeNextPath } from "@/lib/auth/safe-next-path";

/** Path the recovery email must return to after `/auth/callback`. */
export const RECOVERY_NEXT_PATH = "/reset-password";

/**
 * Authorised `redirectTo` for `resetPasswordForEmail`.
 * Uses the site-url allowlist, never a request Host header.
 */
export function recoveryEmailRedirectTo(
  siteUrl: string | null | undefined,
): string {
  const origin = authorisedAuthRedirectOrigin(siteUrl);
  const next = encodeURIComponent(safeNextPath(RECOVERY_NEXT_PATH));
  return `${origin}/auth/callback?next=${next}`;
}
