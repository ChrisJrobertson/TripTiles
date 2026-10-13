/**
 * Run: npx tsx src/lib/stripe/webhook-dedup.test.ts
 */
import assert from "node:assert/strict";
import { classifyWebhookInsertError } from "./webhook-dedup";

assert.equal(classifyWebhookInsertError(undefined), null);
assert.equal(classifyWebhookInsertError("23505"), "duplicate");
assert.equal(classifyWebhookInsertError("42501"), "failed");

console.log("webhook-dedup.test.ts: ok");
