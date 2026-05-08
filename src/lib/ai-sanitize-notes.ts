/** Decode common HTML entities that sometimes appear in model output or stored JSON. */
export function decodeHtmlEntitiesInAiText(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®");
}

/** Remove a single wrapping markdown code fence if the string is fully fenced. */
export function stripMarkdownCodeFences(raw: string): string {
  if (!raw) return raw;
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  const firstNl = t.indexOf("\n");
  if (firstNl === -1) return t;
  const close = t.lastIndexOf("```");
  if (close <= firstNl) return t;
  return t.slice(firstNl + 1, close).trim();
}

/**
 * Drops a leading sentence when it matches known apologetic / disclaimer openers
 * from legacy model output (narrow patterns to avoid stripping real park advice).
 */
export function stripApologeticAiLeadSentence(raw: string): string {
  if (!raw?.trim()) return raw;
  let t = raw.trim();
  const tryStrip = (re: RegExp) => {
    const m = t.match(re);
    if (m) t = t.slice(m[0].length).trim();
  };
  tryStrip(/^with no specific crowd data[^.!?]*[.!?]\s*/i);
  tryStrip(/^i(?:'|’)?m sorry[^.!?]*[.!?]\s*/i);
  tryStrip(/^i apologi[sz]e[^.!?]*[.!?]\s*/i);
  tryStrip(/^as an ai[^.!?]*[.!?]\s*/i);
  tryStrip(/^unfortunately,?\s+i (?:don'?t|do not) have[^.!?]*[.!?]\s*/i);
  return t;
}

/**
 * Full planner-surface pipeline for AI prose shown in timelines, day strategy,
 * heat/transport lines, and per-day crowd notes (not a substitute for
 * `resolvePlannerCrowdStrategyText` on trip-level crowd strategy).
 */
export function sanitizeAiPlannerDisplayText(raw: string): string {
  if (!raw) return raw;
  let t = raw.trim();
  if (!t) return "";
  t = decodeHtmlEntitiesInAiText(t);
  t = stripMarkdownCodeFences(t);
  t = stripApologeticAiLeadSentence(t);
  return sanitizeDayNote(t);
}

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

const LIKELY_CROSS_PARK_RIDE_CHUNK =
  /\b(?:velocicoaster|veloci\s*coaster|hagrid'?s\b|hogwarts\s*express|mistaken\s+rides\b)[^.;]*(?:[.;]|$)/gi;

/**
 * Structural Smart Plan prose only — removes common cross-park ride analogies and filler.
 */
export function sanitizeStructuralSmartPlanPlannerNote(raw: string): string {
  if (!raw?.trim()) return raw;
  let t = raw;
  t = t.replace(/\b([\w'-]+\s+){0,8}analog(?:ue|)\b[^.;]*/gi, "");
  t = t.replace(/\banalog(?:ue|)\s+for\b[^.;]*/gi, "");
  t = t.replace(LIKELY_CROSS_PARK_RIDE_CHUNK, "");
  t = t.replace(/\s*[;,]\s*;/g, ";");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}
