import type { User } from "@supabase/supabase-js";

type IdentityRow = NonNullable<User["identities"]>[number];

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

const APPLE_RELAY_SUFFIX = "@privaterelay.appleid.com";

function isAppleRelayEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(APPLE_RELAY_SUFFIX);
}

function identityDataEmail(identity: IdentityRow): string | undefined {
  const data = identity.identity_data;
  if (!data || typeof data !== "object") return undefined;
  const email = (data as { email?: unknown }).email;
  return typeof email === "string" ? email : undefined;
}

function hasAppleRelayIdentity(user: User): boolean {
  if (isAppleRelayEmail(user.email ?? undefined)) {
    return true;
  }
  const identities = user.identities ?? [];
  return identities.some(
    (i) =>
      i.provider === "email" && isAppleRelayEmail(identityDataEmail(i)),
  );
}

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
 * 1. `app_metadata.provider` (singular) is the canonical sign-up method GoTrue
 *    sets at account creation. If it is anything other than `email`, this is not
 *    an email+password-only account (covers Apple SSO even when identities only
 *    show `provider: "email"` for Hide My Email relay).
 * 2. Hide My Email can still yield only an `email` identity with a relay address;
 *    treat that as not password-capable.
 * 3. Keep `identities` / `providers[]` checks for linked accounts and edge cases.
 */
export function userHasEmailPasswordAuth(user: User): boolean {
  const am = user.app_metadata as
    | { provider?: string; providers?: string[] }
    | undefined;
  const primaryProvider = am?.provider;

  if (primaryProvider && primaryProvider !== "email") {
    return false;
  }

  if (hasAppleRelayIdentity(user)) {
    return false;
  }

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

  if (primaryProvider === "email") {
    return true;
  }

  if (
    providersList.includes("email") &&
    providersList.every((p) => p === "email")
  ) {
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
  const primary = (user.app_metadata as { provider?: string } | undefined)
    ?.provider;
  if (primary && OAUTH_PROVIDERS.has(primary)) {
    return labelForProvider(primary);
  }

  if (hasAppleRelayIdentity(user)) {
    return "Apple";
  }

  const identities = user.identities ?? [];
  const fromIdentity = identities.find((i) => OAUTH_PROVIDERS.has(i.provider));
  if (fromIdentity) {
    return labelForProvider(fromIdentity.provider);
  }

  const providersList = readAppMetadataProviders(user);
  const fromMeta = providersList.find((p) => OAUTH_PROVIDERS.has(p));
  return fromMeta ? labelForProvider(fromMeta) : null;
}
