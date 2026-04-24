import { FROM_ADDRESS } from "../client";

export type TripReminderEmailInput = {
  adventureName: string;
  destinationName: string;
  tripUrl: string;
  daysBefore: number;
  subject: string;
  bulletLines: string[];
  siteUrl: string;
};

export function tripReminderEmailHtml(input: TripReminderEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const bullets = input.bulletLines
    .map((l) => `<li style="margin:0 0 8px 0;">${escapeHtml(l)}</li>`)
    .join("");
  const unsub = `${input.siteUrl}/settings#email-preferences`;
  const html = `<!DOCTYPE html><html><body style="font-family:Inter,Segoe UI,sans-serif;background:#fce7cc;color:#2455ac;padding:24px;">
  <p style="margin:0 0 12px;font-size:16px;">Hi there,</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your trip <strong>${escapeHtml(input.adventureName)}</strong> in <strong>${escapeHtml(input.destinationName)}</strong> is coming up — here are a few practical nudges.</p>
  <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.45;">${bullets}</ul>
  <p style="margin:0 0 20px;">
    <a href="${escapeHtml(input.tripUrl)}" style="display:inline-block;background:#2455ac;color:#fce7cc;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">View your trip plan →</a>
  </p>
  <p style="margin:24px 0 0;font-size:12px;color:#5c6b8a;line-height:1.5;">
    You’re receiving this because email reminders are turned on for this trip in TripTiles.<br/>
    <a href="${escapeHtml(unsub)}" style="color:#2455ac;">Manage email preferences or unsubscribe from marketing-style emails</a> in Settings.
  </p>
  <p style="margin:12px 0 0;font-size:11px;color:#8a96b0;">Sent by ${escapeHtml(FROM_ADDRESS)}</p>
</body></html>`;

  const textLines = [
    `Your trip "${input.adventureName}" (${input.destinationName}) — ${input.daysBefore} day(s) to go.`,
    "",
    ...input.bulletLines.map((l) => `• ${l}`),
    "",
    `Open your plan: ${input.tripUrl}`,
    "",
    `Email preferences: ${unsub}`,
  ].join("\n");

  return { subject: input.subject, html, text: textLines };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
