/** Thrown by `getCurrentTier()` when `profiles` cannot be read for the session user. */
export const TIER_LOAD_FAILED_PREFIX = "TIER_LOAD_FAILED";

export function isTierLoadFailure(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(TIER_LOAD_FAILED_PREFIX);
}

export function tierLoadFailureUserMessage(): string {
  return "Could not load your plan. Refresh the page or sign in again.";
}
