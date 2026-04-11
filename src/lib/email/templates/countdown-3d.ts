import { brandEmailShell, ctaButton } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function countdownEmailHtml(opts: {
  adventureName: string;
  destinationName: string;
  tripUrl: string;
  daysUntil: number;
}): { subject: string; html: string; text: string } {
  const subject = `Your adventure starts in ${opts.daysUntil} days`;
  const inner = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;">${escapeHtml(opts.adventureName)}</p>
    <p style="margin:0;">Your ${escapeHtml(opts.destinationName)} trip is almost here. Open TripTiles for your day-by-day plan and last-minute tweaks.</p>
    ${ctaButton(opts.tripUrl, "Open your plan")}
  `;
  const html = brandEmailShell(inner);
  const text = stripTags(
    `${subject}. ${opts.adventureName} — ${opts.destinationName}. ${opts.tripUrl}`,
  );
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
