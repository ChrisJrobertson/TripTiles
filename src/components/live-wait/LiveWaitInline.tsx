"use client";

import { formatLiveWaitForUi } from "@/lib/live-wait/display-format";
import type { LiveWaitPublicItem } from "@/lib/live-wait/public-types";

type Props = {
  row: LiveWaitPublicItem;
  compact?: boolean;
};

/**
 * Single-line advisory live wait for a mapped attraction (hide when no row).
 */
export function LiveWaitInline({ row, compact = false }: Props) {
  const parts = formatLiveWaitForUi(row);
  const textCls = compact
    ? "font-sans text-[10px] leading-snug text-royal/65"
    : "font-sans text-[11px] leading-snug text-royal/70";

  return (
    <span className="block max-w-full">
      <span className={textCls}>
        <span className="font-medium text-royal/80">Live (advisory): </span>
        {parts.statusLine}
        <span className="text-royal/55"> · {parts.freshnessLine}</span>
        {parts.stale ? (
          <span className="text-royal/55"> · treat as uncertain</span>
        ) : null}
      </span>
    </span>
  );
}
