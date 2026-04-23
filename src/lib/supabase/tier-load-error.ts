/** Thrown by `getCurrentTier()` when `profiles` cannot be read for the session user. */
export const TIER_LOAD_FAILED_PREFIX = "TIER_LOAD_FAILED";

export function isTierLoadFailure(e: unknown): boolean {
  return e instanceof Error && e.message.startsWith(TIER_LOAD_FAILED_PREFIX);
}

export function tierLoadFailureUserMessage(): string {
  return "We couldn't load your account details. Try signing out and back in. If it keeps happening, let us know at hello@triptiles.app.";
}
