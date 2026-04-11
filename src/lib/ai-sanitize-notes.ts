/** Strips leaked scoring arithmetic from AI crowd copy; falls back if over-stripped. */
export function sanitizeDayNote(raw: string): string {
  if (!raw) return raw;
  const original = raw.trim();
  let text = original;

  text = text.replace(
    /\s*[(\[][^)\]]*\b(score|crowd\s*index|index|rating)\b[^)\]]*[)\]]/gi,
    "",
  );

  text = text.replace(/\bscore[s]?\s*[:=]?\s*[\d+\-*/=.\s]+/gi, "");

  text = text.replace(
    /\b\d+\s*[+\-*/]\s*\d+\s*=\s*[\d.]+(?:\s*\/\s*\d+\s*=\s*[\d.]+)?/g,
    "",
  );

  text = text.replace(
    /\b(day\s*rating|crowd|traffic|level)\s*[:=]\s*\d+(?:\s*\/\s*\d+)?/gi,
    "",
  );

  text = text.replace(/\(\s*\)/g, "");
  text = text.replace(/\[\s*\]/g, "");
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/\s+([,.;:])/g, "$1");
  text = text.replace(/^[\s,;:.\-–—]+/, "");
  text = text.replace(/[\s,;:.\-–—]+$/, "");
  text = text.trim();

  if (text.length === 0 || text.length < 10) {
    return original.length > 0 ? original : text;
  }
  return text;
}
