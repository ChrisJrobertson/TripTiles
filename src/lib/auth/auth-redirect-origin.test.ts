/**
 * Run: npx tsx src/lib/auth/auth-redirect-origin.test.ts
 */
import assert from "node:assert/strict";
import {
  authorisedAuthRedirectOrigin,
  callbackRedirectOrigin,
  isAuthorisedAppOrigin,
} from "./auth-redirect-origin";

function run() {
  assert.equal(isAuthorisedAppOrigin("http://localhost:3001"), true);
  assert.equal(isAuthorisedAppOrigin("http://127.0.0.1:3001"), true);
  assert.equal(isAuthorisedAppOrigin("https://www.triptiles.app"), true);
  assert.equal(isAuthorisedAppOrigin("https://triptiles.app"), true);
  assert.equal(isAuthorisedAppOrigin("https://triptiles-git-main.vercel.app"), true);

  assert.equal(isAuthorisedAppOrigin("http://localhost:3000"), false);
  assert.equal(isAuthorisedAppOrigin("https://evil.com"), false);
  assert.equal(isAuthorisedAppOrigin("https://triptiles.app.evil.com"), false);
  assert.equal(isAuthorisedAppOrigin("https://not-our-app.vercel.app"), false);
  assert.equal(isAuthorisedAppOrigin("http://www.triptiles.app"), false);
  assert.equal(isAuthorisedAppOrigin("https://evil.com/auth/callback"), false);
  assert.equal(isAuthorisedAppOrigin("https://www.triptiles.app.attacker.com"), false);

  assert.equal(
    authorisedAuthRedirectOrigin("http://localhost:3001"),
    "http://localhost:3001",
  );
  assert.equal(
    authorisedAuthRedirectOrigin("https://www.triptiles.app"),
    "https://www.triptiles.app",
  );
  assert.equal(authorisedAuthRedirectOrigin("https://evil.com"), "https://www.triptiles.app");
  assert.equal(authorisedAuthRedirectOrigin(undefined), "https://www.triptiles.app");
  assert.equal(
    authorisedAuthRedirectOrigin("http://localhost:3001\nhttps://evil.com"),
    "https://www.triptiles.app",
  );

  assert.equal(
    callbackRedirectOrigin("http://localhost:3001", "https://www.triptiles.app"),
    "http://localhost:3001",
  );
  assert.equal(
    callbackRedirectOrigin("https://evil.example", "http://localhost:3001"),
    "http://localhost:3001",
  );
  assert.equal(
    callbackRedirectOrigin("https://attacker.com", undefined),
    "https://www.triptiles.app",
  );

  console.log("auth-redirect-origin.test.ts: ok");
}

run();
