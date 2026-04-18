"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type Panel = "share" | "family" | "notes" | null;

type Props = {
  onOpenPanel: (panel: Exclude<Panel, null>) => void;
  disabled?: boolean;
};

/**
 * Top-right "More" menu — trip admin panels (share, family, day notes).
 */
export function PlannerMoreMenu({ onOpenPanel, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      setOpen(false);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (disabled) return null;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-royal/15 bg-cream px-3 font-serif text-sm font-semibold text-[#0B1E5C] shadow-sm transition hover:bg-white"
        onClick={() => setOpen((v) => !v)}
      >
        More <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Trip options"
          className="absolute right-0 z-40 mt-1 min-w-[12rem] rounded-xl border border-royal/15 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
            onClick={() => {
              onOpenPanel("share");
              close();
            }}
          >
            Share trip
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
            onClick={() => {
              onOpenPanel("family");
              close();
            }}
          >
            Family members
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left font-sans text-sm text-royal transition hover:bg-cream"
            onClick={() => {
              onOpenPanel("notes");
              close();
            }}
          >
            Day notes (all days)
          </button>
        </div>
      ) : null}
    </div>
  );
}
