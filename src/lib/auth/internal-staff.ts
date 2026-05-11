/**
 * Email allowlist for internal diagnostics (`/internal/*`).
 * Set `TRIPTILES_INTERNAL_EMAIL_ALLOWLIST` to comma-separated addresses (case-insensitive).
 */

export function parseInternalEmailAllowlist(): string[] {
  const raw = process.env.TRIPTILES_INTERNAL_EMAIL_ALLOWLIST?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isInternalStaffEmail(email: string | undefined | null): boolean {
  const list = parseInternalEmailAllowlist();
  if (list.length === 0) return false;
  if (!email?.trim()) return false;
  return list.includes(email.trim().toLowerCase());
}
