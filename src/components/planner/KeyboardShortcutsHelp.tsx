"use client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const SHORTCUTS = [
  { key: "/", action: "Focus parks search" },
  { key: "n", action: "Open create trip modal" },
  { key: "p", action: "Jump to Organise tab" },
  { key: "c", action: "Jump to Calendar tab" },
  { key: "?", action: "Show this shortcuts panel" },
  { key: "esc", action: "Close open modal/sheet" },
  { key: "← / →", action: "Move between days (calendar focus)" },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-royal/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-royal/15 bg-cream p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <h2
            id="keyboard-shortcuts-title"
            className="font-serif text-lg font-semibold text-royal"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-royal/20 bg-white text-royal"
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-royal/10 bg-white px-3 py-2"
            >
              <span className="font-mono text-xs font-semibold text-royal">
                {shortcut.key}
              </span>
              <span className="text-right font-sans text-sm text-royal/80">
                {shortcut.action}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
