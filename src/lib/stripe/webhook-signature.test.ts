/**
 * Run: npx tsx src/lib/stripe/webhook-signature.test.ts
 * Local signature check only. No Stripe account and no network call.
 */
import assert from "node:assert/strict";
import Stripe from "stripe";

const secret = "whsec_triptiles_signature_fixture";
const stripe = new Stripe("sk_test_triptiles_signature_fixture", {
  apiVersion: "2025-02-24.acacia",
});
const payload = JSON.stringify({
  id: "evt_signature_fixture",
  object: "event",
  type: "invoice.paid",
});

const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
const event = stripe.webhooks.constructEvent(payload, header, secret);
assert.equal(event.id, "evt_signature_fixture");
assert.equal(event.type, "invoice.paid");

let rejected = false;
try {
  stripe.webhooks.constructEvent(payload, "t=1,v1=deadbeef", secret);
} catch {
  rejected = true;
}
assert.equal(rejected, true);

console.log("webhook-signature.test.ts: ok");
