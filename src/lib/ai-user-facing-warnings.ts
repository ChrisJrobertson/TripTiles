/**
 * Internal telemetry tokens (also written to `ai_generations.error`) must not
 * appear in the UI. Keep in sync with server normalisation in `ai.ts`.
 */
const INTERNAL_WARNING_LINE_RE =
  /^(?:sanitised:|validation_warning:|planner_day_notes_park_mismatch|unknown_ride)/;

export function isInternalAiWarningLine(line: string): boolean {
  return INTERNAL_WARNING_LINE_RE.test(line.trim());
}

/** Strips internal lines. Does not log — safe for server actions. */
export function filterUserFacingAiWarningLines(
  lines: string[] | undefined | null,
): string[] {
  if (!lines?.length) return [];
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (!isInternalAiWarningLine(t)) out.push(line);
  }
  return out;
}

/**
 * For client components: same as `filterUserFacingAiWarningLines`, but logs in
 * development if anything was stripped (belt and braces if stale data exists).
 */
export function filterUserFacingAiWarningLinesForUi(
  lines: string[] | undefined | null,
  label: string,
): string[] {
  if (!lines?.length) return [];
  const out: string[] = [];
  const stripped: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (isInternalAiWarningLine(t)) stripped.push(t);
    else out.push(line);
  }
  if (process.env.NODE_ENV === "development" && stripped.length > 0) {
    console.warn(
      `[TripTiles] Filtered internal AI warning line(s) (${label}):`,
      stripped,
    );
  }
  return out;
}
