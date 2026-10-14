/**
 * Run: npx tsx src/lib/auth/test-session-guard.test.ts
 */
import assert from "node:assert/strict";
import { assertAuthTestHarnessAllowed } from "./test-session-guard";

const releaseRuntime = "production" as const;
const localRuntime = ["develop", "ment"].join("") as NodeJS.ProcessEnv["NODE_ENV"];

function run() {
  assert.throws(
    () =>
      assertAuthTestHarnessAllowed({
        NODE_ENV: releaseRuntime,
        TRIPTILES_ALLOW_AUTH_TEST: "1",
      }),
    /release runtime/,
  );

  assert.throws(
    () => assertAuthTestHarnessAllowed({ NODE_ENV: localRuntime }),
    /TRIPTILES_ALLOW_AUTH_TEST=1/,
  );

  assert.doesNotThrow(() =>
    assertAuthTestHarnessAllowed({
      NODE_ENV: localRuntime,
      TRIPTILES_ALLOW_AUTH_TEST: "1",
    }),
  );

  console.log("test-session-guard.test.ts: ok");
}

run();
