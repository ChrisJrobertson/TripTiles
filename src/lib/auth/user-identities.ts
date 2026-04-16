import type { User } from "@supabase/supabase-js";

/** OAuth / SSO identity providers (not email+password). */
const OAUTH_PROVIDERS = new Set([
  "apple",
  "azure",
  "bitbucket",
  "discord",
  "facebook",
  "github",
  "gitlab",
  "google",
  "keycloak",
  "linkedin",
  "linkedin_oidc",
  "notion",
  "slack",
  "spotify",
  "twitch",
  "twitter",
  "workos",
]);

function readAppMetadataProviders(user: User): string[] {
  const am = user.app_metadata as
    | { provider?: string; providers?: string[] }
    | undefined;
  if (Array.isArray(am?.providers) && am.providers.length > 0) {
    return am.providers;
  }
  if (am?.provider) {
    return [am.provider];
  }
  return [];
}

/**
 * Whether the account can change password via Supabase email/password.
 *
 * Do not trust `app_metadata.provider === "email"` alone: Sign in with Apple
 * (and similar) can still surface `email` in metadata when a relay address is
 * used. Always check `app_metadata.providers` and `identities` for OAuth
 * entries before showing the password form.
 */
export function userHasEmailPasswordAuth(user: User): boolean {
  const identities = user.identities ?? [];

  if (identities.some((i) => OAUTH_PROVIDERS.has(i.provider))) {
    return false;
  }

  const providersList = readAppMetadataProviders(user);
  if (providersList.some((p) => OAUTH_PROVIDERS.has(p))) {
    return false;
  }

  const hasEmailIdentity = identities.some((i) => i.provider === "email");
  if (!hasEmailIdentity) {
    return false;
  }

  const metaProvider = (user.app_metadata as { provider?: string } | undefined)
    ?.provider;

  if (metaProvider && metaProvider !== "email" && OAUTH_PROVIDERS.has(metaProvider)) {
    return false;
  }

  // Email identity present, no OAuth in metadata or identities: email+password or
  // magic link (same Supabase shape). Allow password change when metadata points
  // at email as the auth method.
  if (metaProvider === "email") {
    return true;
  }

  if (providersList.includes("email") && providersList.every((p) => p === "email")) {
    return true;
  }

  return false;
}

function labelForProvider(provider: string): string {
  if (provider === "apple") return "Apple";
  if (provider === "google") return "Google";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Human label for primary OAuth provider, or null if none. */
export function getOauthIdentityLabel(user: User): string | null {
  const identities = user.identities ?? [];
  const fromIdentity = identities.find((i) => OAUTH_PROVIDERS.has(i.provider));
  if (fromIdentity) {
    return labelForProvider(fromIdentity.provider);
  }

  const providersList = readAppMetadataProviders(user);
  const fromMeta = providersList.find((p) => OAUTH_PROVIDERS.has(p));
  return fromMeta ? labelForProvider(fromMeta) : null;
}
