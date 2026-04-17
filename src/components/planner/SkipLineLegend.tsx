"use client";

import { useId, useState } from "react";

export function SkipLineLegend() {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-royal/10 bg-white/80 px-3 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left font-sans text-xs font-semibold text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        aria-expanded={open}
        aria-controls={`${id}-legend`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Skip-the-line legend</span>
        <span className="text-royal/50" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <div
          id={`${id}-legend`}
          className="mt-2 space-y-3 border-t border-royal/10 pt-2 font-sans text-[11px] leading-relaxed text-royal/80"
        >
          <div>
            <p className="font-semibold text-royal">Disney parks</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>
                <span className="font-semibold">SP</span> — Lightning Lane
                Single Pass — premium per-ride purchase (often around $15–25).
              </li>
              <li>
                <span className="font-semibold">T1</span> — Multi Pass Tier 1
                — book one in advance, then more after your first scan.
              </li>
              <li>
                <span className="font-semibold">T2</span> — Multi Pass Tier 2
                — book up to three in advance.
              </li>
              <li>
                Disney hotel guests can often book seven days ahead; off-site
                guests typically three days ahead (confirm in the official app).
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-royal">Universal parks</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>
                <span className="font-semibold">EXP</span> — Express Pass —
                separate paid add-on; one use per ride or unlimited on some
                tickets.
              </li>
              <li>
                Included free with select on-site Universal hotel stays on
                eligible nights.
              </li>
              <li>
                Express Now is a pay-per-ride option bought in the park on some
                dates — check signage.
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
