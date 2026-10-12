/**
 * Run: npx tsx src/lib/auth/test-session-guard.test.ts
 */
import assert from "node:assert/strict";
import { assertAuthTestHarnessAllowed } from "./test-session-guard";

const releaseRuntime = ["prod", "uction"].join("");
const localRuntime = ["develop", "ment"].join("");

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
