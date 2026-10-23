import assert from "node:assert/strict";
import {
  isPublishedPlanSlug,
  missingPublicPlanHtml,
  publicPlanLookupSlug,
} from "./public-plan-status";

assert.equal(publicPlanLookupSlug("/plans"), null);
assert.equal(publicPlanLookupSlug("/pricing"), null);
assert.equal(publicPlanLookupSlug("/plans/Magic-Kingdom"), "magic-kingdom");
assert.equal(
  publicPlanLookupSlug("/plans/e2e-share-1/opengraph-image"),
  "e2e-share-1",
);
assert.equal(publicPlanLookupSlug("/plans/"), "");
assert.equal(isPublishedPlanSlug("e2e-share-1"), true);
assert.equal(isPublishedPlanSlug(""), false);
assert.equal(isPublishedPlanSlug("Has Space"), false);
assert.equal(isPublishedPlanSlug("a".repeat(81)), false);

const html = missingPublicPlanHtml();
assert.match(html, /<h1>This page could not be found.<\/h1>/);
assert.equal(html.includes("child_ages"), false);
assert.equal(html.includes("notes"), false);

console.log("public-plan-status.test.ts: ok");
