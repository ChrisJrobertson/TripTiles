"use client";

import { useRef, useState, type ReactNode } from "react";

type CloseFn = () => void;

type Props = {
  onResetCruise: () => void;
  onClearAll: () => void;
  onPrint: () => void;
  onExportPdf?: () => void;
  /** Optional cruise toggle shown below standard actions. */
  cruiseSection?: ReactNode;
  /** Optional block (e.g. colour theme picker) shown below standard actions. */
  colourSection?: ReactNode;
  /** Optional block (e.g. per-trip email reminders toggle). */
  remindersSection?: ReactNode;
  /** Community / family / bulk day notes — shown at top of More menu. */
  adminSection?: (close: CloseFn) => ReactNode;
};

function MenuBlock({
  onResetCruise,
  onClearAll,
  onPrint,
  onExportPdf,
  cruiseSection,
  colourSection,
  remindersSection,
  adminSection,
  close,
}: Props & { close: () => void }) {
  return (
    <>
      {adminSection ? (
        <div className="border-b border-royal/10 pb-1">{adminSection(close)}</div>
      ) : null}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onResetCruise();
          close();
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
          close();
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
          close();
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
            close();
          }}
          className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
        >
          Export to PDF
        </button>
      ) : null}
      {cruiseSection ? (
        <div className="border-t border-royal/10">{cruiseSection}</div>
      ) : null}
      {colourSection ? (
        <div className="border-t border-royal/10">{colourSection}</div>
      ) : null}
      {remindersSection ? (
        <div className="border-t border-royal/10">{remindersSection}</div>
      ) : null}
    </>
  );
}

/**
 * Secondary trip actions — desktop dropdown; mobile bottom sheet.
 */
export function PlannerActionsMenu({
  onResetCruise,
  onClearAll,
  onPrint,
  onExportPdf,
  cruiseSection,
  colourSection,
  remindersSection,
  adminSection,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function closeMenu() {
    detailsRef.current?.removeAttribute("open");
  }

  const closeSheet = () => setSheetOpen(false);

  const menuProps: Props = {
    onResetCruise,
    onClearAll,
    onPrint,
    onExportPdf,
    cruiseSection,
    colourSection,
    remindersSection,
    adminSection,
  };

  return (
    <>
      <details ref={detailsRef} className="group relative hidden md:block">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm font-medium text-royal/85 shadow-sm transition hover:border-royal/35 hover:bg-cream [&::-webkit-details-marker]:hidden">
          More
          <span className="text-royal/40 transition group-open:rotate-180">▾</span>
        </summary>
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-royal/10 bg-white py-1 shadow-lg"
          role="menu"
        >
          <MenuBlock {...menuProps} close={closeMenu} />
        </div>
      </details>

      <button
        type="button"
        className="md:hidden rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm font-medium text-royal/85 shadow-sm transition hover:border-royal/35 hover:bg-cream"
        onClick={() => setSheetOpen(true)}
      >
        More ▾
      </button>

      <div
        className={`fixed inset-0 z-[88] md:hidden ${sheetOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!sheetOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          className={`absolute inset-0 bg-royal/50 transition-opacity duration-200 ${
            sheetOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeSheet}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More trip actions"
          className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-gold/20 bg-cream px-2 py-3 shadow-2xl transition-transform duration-200 ease-out safe-area-inset-bottom ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mb-2 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-royal/20" aria-hidden />
          </div>
          <p className="mb-2 px-2 font-serif text-lg font-semibold text-royal">
            More
          </p>
          <div className="max-h-[70vh] overflow-y-auto pb-4">
            <MenuBlock {...menuProps} close={closeSheet} />
          </div>
        </div>
      </div>
    </>
  );
}
