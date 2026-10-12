/**
 * Deterministic local confirmation for a test user.
 *
 * Uses Auth Admin `generateLink` (type signup). It does not insert into
 * auth.users, does not turn off email confirmation, and refuses to run when
 * the release runtime or when TRIPTILES_ALLOW_AUTH_TEST is unset.
 *
 * Required env:
 *   TRIPTILES_ALLOW_AUTH_TEST=1
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TRIPTILES_AUTH_TEST_EMAIL
 *   TRIPTILES_AUTH_TEST_PASSWORD   (only for type=signup; otherwise a magic link is issued for an existing user)
 *
 * Run:
 *   TRIPTILES_ALLOW_AUTH_TEST=1 node --env-file=.env.local --import tsx scripts/auth-test-session.ts
 *
 * The printed action_link is a one-time confirmation URL for that test inbox.
 * Do not commit it.
 */
import { createClient } from "@supabase/supabase-js";
import { assertAuthTestHarnessAllowed } from "../src/lib/auth/test-session-guard";

async function main() {
  assertAuthTestHarnessAllowed(process.env);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const email = process.env.TRIPTILES_AUTH_TEST_EMAIL?.trim().toLowerCase();
  if (!url || !key || !email) {
    throw new Error(
      "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TRIPTILES_AUTH_TEST_EMAIL",
    );
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = process.env.TRIPTILES_AUTH_TEST_PASSWORD;
  const { data, error } = password
    ? await admin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
      })
    : await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
  if (error) {
    throw new Error(error.message);
  }
  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    throw new Error("Auth Admin did not return an action_link");
  }
  console.log(`confirmation_email=${email}`);
  console.log("action_link_present=true");
  console.log(actionLink);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "auth test harness failed";
  console.error(message);
  process.exit(1);
});
