/**
 * Run: npx tsx src/lib/cron/authorize.test.ts
 */
import assert from "node:assert/strict";
import { isCronAuthorized } from "./authorize";

assert.equal(isCronAuthorized("Bearer secret", "secret"), true);
assert.equal(isCronAuthorized("Bearer secret", " secret "), true);
assert.equal(isCronAuthorized("Bearer other", "secret"), false);
assert.equal(isCronAuthorized(null, "secret"), false);
assert.equal(isCronAuthorized("Bearer secret", ""), false);
assert.equal(isCronAuthorized("Bearer secret", undefined), false);
assert.equal(isCronAuthorized("secret", "secret"), false);

console.log("authorize.test.ts: ok");
