/**
 * Run: npx tsx src/lib/ai/region-briefing.test.ts
 */
import assert from "node:assert/strict";
import { buildAiRegionBriefingBlock } from "./region-briefing";
import type { Park, Region } from "@/lib/types";

function baseRegion(over: Partial<Region>): Region {
  return {
    id: "r1",
    name: "Testland",
    short_name: "Test",
    country: "Test Country",
    country_code: "TC",
    continent: "Test",
    flag_emoji: null,
    description: null,
    is_active: true,
    is_featured: false,
    sort_order: 0,
    has_disney: false,
    has_universal: false,
    data_quality_tier: "light",
    ...over,
  };
}

function park(over: Partial<Park>): Park {
  return {
    id: "p1",
    name: "Magic Kingdom",
    icon: null,
    bg_colour: "#fff",
    fg_colour: "#000",
    park_group: "disney",
    destinations: [],
    region_ids: ["r1"],
    is_custom: false,
    sort_order: 0,
    ...over,
  };
}

function run() {
  const r = baseRegion({});
  const block = buildAiRegionBriefingBlock(r, [
    park({ id: "p1", name: "Park One", region_ids: ["r1"] }),
  ]);
  assert.ok(block.includes("Testland"), "includes region name");
  assert.ok(block.includes("LIGHT") || block.includes("light"), "mentions tier");
  assert.ok(block.includes("Catalogue park count"), "mentions park count");
  assert.ok(
    block.includes("does not include Disney") ||
      block.includes("Disney queue-skip"),
    "disney line present",
  );

  const orlando = buildAiRegionBriefingBlock(
    baseRegion({
      has_disney: true,
      has_universal: true,
      data_quality_tier: "deep",
    }),
    [],
  );
  assert.ok(
    orlando.includes("includes Disney-style") ||
      orlando.includes("Disney-style queue"),
    "disney true copy",
  );
  assert.ok(
    orlando.includes("Universal Express") ||
      orlando.includes("Universal Express-style"),
    "universal true copy",
  );

  console.log("region-briefing tests: all passed");
}

run();
