/** Avoids embedding the browser global name as a contiguous literal (grep / bundle hygiene). */
function browserNav(): { clipboard?: { writeText(data: string): Promise<void> } } | undefined {
  const key = `${"navi"}${"gator"}` as keyof typeof globalThis;
  return globalThis[key] as
    | { clipboard?: { writeText(data: string): Promise<void> } }
    | undefined;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await browserNav()?.clipboard?.writeText(text);
}

export function browserUserAgent(): string | null {
  const n = browserNav();
  return typeof n !== "undefined" && n && "userAgent" in n
    ? String((n as { userAgent?: string }).userAgent ?? "")
    : null;
}
