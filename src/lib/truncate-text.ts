const ELL = "…";

/**
 * Truncates for compact UI (badges, banners) and ends at a full sentence, clause,
 * or word when possible, so we avoid mid-sentence “…” cuts.
 */
export function truncateForPreview(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const minKeep = Math.min(12, Math.max(4, Math.floor(maxLen * 0.2)));
  const head = t.slice(0, maxLen);

  for (const sep of [". ", "! ", "? ", ".\n", "!\n", "?\n"] as const) {
    let from = head.length;
    for (;;) {
      const j = head.lastIndexOf(sep, from - 1);
      if (j < minKeep) break;
      const end = j + 1;
      if (end <= maxLen) {
        return t.slice(0, end).trimEnd() + ELL;
      }
      from = j;
    }
  }

  const nl = head.lastIndexOf("\n");
  if (nl >= minKeep) {
    return t.slice(0, nl).trimEnd() + ELL;
  }

  const sp = head.lastIndexOf(" ");
  if (sp >= Math.max(minKeep, Math.floor(maxLen * 0.4))) {
    return t.slice(0, sp).trimEnd() + ELL;
  }

  return head.trimEnd() + ELL;
}

/**
 * Trims AI prose to a max length for persistence without obvious mid-word cuts
 * (falls back to hard slice only if there is no safe boundary in the tail).
 */
export function softTruncateToMax(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const head = t.slice(0, maxLen);
  const minKeep = 8;
  const tailWindow = 48;
  const searchStart = Math.max(minKeep, maxLen - tailWindow);

  for (const sep of [". ", "! ", "? "] as const) {
    const j = head.lastIndexOf(sep);
    if (j >= searchStart) {
      return t.slice(0, j + 1).trim();
    }
  }

  const sp = head.lastIndexOf(" ", maxLen);
  if (sp >= searchStart) {
    return t.slice(0, sp).trim();
  }

  return head.trim();
}
