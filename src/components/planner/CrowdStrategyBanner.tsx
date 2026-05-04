"use client";

import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { truncateForPreview } from "@/lib/truncate-text";
import { useCallback, useId, useState } from "react";
import { CrowdLevelIndicator } from "./CrowdLevelIndicator";

const PREVIEW_LEN = 80;

type Props = {
  text: string;
};

export function CrowdStrategyBanner({ text }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const cleaned = sanitizeDayNote(text.trim());
  const preview = truncateForPreview(cleaned, PREVIEW_LEN);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const isLong = cleaned.length > PREVIEW_LEN;

  return (
    <div className="mt-3 max-md:mt-3 rounded-xl border border-gold/40 bg-white px-3 py-1.5 shadow-sm max-md:text-xs md:mt-5 md:py-2">
      <div className="flex flex-col gap-1 font-sans text-sm leading-snug text-royal/90 max-md:gap-0.5 md:flex-row md:flex-nowrap md:items-center md:gap-2">
        <span
          className="shrink-0 font-semibold text-royal"
          id={`${id}-label`}
        >
          📈 Crowd strategy
        </span>
        {isLong ? (
          <>
            <span className="min-w-0 flex-1 text-royal/85">
              {preview}
            </span>
            <button
              type="button"
              onClick={toggle}
              className="shrink-0 self-start rounded font-semibold text-royal underline decoration-gold/60 underline-offset-2 transition hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 md:self-auto"
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

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gold/20 pt-2 font-sans text-xs text-royal/70">
        <span className="font-semibold uppercase tracking-wider text-gold/80">
          Legend:
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CrowdLevelIndicator level="quiet" size="sm" />
          <span>Quiet</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CrowdLevelIndicator level="moderate" size="sm" />
          <span>Moderate</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CrowdLevelIndicator level="busy" size="sm" />
          <span>Busy</span>
        </span>
        <span className="inline-flex items-center gap-1.5 max-md:basis-full max-md:ms-0 md:ms-auto">
          <span aria-hidden="true">💡</span>
          <span>Day note — tap to read</span>
        </span>
      </div>

      {isLong ? (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-label`}
          aria-hidden={!open}
          className={`overflow-hidden border-t border-royal/10 transition-[max-height,opacity,margin,padding] duration-300 ease-out ${
            open
              ? "max-h-[min(80vh,2000px)] opacity-100"
              : "max-h-0 border-transparent opacity-0"
          }`}
        >
          <div className="pt-3 font-sans text-sm leading-relaxed text-royal/90">
            {cleaned}
          </div>
        </div>
      ) : null}
    </div>
  );
}
