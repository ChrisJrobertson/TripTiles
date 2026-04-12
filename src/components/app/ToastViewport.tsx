"use client";

import { useToast } from "@/lib/toast";

/** Renders toasts from {@link showToast} app-wide. Mount once in the root layout. */
export function ToastViewport() {
  const { message } = useToast();
  if (!message) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[200] max-w-[min(90vw,22rem)] -translate-x-1/2 px-4"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-full bg-royal px-4 py-2 text-center font-sans text-sm text-cream shadow-lg">
        {message}
      </div>
    </div>
  );
}
