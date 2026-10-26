/**
 * Run: npx tsx src/lib/stripe/entitlement.test.ts
 */
import assert from "node:assert/strict";
import { profileTierActionForSubscription } from "./entitlement";

assert.equal(
  profileTierActionForSubscription({ status: "active" }),
  "set_paid_tier",
);
assert.equal(
  profileTierActionForSubscription({ status: "trialing" }),
  "set_paid_tier",
);
assert.equal(
  profileTierActionForSubscription({
    status: "past_due",
    profileGracePeriod: true,
  }),
  "leave_unchanged",
);
assert.equal(
  profileTierActionForSubscription({
    status: "unpaid",
    profileGracePeriod: true,
  }),
  "leave_unchanged",
);
assert.equal(
  profileTierActionForSubscription({ status: "canceled" }),
  "leave_unchanged",
);
assert.equal(
  profileTierActionForSubscription({ status: "incomplete" }),
  "leave_unchanged",
);
assert.equal(
  profileTierActionForSubscription({ status: "incomplete_expired" }),
  "leave_unchanged",
);
assert.equal(
  profileTierActionForSubscription({ status: "paused" }),
  "leave_unchanged",
);

console.log("entitlement.test.ts: ok");
