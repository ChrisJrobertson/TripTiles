const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Normalizes guest skip-line (LL/Express) return time to 24h `HH:mm` or null.
 * Accepts `HH:mm` and browser `type="time"` values with optional seconds.
 */
export function normalizeSkipLineReturnHhmm(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === "") return null;
  const base =
    t.length >= 8 && t[2] === ":" && t[5] === ":"
      ? t.slice(0, 5)
      : t.length >= 5 && t[2] === ":"
        ? t.slice(0, 5)
        : t;
  if (!HHMM_RE.test(base)) {
    throw new Error("Return time must be a valid 24h time (HH:mm).");
  }
  const [h, m] = base.split(":");
  return `${h!.padStart(2, "0")}:${m!}`;
}

export function timeInputValueFromHhmm(hhmm: string | null | undefined): string {
  if (hhmm == null || !String(hhmm).trim()) return "";
  const t = String(hhmm).trim();
  const base =
    t.length >= 8 && t[2] === ":" && t[5] === ":"
      ? t.slice(0, 5)
      : t.length >= 5 && t[2] === ":"
        ? t.slice(0, 5)
        : t;
  if (!HHMM_RE.test(base)) return "";
  const [h, m] = base.split(":");
  return `${h!.padStart(2, "0")}:${m!}`;
}
