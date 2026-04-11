import { brandEmailShell, ctaButton } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function followupEmailHtml(opts: {
  adventureName: string;
  destinationName: string;
  tripUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "How was your trip?";
  const inner = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;">We hope ${escapeHtml(opts.adventureName)} was magical</p>
    <p style="margin:0;">If you planned ${escapeHtml(opts.destinationName)} on TripTiles, we’d love you to open the app, polish your next trip, or share your plan with friends.</p>
    ${ctaButton(opts.tripUrl, "Back to TripTiles")}
  `;
  const html = brandEmailShell(inner);
  const text = stripTags(`${subject} ${opts.adventureName} ${opts.tripUrl}`);
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
