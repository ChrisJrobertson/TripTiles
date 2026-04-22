"use client";

import {
  isStaleServerActionError,
  notifyStaleServerActionIfNeeded,
} from "@/lib/toast";
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const staleAction = isStaleServerActionError(error);

  useEffect(() => {
    console.error("[TripTiles]", error);
    notifyStaleServerActionIfNeeded(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-transparent px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-royal/15 bg-white p-8 text-center shadow-lg shadow-royal/5">
        <h1 className="font-serif text-2xl font-semibold text-royal">
          Something went wrong
        </h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
          {staleAction ? (
            <>
              This page is out of date compared to the server — usually after
              we ship an update.{" "}
              <strong className="font-semibold text-royal">
                Refresh the page
              </strong>{" "}
              and try again; your trip data is still saved.
            </>
          ) : (
            <>
              Your work is usually saved automatically. Try again — if this
              keeps happening, use Feedback from the menu and we&apos;ll dig in.
            </>
          )}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-royal px-5 py-2.5 font-sans text-sm font-semibold text-cream"
          >
            Try again
          </button>
          <Link
            href="/planner"
            className="rounded-lg border border-royal/25 bg-white px-5 py-2.5 font-sans text-sm font-medium text-royal"
          >
            Back to planner
          </Link>
        </div>
      </div>
    </main>
  );
}
