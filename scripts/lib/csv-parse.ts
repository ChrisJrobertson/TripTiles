/** Minimal CSV parser (quoted fields, commas). */

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsvRows(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error("CSV is empty");
  const headers = splitCsvLine(lines[0]!).map((h) => h.replace(/^\ufeff/, "").trim());
  if (headers.length === 0 || !headers[0]) throw new Error("CSV has no headers");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (parts[j] ?? "").trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

export function rowIsExampleTemplate(row: Record<string, string>): boolean {
  const id =
    row.park_id?.trim() ||
    row.region_id?.trim() ||
    row.attraction_id?.trim() ||
    "";
  if (/EXAMPLE_DELETE_BEFORE_IMPORT/i.test(id)) return true;
  if (/^EXAMPLE_/i.test(id)) return true;
  return false;
}
