/**
 * Run: npx tsx src/lib/auth/route-guard.test.ts
 */
import assert from "node:assert/strict";
import { authUnavailableDecision, isProtectedPath } from "./route-guard";

function run() {
  assert.equal(isProtectedPath("/planner"), true);
  assert.equal(isProtectedPath("/planner/day"), true);
  assert.equal(isProtectedPath("/settings/profile"), true);
  assert.equal(isProtectedPath("/internal/live-wait"), true);
  assert.equal(isProtectedPath("/login"), false);
  assert.equal(isProtectedPath("/today-at-park"), false);
  assert.equal(isProtectedPath("/planning"), false);

  assert.equal(authUnavailableDecision("/planner"), "redirect-login");
  assert.equal(authUnavailableDecision("/settings/data-privacy"), "redirect-login");
  assert.equal(authUnavailableDecision("/"), "continue");
  assert.equal(authUnavailableDecision("/pricing"), "continue");

  console.log("route-guard.test.ts: ok");
}

run();
