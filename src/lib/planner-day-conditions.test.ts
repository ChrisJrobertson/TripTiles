/**
 * Run: npx tsx src/lib/planner-day-conditions.test.ts
 */
import assert from "node:assert/strict";
import {
  dayConditionRow,
  pdfDayConditionLine,
} from "./planner-day-conditions";

function run() {
  const day = new Date(2026, 6, 15);
  const pdf = pdfDayConditionLine("orlando", day, "c");
  assert.ok(pdf);
  assert.match(pdf, /^Typical July average, not a live forecast:/);
  assert.match(pdf, /33°C \(92°F\)/);
  assert.doesNotMatch(pdf, /Expected conditions/);
  assert.doesNotMatch(pdf, /\blive weather\b/i);

  const row = dayConditionRow("orlando", day, "f");
  assert.ok(row);
  assert.match(row.tooltip, /not a live forecast/);
  assert.match(row.tooltip, /92°F/);
  assert.match(row.tooltip, /Busy crowds expected in July/);

  assert.equal(pdfDayConditionLine("not-a-region", day, "c"), null);

  console.log("planner-day-conditions.test.ts: ok");
}

run();
