/** Strip secrets from provider errors before they reach logs or fetch-log rows. */
export function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/x-api-key\s*[:=]\s*\S+/gi, "x-api-key=[redacted]")
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/(api[_-]?key|token|secret|authorization)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

export function logParkDataEvent(event: string, fields: Record<string, unknown>): void {
  const payload: Record<string, unknown> = { source: "triptiles.park_data", event };
  for (const [key, value] of Object.entries(fields)) {
    if (/secret|token|authorization|api[_-]?key|service_role/i.test(key)) continue;
    payload[key] = value;
  }
  console.info(JSON.stringify(payload));
}
