/**
 * Run: npx tsx src/lib/region-skip-line-ui.test.ts
 */
import assert from "node:assert/strict";
import {
  regionHasDisneySkipProducts,
  regionShowsSkipLineProducts,
} from "./region-skip-line-ui";
import type { Park, Region } from "@/lib/types";

function region(over: Partial<Region>): Region {
  return {
    id: "orl",
    name: "Orlando",
    short_name: "Orlando",
    country: "US",
    country_code: "US",
    continent: "NA",
    flag_emoji: null,
    description: null,
    is_active: true,
    is_featured: true,
    sort_order: 0,
    has_disney: true,
    has_universal: true,
    data_quality_tier: "standard",
    ...over,
  };
}

function mkPark(over: Partial<Park>): Park {
  return {
    id: "x",
    name: "X",
    icon: null,
    bg_colour: "#fff",
    fg_colour: "#000",
    park_group: "other",
    destinations: [],
    region_ids: ["orl"],
    is_custom: false,
    sort_order: 0,
    ...over,
  };
}

function run() {
  const parks: Park[] = [
    mkPark({ id: "d1", park_group: "disney", region_ids: ["orl"] }),
  ];
  assert.equal(
    regionHasDisneySkipProducts(region({ has_disney: false }), parks, "orl"),
    false,
    "flag false wins over catalogue",
  );
  assert.equal(
    regionShowsSkipLineProducts(region({ has_disney: false, has_universal: false }), parks, "orl"),
    false,
    "no skip-line when both flags false",
  );
  assert.equal(
    regionHasDisneySkipProducts(undefined, parks, "orl"),
    true,
    "no region falls back to catalogue",
  );

  console.log("region-skip-line-ui tests: all passed");
}

run();
