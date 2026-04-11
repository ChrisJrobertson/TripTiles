"use client";

import { logClientError } from "@/lib/telemetry/log-error";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void logClientError(error, { boundary: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FAF8F3", color: "#0B1E5C" }}>
        <div style={{ padding: 40, maxWidth: 520, fontFamily: "Georgia, serif" }}>
          <h1 style={{ fontSize: "1.75rem" }}>Something went wrong</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
            We&apos;ve logged this and will look into it. You can try again or
            head home.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "#C9A961",
                color: "#0B1E5C",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 8,
                border: "2px solid #0B1E5C",
                color: "#0B1E5C",
                textDecoration: "none",
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
              }}
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
