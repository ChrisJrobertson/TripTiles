/**
 * Optional guest-pasted wait (e.g. from a board) — heuristics only, not live.
 */
export function normalizePastedQueueMinutes(
  raw: number | null | undefined,
): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  const n = Math.floor(Math.abs(Number(raw)));
  if (n === 0) return null;
  return Math.min(600, n);
}
