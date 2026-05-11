/**
 * scripts/import-catalogue.ts
 *
 * Imports the enriched catalogue workbook into Supabase via UPSERT.
 * Idempotent by design — re-running with the same workbook is a no-op.
 *
 * Usage: npm run catalogue:import
 *
 * Reads:  docs/catalogue/triptiles-catalogue-enriched-v2-2026-05-11.xlsx
 * Writes: UPSERT into parks (by id), UPSERT into attractions (by id)
 *
 * NEVER deletes rows. Parks and attractions present in the DB but absent
 * from the workbook are left untouched.
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKBOOK_PATH = resolve(
  __dirname,
  "..",
  "docs",
  "catalogue",
  "triptiles-catalogue-enriched-v2-2026-05-11.xlsx",
);

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("   Set them in .env.local or export them before running this script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ----- Helpers -----

function readSheet(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const ws = workbook.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in workbook`);
  // The workbook uses a presentation layout: column A is a gutter, row 1-2 are title
  // banners, row 3 is the header row, data starts row 4.
  return XLSX.utils.sheet_to_json(ws, { range: 2, defval: null });
}

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === "" || str === "N/A" ? null : str;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined) return false;
  const str = String(v).trim().toUpperCase();
  return str === "TRUE" || str === "1" || str === "YES";
}

function pipeArray(v: unknown): string[] {
  if (!v) return [];
  return String(v)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

const ATTRACTION_CATEGORIES = new Set([
  "ride",
  "show",
  "character_meet",
  "experience",
]);

function attractionCategory(v: unknown): string {
  const c = s(v) ?? "ride";
  if (ATTRACTION_CATEGORIES.has(c)) return c;
  if (c === "area" || c === "land") return "experience";
  return "ride";
}

// ----- Main -----

async function importParks(workbook: XLSX.WorkBook) {
  const rows = readSheet(workbook, "Parks");

  // Map to DB shape. Note the field name mismatch: workbook uses `park_id`,
  // DB primary key column is `id`.
  const payload = rows
    .filter((r) => s(r.park_id) !== null)
    .map((r) => {
      const destinations = pipeArray(r.destinations);
      const regionIds = pipeArray(r.region_ids);
      return {
        id: s(r.park_id)!,
        name: s(r.name) ?? "",
        icon: s(r.icon),
        bg_colour: s(r.bg_colour) ?? "#2455ac",
        fg_colour: s(r.fg_colour) ?? "#FFD700",
        park_group: s(r.park_group) ?? "attractions",
        country: s(r.country),
        latitude: num(r.latitude),
        longitude: num(r.longitude),
        official_url: s(r.official_url),
        opens_at: s(r.opens_at),
        closes_at: s(r.closes_at),
        hours_known: bool(r.hours_known),
        destinations: destinations.length > 0 ? destinations : ["custom"],
        ...(regionIds.length > 0 ? { region_ids: regionIds } : {}),
        enrichment_status: s(r.enrichment_status) ?? "unverified",
        notes: s(r.notes),
      };
    });

  console.log(
    `[parks] Read ${rows.length} rows from sheet, upserting ${payload.length} non-empty rows…`,
  );

  const { data, error } = await supabase
    .from("parks")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false })
    .select("id");

  if (error) {
    console.error("[parks] ❌ UPSERT failed:", error.message);
    throw error;
  }

  console.log(`[parks] ✅ Upserted ${data?.length ?? 0} rows`);
}

async function importAttractions(workbook: XLSX.WorkBook) {
  const rows = readSheet(workbook, "Attractions");

  const payload = rows
    .filter((r) => s(r.id) !== null && s(r.park_id) !== null)
    .map((r) => ({
      id: s(r.id)!,
      park_id: s(r.park_id)!,
      name: s(r.name) ?? "",
      category: attractionCategory(r.category),
      thrill_level: s(r.thrill_level) ?? "moderate",
      is_indoor: bool(r.is_indoor),
      duration_minutes: num(r.duration_minutes),
      height_requirement_cm: num(r.height_requirement_cm),
      skip_line_system: s(r.skip_line_system),
      skip_line_tier: s(r.skip_line_tier),
      avg_wait_peak_minutes: num(r.avg_wait_peak_minutes),
      avg_wait_offpeak_minutes: num(r.avg_wait_offpeak_minutes),
      is_seasonal: bool(r.is_seasonal),
      is_temporarily_closed: bool(r.is_temporarily_closed),
      tags: pipeArray(r.tags),
      official_url: s(r.official_url),
      sort_order: num(r.sort_order) ?? 0,
    }));

  console.log(
    `[attractions] Read ${rows.length} rows from sheet, upserting ${payload.length} non-empty rows…`,
  );

  const { data, error } = await supabase
    .from("attractions")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false })
    .select("id");

  if (error) {
    console.error("[attractions] ❌ UPSERT failed:", error.message);
    throw error;
  }

  console.log(`[attractions] ✅ Upserted ${data?.length ?? 0} rows`);
}

async function main() {
  console.log(`\n📖 Reading workbook: ${WORKBOOK_PATH}\n`);
  const buf = readFileSync(WORKBOOK_PATH);
  const workbook = XLSX.read(buf, { type: "buffer" });

  console.log(`Available sheets: ${workbook.SheetNames.join(", ")}\n`);

  await importParks(workbook);
  await importAttractions(workbook);

  console.log("\n✅ Catalogue import complete.\n");
  console.log("Run these in Supabase to verify post-state:");
  console.log("  SELECT enrichment_status, COUNT(*) FROM parks GROUP BY 1 ORDER BY 2 DESC;");
  console.log("  SELECT skip_line_system, COUNT(*) FROM attractions GROUP BY 1 ORDER BY 2 DESC;");
  console.log("  SELECT skip_line_tier, COUNT(*) FROM attractions GROUP BY 1 ORDER BY 2 DESC;");
}

main().catch((err) => {
  console.error("\n❌ Import failed:", err);
  process.exit(1);
});
