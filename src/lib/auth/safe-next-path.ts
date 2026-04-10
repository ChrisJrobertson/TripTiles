/**
 * Prevents open redirects: only same-origin paths starting with a single "/".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/planner";
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://"))
    return "/planner";
  return t;
}
