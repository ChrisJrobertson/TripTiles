/**
 * Insert Batch 1 attractions (reads generated SQL, parses VALUES, inserts via service role).
 * Run: node --env-file=.env.local scripts/apply-attractions-disney-international-batch1.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Parse single-quoted SQL string (handles ''). */
function parseSqlString(s, i) {
  if (s[i] !== "'") return null;
  let out = "";
  i += 1;
  while (i < s.length) {
    if (s[i] === "'") {
      if (s[i + 1] === "'") {
        out += "'";
        i += 2;
        continue;
      }
      return { value: out, end: i + 1 };
    }
    out += s[i];
    i += 1;
  }
  return null;
}

/** Comma-separate VALUES ( ... ) into tokens. */
function parseValuesTuple(inner) {
  const tokens = [];
  let i = 0;
  const ws = () => {
    while (i < inner.length && /\s/.test(inner[i])) i += 1;
  };
  while (i < inner.length) {
    ws();
    if (i < inner.length && inner[i] === ",") {
      i += 1;
      continue;
    }
    if (i >= inner.length) break;
    if (inner[i] === "'") {
      const p = parseSqlString(inner, i);
      if (!p) throw new Error("Bad string at " + i);
      tokens.push(p.value);
      i = p.end;
      continue;
    }
    if (inner.slice(i, i + 4).toUpperCase() === "NULL") {
      tokens.push(null);
      i += 4;
      continue;
    }
    const numMatch = inner.slice(i).match(/^-?\d+/);
    if (numMatch) {
      tokens.push(parseInt(numMatch[0], 10));
      i += numMatch[0].length;
      continue;
    }
    throw new Error("Unexpected at pos " + i + ": " + inner.slice(i, i + 30));
  }
  if (tokens.length !== 9) {
    throw new Error(`Expected 9 values, got ${tokens.length}: ${JSON.stringify(tokens)}`);
  }
  return {
    id: tokens[0],
    park_id: tokens[1],
    name: tokens[2],
    height_requirement_cm: tokens[3],
    thrill_level: tokens[4],
    avg_wait_peak_minutes: tokens[5],
    skip_line_tier: tokens[6],
    skip_line_system: tokens[7],
    skip_line_notes: tokens[8],
  };
}

function main() {
  const sqlPath = join(
    __dirname,
    "../supabase/seeds/attractions_disney_international_batch1.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");
  const rows = [];
  const re = /VALUES\s*\(([^;]*?)\)\s*;/gims;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const inner = m[1].trim();
    rows.push(parseValuesTuple(inner));
  }
  if (rows.length === 0) {
    console.error("No VALUES rows found in " + sqlPath);
    process.exit(1);
  }
  return rows;
}

const rows = main();
const byPark = (pid) => rows.filter((r) => r.park_id === pid).length;

console.log("Parsed rows:", rows.length);
for (const pid of ["dl", "dca", "dlp", "wdsp", "hkdl"]) {
  console.log(`  ${pid}: ${byPark(pid)}`);
}

const { data, error } = await supabase.from("attractions").insert(rows).select("id, park_id");

if (error) {
  console.error("Insert error:", error.message);
  process.exit(1);
}

console.log("Inserted:", data?.length ?? 0);
const counts = {};
for (const r of data ?? []) {
  counts[r.park_id] = (counts[r.park_id] || 0) + 1;
}
console.log("By park_id:", counts);
