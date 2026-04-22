"use client";

type Props = {
  tripTitle: string;
  onOpenParks: () => void;
  onOpenMenu: () => void;
};

export function MobileBottomBar({
  tripTitle,
  onOpenParks,
  onOpenMenu,
}: Props) {
  return (
    <div
      className="safe-area-inset-bottom fixed bottom-0 inset-x-0 z-20 flex items-center justify-between border-t border-gold/35 bg-white/85 px-4 py-3 backdrop-blur-xl md:hidden"
      role="toolbar"
      aria-label="Planner tools"
    >
      <button
        type="button"
        onClick={onOpenParks}
        className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg px-2 py-2 font-sans text-sm font-medium text-royal transition active:bg-royal/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <span className="text-lg" aria-hidden>
          🎢
        </span>
        <span>Parks</span>
      </button>

      <div className="min-w-0 max-w-[40%] truncate px-2 text-center font-sans text-xs text-royal/60">
        {tripTitle}
      </div>

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-royal transition active:bg-royal/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        aria-label="Open menu"
      >
        ☰
      </button>
    </div>
  );
}
