"use client";

import { useToast } from "@/lib/toast";

/** Renders toasts from {@link showToast} app-wide. Mount once in the root layout. */
export function ToastViewport() {
  const { toast } = useToast();
  if (!toast) return null;
  const bgClass =
    toast.type === "success"
      ? "bg-emerald-700"
      : toast.type === "error"
        ? "bg-red-700"
        : "bg-royal";
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[200] w-full max-w-[min(92vw,24rem)] -translate-x-1/2 px-4 sm:left-auto sm:right-6 sm:translate-x-0 sm:px-0"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto rounded-2xl px-4 py-2 text-center font-sans text-sm text-cream shadow-lg ${bgClass}`}
      >
        {toast.message}
      </div>
    </div>
  );
}
