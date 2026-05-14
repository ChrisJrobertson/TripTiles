"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type CloseFn = () => void;

const DESKTOP_MENU_ID = "planner-actions-more-desktop-menu";
const DESKTOP_TRIGGER_ID = "planner-actions-more-desktop-trigger";

type Props = {
  onResetCruise: () => void;
  onClearAll: () => void;
  onPrint: () => void;
  /** Side-by-side day comparison (planner calendar tab). */
  onCompareDays?: () => void;
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
  onCompareDays,
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
        <div className="border-b border-tt-line pb-1">{adminSection(close)}</div>
      ) : null}
      {onCompareDays ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onCompareDays();
            close();
          }}
          className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
        >
          Compare days
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onResetCruise();
          close();
        }}
        className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
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
        className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
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
        className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal print:hidden transition hover:bg-tt-bg-soft"
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
          className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
        >
          Export to PDF
        </button>
      ) : null}
      {cruiseSection ? (
        <div className="border-t border-tt-line">{cruiseSection}</div>
      ) : null}
      {colourSection ? (
        <div className="border-t border-tt-line">{colourSection}</div>
      ) : null}
      {remindersSection ? (
        <div className="border-t border-tt-line">{remindersSection}</div>
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
  onCompareDays,
  onExportPdf,
  cruiseSection,
  colourSection,
  remindersSection,
  adminSection,
}: Props) {
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopMenuPanelRef = useRef<HTMLDivElement>(null);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [desktopMenuPos, setDesktopMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);

  const updateDesktopMenuPosition = useCallback(() => {
    const el = desktopTriggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDesktopMenuPos({ top: r.bottom + 4, left: r.left });
  }, []);

  useLayoutEffect(() => {
    if (!desktopMenuOpen) {
      setDesktopMenuPos(null);
      return;
    }
    updateDesktopMenuPosition();
  }, [desktopMenuOpen, updateDesktopMenuPosition]);

  useEffect(() => {
    if (!desktopMenuOpen) return;

    const onPointerDownCapture = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (
        desktopTriggerRef.current?.contains(t) ||
        desktopMenuPanelRef.current?.contains(t)
      ) {
        return;
      }
      setDesktopMenuOpen(false);
    };

    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDesktopMenuOpen(false);
      }
    };

    const onScrollOrResize = () => {
      updateDesktopMenuPosition();
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    document.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      document.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [desktopMenuOpen, updateDesktopMenuPosition]);

  function closeDesktopMenu() {
    setDesktopMenuOpen(false);
  }

  const closeSheet = () => setSheetOpen(false);

  const menuProps: Props = {
    onResetCruise,
    onClearAll,
    onPrint,
    onCompareDays,
    onExportPdf,
    cruiseSection,
    colourSection,
    remindersSection,
    adminSection,
  };

  const desktopPortal =
    desktopMenuOpen &&
    desktopMenuPos &&
    typeof document !== "undefined" ? (
      createPortal(
        <div
          ref={desktopMenuPanelRef}
          id={DESKTOP_MENU_ID}
          role="menu"
          aria-labelledby={DESKTOP_TRIGGER_ID}
          className="fixed z-[88] min-w-[12rem] max-h-[min(70vh,32rem)] overflow-y-auto rounded-tt-lg border border-tt-line bg-tt-surface py-1 shadow-tt-lg"
          style={{
            top: desktopMenuPos.top,
            left: desktopMenuPos.left,
          }}
        >
          <MenuBlock {...menuProps} close={closeDesktopMenu} />
        </div>,
        document.body,
      )
    ) : null;

  return (
    <>
      <div className="relative hidden md:block">
        <button
          ref={desktopTriggerRef}
          type="button"
          id={DESKTOP_TRIGGER_ID}
          aria-expanded={desktopMenuOpen}
          aria-haspopup="menu"
          aria-controls={desktopMenuOpen ? DESKTOP_MENU_ID : undefined}
          className="flex cursor-pointer items-center gap-1.5 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-sm font-medium text-tt-royal shadow-tt-sm transition hover:bg-tt-bg-soft"
          onClick={() => setDesktopMenuOpen((o) => !o)}
        >
          More
          <span
            className={`text-tt-royal/40 transition ${desktopMenuOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▾
          </span>
        </button>
      </div>
      {desktopPortal}

      <button
        type="button"
        className="md:hidden rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-sm font-medium text-tt-royal shadow-tt-sm transition hover:bg-tt-bg-soft"
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
          className={`absolute inset-0 bg-tt-royal/50 transition-opacity duration-200 ${
            sheetOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeSheet}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More trip actions"
          className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-tt-xl border border-tt-line bg-tt-bg px-2 py-3 shadow-tt-lg transition-transform duration-200 ease-out safe-area-inset-bottom ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mb-2 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-tt-line" aria-hidden />
          </div>
          <p className="mb-2 px-2 font-heading text-lg font-semibold text-tt-royal">
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
