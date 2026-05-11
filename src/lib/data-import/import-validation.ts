/**
 * Shared validation for CSV alignment imports (no DB access — pure functions).
 */

export const KNOWN_SKIP_LINE_SYSTEM_IDS = [
  "lightning_lane",
  "universal_express",
  "disneyland_paris_premier_access",
  "tokyo_disney_premier",
  "shanghai_disney_premier",
  "hongkong_disney_premier",
  "universal_japan_express",
  "universal_singapore_express",
  "none",
] as const;

export type SkipLineSystemId = (typeof KNOWN_SKIP_LINE_SYSTEM_IDS)[number];

const PLACEHOLDER_RES = [
  /\bTODO\b/i,
  /\[YOUR/i,
  /\{\{/,
  /\$\{/,
  /\bTBC\b/i,
  /\bFIXME\b/i,
  /\bXXX\b/i,
  /\bLorem ipsum\b/i,
];

export type FieldError = { field: string; message: string };

export function isValidHttpsUrl(raw: string): boolean {
  const s = raw.trim();
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseIsoDateOnly(raw: string): { ok: true; value: string } | { ok: false } {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false };
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, value: s };
}

export function rejectIfPlaceholder(field: string, value: string): FieldError | null {
  const v = value.trim();
  if (!v) return { field, message: "empty value" };
  for (const re of PLACEHOLDER_RES) {
    if (re.test(v)) {
      return { field, message: `placeholder or unsafe pattern (${re.source})` };
    }
  }
  return null;
}

export function validateSourceFields(
  row: Record<string, string>,
  rowIndex: number,
): FieldError[] {
  const errs: FieldError[] = [];
  const prefix = `row ${rowIndex}:`;
  const url = row.source_url?.trim() ?? "";
  const dateRaw = row.source_date?.trim() ?? "";
  if (!url) errs.push({ field: "source_url", message: `${prefix} missing source_url` });
  else if (!isValidHttpsUrl(url)) {
    errs.push({ field: "source_url", message: `${prefix} source_url must be http(s) URL` });
  }
  if (!dateRaw) errs.push({ field: "source_date", message: `${prefix} missing source_date` });
  else if (!parseIsoDateOnly(dateRaw).ok) {
    errs.push({ field: "source_date", message: `${prefix} source_date must be YYYY-MM-DD` });
  }
  const ph = rejectIfPlaceholder("source_url", url);
  if (ph) errs.push({ field: ph.field, message: `${prefix} ${ph.message}` });
  return errs;
}

export function validateCoordinates(
  latRaw: string,
  lngRaw: string,
  rowIndex: number,
): FieldError[] {
  const errs: FieldError[] = [];
  const lat = Number(latRaw.trim());
  const lng = Number(lngRaw.trim());
  if (latRaw.trim() === "" || Number.isNaN(lat)) {
    errs.push({ field: "latitude", message: `row ${rowIndex}: invalid latitude` });
  } else if (lat < -90 || lat > 90) {
    errs.push({ field: "latitude", message: `row ${rowIndex}: latitude out of range` });
  }
  if (lngRaw.trim() === "" || Number.isNaN(lng)) {
    errs.push({ field: "longitude", message: `row ${rowIndex}: invalid longitude` });
  } else if (lng < -180 || lng > 180) {
    errs.push({ field: "longitude", message: `row ${rowIndex}: longitude out of range` });
  }
  return errs;
}

export function validateHhmm(raw: string, field: string, rowIndex: number): FieldError[] {
  const s = raw.trim();
  if (!/^\d{2}:\d{2}$/.test(s)) {
    return [{ field, message: `row ${rowIndex}: ${field} must be HH:MM` }];
  }
  const [hh, mm] = s.split(":").map(Number);
  if (hh == null || mm == null || hh > 23 || mm > 59) {
    return [{ field, message: `row ${rowIndex}: ${field} out of range` }];
  }
  return [];
}

export function validateSkipLineSystemId(
  raw: string,
  rowIndex: number,
): FieldError[] {
  const id = raw.trim();
  if (!id) return [{ field: "skip_line_system", message: `row ${rowIndex}: empty` }];
  if (!(KNOWN_SKIP_LINE_SYSTEM_IDS as readonly string[]).includes(id)) {
    return [
      {
        field: "skip_line_system",
        message: `row ${rowIndex}: unknown skip_line_system_id "${id}"`,
      },
    ];
  }
  return [];
}

export function validateAttractionCategory(
  raw: string,
  rowIndex: number,
): FieldError[] {
  const c = raw.trim();
  const allowed = ["ride", "show", "character_meet", "experience"];
  if (!allowed.includes(c)) {
    return [
      {
        field: "category",
        message: `row ${rowIndex}: category must be one of ${allowed.join(", ")}`,
      },
    ];
  }
  return [];
}

export function validateThrillLevel(raw: string, rowIndex: number): FieldError[] {
  const c = raw.trim();
  const allowed = ["gentle", "moderate", "thrilling", "intense"];
  if (!allowed.includes(c)) {
    return [
      {
        field: "thrill_level",
        message: `row ${rowIndex}: thrill_level must be one of ${allowed.join(", ")}`,
      },
    ];
  }
  return [];
}
