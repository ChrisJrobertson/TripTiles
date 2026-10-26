/** Shared check for Vercel cron routes. A missing secret fails closed. */
export function isCronAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  const trimmed = secret?.trim() ?? "";
  if (!trimmed) return false;
  return authorization === `Bearer ${trimmed}`;
}
