import { brandEmailShell, ctaButton } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function shareNotificationEmailHtml(opts: {
  adventureName: string;
  planUrl: string;
  cloneCount: number;
}): { subject: string; html: string; text: string } {
  const subject = "Someone cloned your public TripTiles plan";
  const inner = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;">Great news</p>
    <p style="margin:0;">Your public plan <strong>${escapeHtml(opts.adventureName)}</strong> was just cloned. You now have <strong>${opts.cloneCount}</strong> total clones.</p>
    ${ctaButton(opts.planUrl, "View your plan")}
  `;
  const html = brandEmailShell(inner);
  const text = stripTags(`${subject} ${opts.adventureName} ${opts.planUrl}`);
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
