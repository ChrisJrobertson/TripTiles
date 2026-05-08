/**
 * Run: npx tsx src/lib/data-import/import-validation.test.ts
 */
import assert from "node:assert/strict";
import {
  isValidHttpsUrl,
  parseIsoDateOnly,
  rejectIfPlaceholder,
  validateCoordinates,
  validateHhmm,
  validateSkipLineSystemId,
  validateSourceFields,
} from "./import-validation";

function run() {
  assert.equal(isValidHttpsUrl("https://example.com/a"), true);
  assert.equal(isValidHttpsUrl("ftp://x"), false);

  assert.equal(parseIsoDateOnly("2026-01-15").ok, true);
  assert.equal(parseIsoDateOnly("bad").ok, false);

  assert.ok(rejectIfPlaceholder("body", "TODO fix"));
  assert.equal(rejectIfPlaceholder("body", "Valid prose."), null);

  assert.ok(validateCoordinates("91", "0", 1).length > 0);
  assert.equal(validateCoordinates("48.85", "2.35", 1).length, 0);

  assert.equal(validateHhmm("09:30", "opens_at", 1).length, 0);
  assert.ok(validateHhmm("25:00", "opens_at", 1).length > 0);

  assert.equal(validateSkipLineSystemId("none", 1).length, 0);
  assert.ok(validateSkipLineSystemId("nope", 1).length > 0);

  const srcErrs = validateSourceFields(
    { source_url: "", source_date: "" },
    2,
  );
  assert.ok(srcErrs.length >= 2);

  console.log("import-validation tests: all passed");
}

run();
