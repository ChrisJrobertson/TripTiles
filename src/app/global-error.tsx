"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TripTiles global]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#faf8f3] text-[#0b1e5c] antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-2xl border border-[#0b1e5c]/15 bg-white p-8 text-center shadow-lg">
            <h1 className="text-2xl font-semibold">TripTiles hit a snag</h1>
            <p className="mt-3 text-sm leading-relaxed opacity-80">
              Please refresh the page. If the problem continues, contact support
              or try again in a moment.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-8 rounded-lg bg-[#0b1e5c] px-5 py-2.5 text-sm font-semibold text-[#faf8f3]"
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
