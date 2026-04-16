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

/**
 * Whether the account can change password via Supabase email/password.
 * Email-only magic-link users have provider `email` but no password; OAuth users
 * may still have a synthetic `email` identity — use metadata + identity mix.
 */
export function userHasEmailPasswordAuth(user: User): boolean {
  const metaProvider = (user.app_metadata as { provider?: string } | undefined)
    ?.provider;
  if (metaProvider === "email") {
    return true;
  }
  if (metaProvider && metaProvider !== "email") {
    return false;
  }

  const identities = user.identities ?? [];
  const hasEmailIdentity = identities.some((i) => i.provider === "email");
  const hasOauthIdentity = identities.some((i) => OAUTH_PROVIDERS.has(i.provider));
  return hasEmailIdentity && !hasOauthIdentity;
}

/** Human label for primary OAuth provider, or null if none. */
export function getOauthIdentityLabel(user: User): string | null {
  const identities = user.identities ?? [];
  const o = identities.find((i) => OAUTH_PROVIDERS.has(i.provider));
  if (!o) return null;
  if (o.provider === "apple") return "Apple";
  if (o.provider === "google") return "Google";
  return o.provider.charAt(0).toUpperCase() + o.provider.slice(1);
}
