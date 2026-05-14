import type { Park } from "@/lib/types";
import { isThemePark } from "@/lib/park-categories";

const EMOJI_CHAR_RE = /\p{Extended_Pictographic}/u;

function isIconUrl(raw: string): boolean {
  const t = raw.trim();
  return (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("/")
  );
}

function iconFromDbLooksRenderable(raw: string): boolean {
  const t = raw.trim();
  if (!t || isIconUrl(t)) return false;
  if (/NO\s*GLYPH|notdef|\.notdef/i.test(t)) return false;
  if (t.length <= 2 && /[\u4e00-\u9fff\u3040-\u30ff]/.test(t)) return false;
  return EMOJI_CHAR_RE.test(t);
}

function fallbackEmojiForPark(
  park: Pick<Park, "id" | "park_group">,
): string {
  const id = park.id.toLowerCase();
  if (id === "owl" || id === "specd") return "🍽";
  if (id === "tsr" || id === "char" || id === "villa") return "🥂";
  const byId: Record<string, string> = {
    rest: "😴",
    pool: "🏊",
    flyout: "✈️",
    flyhome: "🏠",
    embark: "🚢",
    disemb: "🚢",
    portmia: "🚢",
    portmiad: "🚢",
  };
  const mapped = byId[id];
  if (mapped) return mapped;
  if (park.park_group === "dining") return "🍽";
  if (park.park_group === "travel") return "✈️";
  if (park.park_group === "activities") return "⛱";
  if (isThemePark(park.park_group)) return "🎢";
  return "📍";
}

/**
 * Resolves the character or URL to show for a planner tile icon.
 * Prefer DB `icon` when it is a real emoji; otherwise fall back by tile id / group.
 */
export function pickPlannerTileDisplayIcon(
  park: Pick<Park, "id" | "icon" | "park_group">,
): string {
  const raw = park.icon?.trim() ?? "";
  if (isIconUrl(raw)) return raw.trim();
  if (iconFromDbLooksRenderable(raw)) return raw.trim();
  return fallbackEmojiForPark(park);
}

export type PlannerTileIconPark = Pick<Park, "id" | "icon" | "park_group">;

/**
 * Planner slot / palette icon: always use an emoji-capable font stack (see
 * `globals.css` `.tt-planner-tile-icon`) so Latin-subset Inter never draws
 * tofu, `.notdef`, or placeholder text for emoji tile icons.
 */
export function PlannerTileIcon({
  park,
  className = "",
  trailingSpace = true,
}: {
  park: PlannerTileIconPark;
  className?: string;
  trailingSpace?: boolean;
}) {
  const display = pickPlannerTileDisplayIcon(park);
  if (isIconUrl(display)) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={display}
          alt=""
          className={`inline-block h-[1.15em] w-[1.15em] shrink-0 object-contain align-[-0.12em] ${className}`.trim()}
        />
        {trailingSpace ? " " : null}
      </>
    );
  }
  return (
    <>
      <span
        className={`tt-planner-tile-icon inline-block align-[-0.08em] text-[1.1em] leading-none ${className}`.trim()}
        aria-hidden
      >
        {display}
      </span>
      {trailingSpace ? " " : null}
    </>
  );
}
