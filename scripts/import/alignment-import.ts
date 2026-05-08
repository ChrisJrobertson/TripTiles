/**
 * CSV alignment importers — dry-run by default; --apply + SUPABASE_SERVICE_ROLE_KEY writes.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/import/alignment-import.ts park-metadata --file templates/park-metadata-template.csv
 *   node --env-file=.env.local --import tsx scripts/import/alignment-import.ts park-metadata --file path.csv --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseCsvRows, rowIsExampleTemplate } from "../lib/csv-parse";
import {
  rejectIfPlaceholder,
  validateAttractionCategory,
  validateCoordinates,
  validateHhmm,
  validateSkipLineSystemId,
  validateSourceFields,
  validateThrillLevel,
} from "../../src/lib/data-import/import-validation";

type RowErr = { row: number; field: string; message: string };

const COMMANDS = [
  "park-metadata",
  "park-hours",
  "park-areas",
  "attractions",
  "skip-line-mapping",
  "region-briefings",
  "park-briefings",
] as const;

type Command = (typeof COMMANDS)[number];

function usage(): never {
  console.error(`Usage: alignment-import.ts <${COMMANDS.join("|")}> --file <path.csv> [--apply] [--allow-protected]`);
  process.exit(1);
  throw new Error("unreachable");
}

function parseProtectedRegionIds(): string[] {
  return (process.env.ALIGNMENT_PROTECT_REGION_IDS ?? "orlando")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isProtectedParkRegionIds(regionIds: string[] | null | undefined): boolean {
  const prot = parseProtectedRegionIds();
  return (regionIds ?? []).some((rid) => prot.includes(rid));
}

async function loadBuiltInPark(
  supabase: SupabaseClient,
  parkId: string,
): Promise<{ id: string; region_ids: string[] } | null> {
  const { data, error } = await supabase
    .from("parks")
    .select("id, region_ids, is_custom")
    .eq("id", parkId)
    .maybeSingle();
  if (error || !data) return null;
  if (data.is_custom) return null;
  return { id: data.id as string, region_ids: (data.region_ids as string[]) ?? [] };
}

async function assertRegionExists(
  supabase: SupabaseClient,
  regionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("regions")
    .select("id")
    .eq("id", regionId)
    .maybeSingle();
  return !error && Boolean(data);
}

function writeErrorsCsv(outPath: string, errors: RowErr[]): void {
  const lines = ["row,field,message", ...errors.map((e) => `${e.row},${e.field},${csvEscape(e.message)}`)];
  writeFileSync(outPath, lines.join("\n"), "utf8");
}

function csvEscape(s: string): string {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function startBatch(
  supabase: SupabaseClient,
  script: string,
  filePath: string,
  sha: string,
  dryRun: boolean,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("import_batches")
    .insert({
      script_name: script,
      file_path: filePath,
      file_sha256: sha,
      dry_run: dryRun,
      applied_by: process.env.USER ?? process.env.LOGNAME ?? "cli",
      git_sha: process.env.GIT_SHA?.slice(0, 40) ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("import_batches insert failed:", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

async function finishBatch(
  supabase: SupabaseClient,
  id: string,
  ok: number,
  err: number,
  meta: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("import_batches")
    .update({
      finished_at: new Date().toISOString(),
      rows_ok: ok,
      rows_err: err,
      meta,
    })
    .eq("id", id);
}

async function runParkMetadata(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
  allowProtected: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const rowErrs: RowErr[] = [];
    const parkId = row.park_id?.trim() ?? "";
    if (!parkId) {
      rowErrs.push({ row: ri, field: "park_id", message: "missing park_id" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    const lat = row.latitude?.trim() ?? "";
    const lng = row.longitude?.trim() ?? "";
    if (lat || lng) {
      const ce = validateCoordinates(lat || "0", lng || "0", ri);
      rowErrs.push(...ce.map((e) => ({ row: ri, field: e.field, message: e.message })));
    }
    for (const [k, v] of Object.entries(row)) {
      if (!["country", "official_url", "icon"].includes(k)) continue;
      if (!v?.trim()) continue;
      const ph = rejectIfPlaceholder(k, v);
      if (ph) rowErrs.push({ row: ri, field: k, message: ph.message });
    }
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    if (!apply) {
      ok += 1;
      continue;
    }
    const park = await loadBuiltInPark(supabase, parkId);
    if (!park) {
      errors.push({ row: ri, field: "park_id", message: "unknown park_id or custom park" });
      continue;
    }
    if (!allowProtected && isProtectedParkRegionIds(park.region_ids)) {
      errors.push({
        row: ri,
        field: "park_id",
        message: `park is protected (${parseProtectedRegionIds().join(",")}); use --allow-protected intentionally`,
      });
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (row.country?.trim()) patch.country = row.country.trim();
    if (lat && lng) {
      patch.latitude = Number(lat);
      patch.longitude = Number(lng);
    }
    if (row.official_url?.trim()) patch.official_url = row.official_url.trim();
    if (row.icon?.trim()) patch.icon = row.icon.trim();
    if (Object.keys(patch).length === 0) {
      errors.push({ row: ri, field: "_", message: "no updatable fields" });
      continue;
    }
    const { error } = await supabase.from("parks").update(patch).eq("id", parkId);
    if (error) {
      errors.push({ row: ri, field: "_", message: error.message });
    } else {
      ok += 1;
    }
  }
  return { ok, err: errors.length, errors };
}

async function runParkHours(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
  allowProtected: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const rowErrs: RowErr[] = [];
    const parkId = row.park_id?.trim() ?? "";
    if (!parkId) {
      rowErrs.push({ row: ri, field: "park_id", message: "missing park_id" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    const oa = row.opens_at?.trim() ?? "";
    const ca = row.closes_at?.trim() ?? "";
    rowErrs.push(...validateHhmm(oa, "opens_at", ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    rowErrs.push(...validateHhmm(ca, "closes_at", ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    const hk = (row.hours_known ?? "true").trim().toLowerCase();
    if (!["true", "false"].includes(hk)) {
      rowErrs.push({ row: ri, field: "hours_known", message: "hours_known must be true or false" });
    }
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    if (!apply) {
      ok += 1;
      continue;
    }
    const park = await loadBuiltInPark(supabase, parkId);
    if (!park) {
      errors.push({ row: ri, field: "park_id", message: "unknown park_id or custom park" });
      continue;
    }
    if (!allowProtected && isProtectedParkRegionIds(park.region_ids)) {
      errors.push({
        row: ri,
        field: "park_id",
        message: `park is protected; use --allow-protected`,
      });
      continue;
    }
    const { error } = await supabase
      .from("parks")
      .update({
        opens_at: oa,
        closes_at: ca,
        hours_known: hk === "true",
      })
      .eq("id", parkId);
    if (error) errors.push({ row: ri, field: "_", message: error.message });
    else ok += 1;
  }
  return { ok, err: errors.length, errors };
}

async function runParkAreas(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
  allowProtected: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const parkId = row.park_id?.trim() ?? "";
    const name = row.name?.trim() ?? "";
    const rowErrs: RowErr[] = [];
    if (!parkId || !name) {
      rowErrs.push({ row: ri, field: "park_id", message: "park_id and name required" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    const ph = rejectIfPlaceholder("name", name);
    if (ph) rowErrs.push({ row: ri, field: "name", message: ph.message });
    const sortOrder = Number(row.sort_order ?? "0");
    if (Number.isNaN(sortOrder)) {
      rowErrs.push({ row: ri, field: "sort_order", message: "invalid sort_order" });
    }
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    if (!apply) {
      ok += 1;
      continue;
    }
    const park = await loadBuiltInPark(supabase, parkId);
    if (!park) {
      errors.push({ row: ri, field: "park_id", message: "unknown park_id or custom park" });
      continue;
    }
    if (!allowProtected && isProtectedParkRegionIds(park.region_ids)) {
      errors.push({ row: ri, field: "park_id", message: "park is protected" });
      continue;
    }
    const { error } = await supabase.from("park_areas").insert({
      park_id: parkId,
      name,
      sort_order: sortOrder,
      source_url: row.source_url!.trim(),
      source_date: row.source_date!.trim(),
    });
    if (error) {
      if (error.code === "23505") {
        errors.push({ row: ri, field: "name", message: "duplicate park area name for park" });
      } else {
        errors.push({ row: ri, field: "_", message: error.message });
      }
    } else ok += 1;
  }
  return { ok, err: errors.length, errors };
}

async function runAttractions(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
  allowProtected: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  const seenName = new Map<string, Set<string>>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const id = row.id?.trim() ?? "";
    const parkId = row.park_id?.trim() ?? "";
    const name = row.name?.trim() ?? "";
    const rowErrs: RowErr[] = [];
    if (!id || !parkId || !name) {
      rowErrs.push({ row: ri, field: "id", message: "id, park_id, name required" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    rowErrs.push(
      ...validateAttractionCategory(row.category ?? "ride", ri).map((e) => ({
        row: ri,
        field: e.field,
        message: e.message,
      })),
    );
    rowErrs.push(
      ...validateThrillLevel(row.thrill_level ?? "moderate", ri).map((e) => ({
        row: ri,
        field: e.field,
        message: e.message,
      })),
    );
    if (row.skip_line_system?.trim()) {
      rowErrs.push(
        ...validateSkipLineSystemId(row.skip_line_system, ri).map((e) => ({
          row: ri,
          field: e.field,
          message: e.message,
        })),
      );
    }
    const ph = rejectIfPlaceholder("name", name);
    if (ph) rowErrs.push({ row: ri, field: "name", message: ph.message });
    const key = parkId.toLowerCase();
    if (!seenName.has(key)) seenName.set(key, new Set());
    const set = seenName.get(key)!;
    const nk = name.toLowerCase();
    if (set.has(nk)) {
      rowErrs.push({ row: ri, field: "name", message: `duplicate attraction name in file for park ${parkId}` });
    }
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    set.add(nk);
    if (!apply) {
      ok += 1;
      continue;
    }
    const park = await loadBuiltInPark(supabase, parkId);
    if (!park) {
      errors.push({ row: ri, field: "park_id", message: "unknown park_id or custom park" });
      continue;
    }
    if (!allowProtected && isProtectedParkRegionIds(park.region_ids)) {
      errors.push({ row: ri, field: "park_id", message: "park is protected" });
      continue;
    }
    const payload = {
      id,
      park_id: parkId,
      name,
      category: (row.category ?? "ride").trim(),
      thrill_level: (row.thrill_level ?? "moderate").trim(),
      is_indoor: false,
      skip_line_system: row.skip_line_system?.trim() || null,
      height_requirement_cm: row.height_requirement_cm?.trim()
        ? Number(row.height_requirement_cm.trim())
        : null,
      sort_order: row.sort_order?.trim() ? Number(row.sort_order.trim()) : 0,
    };
    const { error } = await supabase.from("attractions").upsert(payload, { onConflict: "id" });
    if (error) errors.push({ row: ri, field: "_", message: error.message });
    else ok += 1;
  }
  return { ok, err: errors.length, errors };
}

async function runSkipLineMapping(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const attractionId = row.attraction_id?.trim() ?? "";
    const rowErrs: RowErr[] = [];
    if (!attractionId) {
      rowErrs.push({ row: ri, field: "attraction_id", message: "missing attraction_id" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    rowErrs.push(
      ...validateSkipLineSystemId(row.skip_line_system ?? "", ri).map((e) => ({
        row: ri,
        field: e.field,
        message: e.message,
      })),
    );
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    if (!apply) {
      ok += 1;
      continue;
    }
    const { error } = await supabase
      .from("attractions")
      .update({ skip_line_system: row.skip_line_system!.trim() })
      .eq("id", attractionId);
    if (error) errors.push({ row: ri, field: "_", message: error.message });
    else ok += 1;
  }
  return { ok, err: errors.length, errors };
}

async function runRegionBriefings(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
  allowProtected: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const regionId = row.region_id?.trim() ?? "";
    const body = row.body?.trim() ?? "";
    const rowErrs: RowErr[] = [];
    if (!regionId || !body) {
      rowErrs.push({ row: ri, field: "region_id", message: "region_id and body required" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    const ph = rejectIfPlaceholder("body", body);
    if (ph) rowErrs.push({ row: ri, field: "body", message: ph.message });
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    if (!apply) {
      ok += 1;
      continue;
    }
    if (!(await assertRegionExists(supabase, regionId))) {
      errors.push({ row: ri, field: "region_id", message: "unknown region_id" });
      continue;
    }
    if (!allowProtected && parseProtectedRegionIds().includes(regionId)) {
      errors.push({ row: ri, field: "region_id", message: "protected region; use --allow-protected" });
      continue;
    }
    const { error } = await supabase.from("region_briefings").insert({
      region_id: regionId,
      locale: (row.locale ?? "en").trim(),
      body,
      source_url: row.source_url!.trim(),
      source_date: row.source_date!.trim(),
    });
    if (error) errors.push({ row: ri, field: "_", message: error.message });
    else ok += 1;
  }
  return { ok, err: errors.length, errors };
}

async function runParkBriefings(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  apply: boolean,
  allowProtected: boolean,
): Promise<{ ok: number; err: number; errors: RowErr[] }> {
  const errors: RowErr[] = [];
  let ok = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const ri = i + 2;
    if (rowIsExampleTemplate(row)) continue;
    const parkId = row.park_id?.trim() ?? "";
    const body = row.body?.trim() ?? "";
    const rowErrs: RowErr[] = [];
    if (!parkId || !body) {
      rowErrs.push({ row: ri, field: "park_id", message: "park_id and body required" });
    }
    rowErrs.push(...validateSourceFields(row, ri).map((e) => ({ row: ri, field: e.field, message: e.message })));
    const ph = rejectIfPlaceholder("body", body);
    if (ph) rowErrs.push({ row: ri, field: "body", message: ph.message });
    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }
    if (!apply) {
      ok += 1;
      continue;
    }
    const park = await loadBuiltInPark(supabase, parkId);
    if (!park) {
      errors.push({ row: ri, field: "park_id", message: "unknown park_id or custom park" });
      continue;
    }
    if (!allowProtected && isProtectedParkRegionIds(park.region_ids)) {
      errors.push({ row: ri, field: "park_id", message: "park is protected" });
      continue;
    }
    const { error } = await supabase.from("park_briefings").insert({
      park_id: parkId,
      locale: (row.locale ?? "en").trim(),
      body,
      source_url: row.source_url!.trim(),
      source_date: row.source_date!.trim(),
    });
    if (error) errors.push({ row: ri, field: "_", message: error.message });
    else ok += 1;
  }
  return { ok, err: errors.length, errors };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmdRaw = argv[0];
  const fileIdx = argv.indexOf("--file");
  const fileArg = fileIdx >= 0 ? argv[fileIdx + 1] : null;
  const apply = argv.includes("--apply");
  const allowProtected = argv.includes("--allow-protected");

  if (!cmdRaw || !fileArg) usage();
  if (!COMMANDS.includes(cmdRaw as Command)) usage();

  const cmd = cmdRaw as Command;
  const filePath = resolve(fileArg as string);
  const text = readFileSync(filePath, "utf8");
  const sha = createHash("sha256").update(text).digest("hex");
  const { rows } = parseCsvRows(text);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!url || !anonKey) {
    console.error(
      "❌ Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or PUBLISHABLE_KEY) in .env.local",
    );
    process.exit(1);
  }
  if (apply && !serviceKey) {
    console.error("❌ --apply requires SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, apply && serviceKey ? serviceKey : anonKey);

  let batchId: string | null = null;
  if (apply && url && serviceKey) {
    batchId = await startBatch(supabase, `alignment-import:${cmd}`, filePath, sha, false);
  }

  let result: { ok: number; err: number; errors: RowErr[] };
  switch (cmd) {
    case "park-metadata":
      result = await runParkMetadata(supabase, rows, apply, allowProtected);
      break;
    case "park-hours":
      result = await runParkHours(supabase, rows, apply, allowProtected);
      break;
    case "park-areas":
      result = await runParkAreas(supabase, rows, apply, allowProtected);
      break;
    case "attractions":
      result = await runAttractions(supabase, rows, apply, allowProtected);
      break;
    case "skip-line-mapping":
      result = await runSkipLineMapping(supabase, rows, apply);
      break;
    case "region-briefings":
      result = await runRegionBriefings(supabase, rows, apply, allowProtected);
      break;
    case "park-briefings":
      result = await runParkBriefings(supabase, rows, apply, allowProtected);
      break;
    default:
      usage();
  }

  const outDir = dirname(filePath);
  const errPath = join(outDir, `import-errors-${cmd}.csv`);
  const summaryPath = join(outDir, `import-summary-${cmd}.json`);
  if (result.errors.length > 0) {
    writeErrorsCsv(errPath, result.errors);
    console.error(`Wrote ${errPath}`);
  }
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        command: cmd,
        file: filePath,
        dryRun: !apply,
        sha256: sha,
        rows_ok: result.ok,
        rows_err: result.errors.length,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Summary → ${summaryPath}`);
  if (batchId && apply) {
    await finishBatch(supabase, batchId, result.ok, result.errors.length, {
      command: cmd,
      file: basename(filePath),
    });
  }

  if (result.errors.length > 0) {
    console.error(`❌ ${result.errors.length} validation / apply errors`);
    process.exit(1);
  }
  console.log(apply ? `✅ Applied ${result.ok} rows` : `✅ Dry-run OK for ${result.ok} rows (use --apply to write)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
