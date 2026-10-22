/**
 * Run: npx tsx src/lib/rate-limit.test.ts
 */
import assert from "node:assert/strict";
import {
  consumeRateLimit,
  hashRateLimitBucket,
  resetRateLimitsForTests,
} from "./rate-limit";

function run() {
  resetRateLimitsForTests();
  const start = 1_000_000;

  const first = consumeRateLimit("signup:a@example.com", 2, 60_000, start);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);

  const second = consumeRateLimit("signup:a@example.com", 2, 60_000, start + 1_000);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const blocked = consumeRateLimit("signup:a@example.com", 2, 60_000, start + 2_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSec >= 1);

  const other = consumeRateLimit("signup:b@example.com", 2, 60_000, start + 2_000);
  assert.equal(other.allowed, true, "keys are isolated");

  const afterWindow = consumeRateLimit("signup:a@example.com", 2, 60_000, start + 60_001);
  assert.equal(afterWindow.allowed, true, "window expires");

  assert.throws(() => consumeRateLimit("", 1, 1_000, start), /key is required/);
  assert.throws(() => consumeRateLimit("x", 0, 1_000, start), /at least 1/);

  const hashed = hashRateLimitBucket("signup:a@example.com");
  assert.equal(hashed.length, 64);
  assert.equal(hashed.includes("@"), false);
  assert.notEqual(hashRateLimitBucket("signup:a@example.com"), hashRateLimitBucket("signup:b@example.com"));

  console.log("rate-limit.test.ts: ok");
}

run();
