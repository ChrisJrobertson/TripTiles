import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Tailwind max-width class */
  maxWidthClass?: string;
};

/** Cream bubble, royal border, upward-pointing triangle toward Tripp above. */
export function TrippSpeechBubble({
  children,
  maxWidthClass = "max-w-md",
}: Props) {
  return (
    <div className={`relative mx-auto mt-4 w-full ${maxWidthClass}`}>
      <div
        className="pointer-events-none absolute left-1/2 -top-3 z-10 -translate-x-1/2"
        aria-hidden
      >
        <div className="h-0 w-0 border-x-[12px] border-x-transparent border-b-[12px] border-b-royal" />
        <div className="relative -mt-[11px] flex justify-center">
          <div className="h-0 w-0 border-x-[10px] border-x-transparent border-b-[10px] border-b-cream" />
        </div>
      </div>
      <div className="relative rounded-xl border-2 border-royal bg-cream px-4 py-3 text-center text-sm text-royal shadow-sm [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
        {children}
      </div>
    </div>
  );
}
