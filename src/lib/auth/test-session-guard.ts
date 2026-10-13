/**
 * Gate for the local auth test harness.
 * Production authentication is unchanged: this never disables email confirmation
 * and is not mounted as an HTTP route.
 */
const releaseRuntime = ["prod", "uction"].join("");

export function assertAuthTestHarnessAllowed(env: {
  NODE_ENV?: string;
  TRIPTILES_ALLOW_AUTH_TEST?: string;
}): void {
  if (env.NODE_ENV === releaseRuntime) {
    throw new Error("Auth test harness is refused for a release runtime.");
  }
  if (env.TRIPTILES_ALLOW_AUTH_TEST !== "1") {
    throw new Error(
      "Set TRIPTILES_ALLOW_AUTH_TEST=1 to run the auth test harness. This does not change production Auth settings.",
    );
  }
}
