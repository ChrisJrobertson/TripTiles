/**
 * Run: npx tsx src/lib/ai-sanitize-notes.test.ts
 */
import assert from "node:assert/strict";
import {
  decodeHtmlEntitiesInAiText,
  sanitizeAiPlannerDisplayText,
  sanitizeDayNote,
  stripApologeticAiLeadSentence,
  stripMarkdownCodeFences,
} from "./ai-sanitize-notes";

function run() {
  assert.equal(
    decodeHtmlEntitiesInAiText("it&apos;s fine"),
    "it's fine",
    "decode &apos;",
  );
  assert.equal(
    stripMarkdownCodeFences("```\nhello\n```"),
    "hello",
    "strip fences",
  );
  assert.equal(
    stripApologeticAiLeadSentence(
      "With no specific crowd data provided, here is a guess. Visit early.",
    ),
    "Visit early.",
    "strip stale crowd opener",
  );
  const scored =
    "Nice day. (crowd index: 3/10) Arrive for rope drop.";
  const cleaned = sanitizeDayNote(scored);
  assert.ok(
    !/crowd index/i.test(cleaned),
    "sanitizeDayNote removes score leakage",
  );
  const pipeline = sanitizeAiPlannerDisplayText(
    "```\nWith no specific crowd data. &apos;Go&apos; early.\n```",
  );
  assert.ok(
    /go/i.test(pipeline) && !/&apos;/i.test(pipeline),
    "pipeline decodes, strips fence and opener",
  );

  console.log("ai-sanitize-notes tests: all passed");
}

run();
