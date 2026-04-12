/** First name + last initial for public gallery cards. */
export function formatGalleryOwnerLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const raw = (displayName ?? "").trim();
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    const first = parts[0]!;
    if (parts.length === 1) return first;
    const last = parts[parts.length - 1]!;
    const initial = last[0]?.toUpperCase() ?? "";
    return initial ? `${first} ${initial}.` : first;
  }
  const local = (email ?? "").split("@")[0]?.trim();
  if (!local) return null;
  return local.length > 12 ? `${local.slice(0, 11)}…` : local;
}
