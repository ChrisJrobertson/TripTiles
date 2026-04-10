"use client";

/**
 * Privacy-light product analytics (event name only, no PII).
 * Server logs or no-ops if analytics is disabled.
 */
export function trackEvent(
  event: string,
  meta?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  const name = event.replace(/[^a-z0-9._-]/gi, "").slice(0, 64);
  if (!name) return;
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: name, meta: meta ?? {} }),
    keepalive: true,
  }).catch(() => {});
}
