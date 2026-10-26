/**
 * Run: npx tsx src/lib/account/delete-confirmation.test.ts
 */
import assert from "node:assert/strict";
import { accountDeletionEmailMatches } from "./delete-confirmation";

function run() {
  assert.equal(
    accountDeletionEmailMatches("Trip@Example.com", "  trip@example.com "),
    true,
  );
  assert.equal(
    accountDeletionEmailMatches("trip@example.com", "other@example.com"),
    false,
  );
  assert.equal(accountDeletionEmailMatches("trip@example.com", ""), false);
  assert.equal(accountDeletionEmailMatches("", "trip@example.com"), false);
  console.log("delete-confirmation.test.ts: ok");
}

run();
