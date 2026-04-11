export async function logClientError(
  error: Error,
  context?: Record<string, unknown>,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.error("[dev error]", error, context);
    return;
  }

  try {
    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        context,
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch {
    /* never throw from error logger */
  }
}
