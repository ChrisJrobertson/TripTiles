import { eachDateKeyInRange, parseDate } from "@/lib/date-helpers";

/** Canonical English weekday names / abbreviations (index = JS Date.getDay(), 0=Sun). Longest aliases first within each slice for safe removal. */
const WEEKDAY_INDEX_ALIASES: readonly string[][] = [
  ["Sunday", "Sun"],
  ["Monday", "Mon"],
  ["Tuesday", "Tues", "Tue"],
  ["Wednesday", "Wed"],
  ["Thursday", "Thurs", "Thu"],
  ["Friday", "Fri"],
  ["Saturday", "Sat"],
];

function regexEscapePhrase(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Drops weekday words that contradict `dateKeyYYYYmmDD`'s calendar weekday.
 * Prefer removal over rewriting — callers should supply correct weekdays in prompts.
 */
export function stripWrongWeekdaysFromTripDateNote(
  dateKeyYYYYmmDD: string,
  raw: string,
): string {
  if (!raw?.trim()) return raw;
  const dt = parseDate(dateKeyYYYYmmDD);
  if (Number.isNaN(dt.getTime())) return raw;
  const actual = dt.getDay();

  /** Longest aliases first globally so Thursday beats Thu safely. */
  const wrongPhrases = WEEKDAY_INDEX_ALIASES.flatMap((aliases, idx) =>
    idx === actual ? [] : [...aliases],
  ).sort((a, b) => b.length - a.length);

  let text = raw;
  for (const phrase of wrongPhrases) {
    text = text.replace(
      new RegExp(`\\b${regexEscapePhrase(phrase)}\\b`, "gi"),
      "",
    );
  }

  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/\s+([,.;:])/g, "$1");
  text = text.replace(/^[,\s;.:—\-–]+\s*/, "");
  text = text.replace(/\s*[,\s;.:—\-–]+$/, "");
  text = text.replace(/\b(on|for|at)\s+[,.;:]/gi, "");
  text = text.replace(/\s*\(\s*\)/g, "");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

/**
 * One line per trip day for Smart Plan prompts (UK weekday naming).
 */
export function formatSmartPlanTripCalendarAuthorityBlock(
  startIso: string,
  endIso: string,
): string {
  const keys = eachDateKeyInRange(startIso, endIso);
  if (keys.length === 0) return "";
  const lines = keys.map((k) => {
    const d = parseDate(k);
    const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
    return `${k} = ${weekday}`;
  });

  return [
    "AUTHORITATIVE TRIP CALENDAR (never invent weekdays; prose for a date MUST use the weekday listed for that ISO date below; if unsure omit weekday wording):",
    ...lines,
  ].join("\n");
}
