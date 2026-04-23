import type { SupabaseClientOptions } from "@supabase/supabase-js";

/**
 * Use implicit (non-PKCE) flow for client-initiated email OTP, so the server
 * can complete auth via /auth/callback?token_hash=... without relying on
 * a fragile same-tab code verifier cookie.
 */
export const supabaseAuthClientOptions: NonNullable<
  SupabaseClientOptions<"public">["auth"]
> = {
  flowType: "implicit",
};
