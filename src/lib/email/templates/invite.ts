import { brandEmailShell, ctaButton } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function inviteEmailHtml(opts: {
  inviterDisplayName: string;
  adventureName: string;
  inviteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "You’re invited to plan a trip on TripTiles";
  const inner = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;">Join ${escapeHtml(opts.inviterDisplayName)} on TripTiles</p>
    <p style="margin:0;">You’ve been invited to collaborate on <strong>${escapeHtml(opts.adventureName)}</strong>. Accept the invite to view and edit the plan together.</p>
    ${ctaButton(opts.inviteUrl, "Accept invite")}
  `;
  const html = brandEmailShell(inner);
  const text = stripTags(
    `${subject}. ${opts.inviterDisplayName} invited you to ${opts.adventureName}. ${opts.inviteUrl}`,
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
