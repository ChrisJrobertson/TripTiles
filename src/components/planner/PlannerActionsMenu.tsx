"use client";

import { useRef } from "react";

type Props = {
  onResetCruise: () => void;
  onClearAll: () => void;
  onPrint: () => void;
  onExportPdf?: () => void;
};

/**
 * Secondary trip actions — keeps the main toolbar to two primary buttons.
 */
export function PlannerActionsMenu({
  onResetCruise,
  onClearAll,
  onPrint,
  onExportPdf,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm font-medium text-royal/85 shadow-sm transition hover:border-royal/35 hover:bg-cream [&::-webkit-details-marker]:hidden">
        More
        <span className="text-royal/40 transition group-open:rotate-180">▾</span>
      </summary>
      <div
        className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] rounded-xl border border-royal/10 bg-white py-1 shadow-lg"
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onResetCruise();
            closeMenu();
          }}
          className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
        >
          Reset cruise
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClearAll();
            closeMenu();
          }}
          className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
        >
          Clear all tiles
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onPrint();
            closeMenu();
          }}
          className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal print:hidden transition hover:bg-cream"
        >
          Print calendar
        </button>
        {onExportPdf ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExportPdf();
              closeMenu();
            }}
            className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
          >
            Export to PDF
          </button>
        ) : null}
      </div>
    </details>
  );
}
