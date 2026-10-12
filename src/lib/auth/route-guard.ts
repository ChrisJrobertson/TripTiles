export const PROTECTED_PREFIXES = [
  "/planner",
  "/trip",
  "/onboarding",
  "/admin",
  "/agency",
  "/achievements",
  "/passport",
  "/settings",
  "/internal",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * When Supabase auth cannot be evaluated, protected pages must not render.
 * Public pages can still continue.
 */
export function authUnavailableDecision(
  pathname: string,
): "redirect-login" | "continue" {
  return isProtectedPath(pathname) ? "redirect-login" : "continue";
}
