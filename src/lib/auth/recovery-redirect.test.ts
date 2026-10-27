/**
 * Run: npx tsx src/lib/auth/recovery-redirect.test.ts
 */
import assert from "node:assert/strict";
import {
  RECOVERY_NEXT_PATH,
  recoveryEmailRedirectTo,
} from "./recovery-redirect";

function run() {
  assert.equal(RECOVERY_NEXT_PATH, "/reset-password");

  assert.equal(
    recoveryEmailRedirectTo("http://localhost:3001"),
    "http://localhost:3001/auth/callback?next=%2Freset-password",
  );
  assert.equal(
    recoveryEmailRedirectTo("https://www.triptiles.app"),
    "https://www.triptiles.app/auth/callback?next=%2Freset-password",
  );
  assert.equal(
    recoveryEmailRedirectTo("https://evil.example"),
    "https://www.triptiles.app/auth/callback?next=%2Freset-password",
  );
  assert.equal(
    recoveryEmailRedirectTo(undefined),
    "https://www.triptiles.app/auth/callback?next=%2Freset-password",
  );

  console.log("recovery-redirect.test.ts: ok");
}

run();
