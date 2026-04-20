"use client";

import { useEffect } from "react";

type Handlers = {
  onFocusSearch: () => void;
  onNewTrip: () => void;
  onPlanningTab: () => void;
  onCalendarTab: () => void;
  onToggleCheatSheet: () => void;
  onEscape: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  isCalendarFocused: () => boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable;
}

export function useKeyboardShortcuts(handlers: Handlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "/" && !event.shiftKey) {
        event.preventDefault();
        handlers.onFocusSearch();
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        handlers.onNewTrip();
        return;
      }
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        handlers.onPlanningTab();
        return;
      }
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        handlers.onCalendarTab();
        return;
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        handlers.onToggleCheatSheet();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handlers.onEscape();
        return;
      }
      if (event.key === "ArrowLeft" && handlers.isCalendarFocused()) {
        event.preventDefault();
        handlers.onPrevDay();
        return;
      }
      if (event.key === "ArrowRight" && handlers.isCalendarFocused()) {
        event.preventDefault();
        handlers.onNextDay();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handlers]);
}
