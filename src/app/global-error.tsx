"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Root error boundary for the App Router. Reports uncaught render errors to Sentry.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-GB">
      <body className="bg-transparent px-6 py-16 font-sans text-royal">
        <h1 className="font-serif text-xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-royal/80">
          Please refresh the page. If the problem continues, contact support.
        </p>
      </body>
    </html>
  );
}
