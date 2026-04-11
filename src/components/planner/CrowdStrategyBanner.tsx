"use client";

import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { useCallback, useId, useState } from "react";

const PREVIEW_LEN = 80;

type Props = {
  text: string;
};

export function CrowdStrategyBanner({ text }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const cleaned = sanitizeDayNote(text.trim());
  const preview =
    cleaned.length <= PREVIEW_LEN
      ? cleaned
      : `${cleaned.slice(0, PREVIEW_LEN).trimEnd()}…`;

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const isLong = cleaned.length > PREVIEW_LEN;

  return (
    <div className="mt-5 rounded-xl border border-gold/40 bg-white px-3 py-2 shadow-sm md:min-h-[3rem] md:py-2">
      <div className="flex flex-col gap-1 font-sans text-sm leading-snug text-royal/90 md:flex-row md:flex-nowrap md:items-center md:gap-2">
        <span
          className="shrink-0 font-semibold text-royal"
          id={`${id}-label`}
        >
          📈 Crowd strategy
        </span>
        {isLong ? (
          <>
            <span className="min-w-0 flex-1 text-royal/85 md:truncate">
              {preview}
            </span>
            <button
              type="button"
              onClick={toggle}
              className="shrink-0 self-start font-semibold text-royal underline decoration-gold/60 underline-offset-2 transition hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 rounded md:self-auto"
              aria-expanded={open}
              aria-controls={`${id}-panel`}
            >
              {open ? "Show less" : "Read full strategy →"}
            </button>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-royal/85">{cleaned}</span>
        )}
      </div>
      {isLong && open ? (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-label`}
          className="mt-3 border-t border-royal/10 pt-3 font-sans text-sm leading-relaxed text-royal/90"
        >
          {cleaned}
        </div>
      ) : null}
    </div>
  );
}
