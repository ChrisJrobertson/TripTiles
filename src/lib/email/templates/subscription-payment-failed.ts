import { brandEmailShell, ctaButton } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function subscriptionPaymentFailedEmailHtml(opts: {
  siteUrl: string;
  firstName: string;
  settingsUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "We couldn't process your TripTiles payment";
  const name = opts.firstName.trim() || "there";
  const inner = `
    <p style="margin:0 0 12px;font-size:17px;">Hi ${name},</p>
    <p style="margin:0 0 12px;">Your most recent TripTiles payment didn&apos;t go through. Stripe will retry automatically over the next week. If you want to update your card, use the button below. No action is needed if you&apos;d rather let the retry happen.</p>
    ${ctaButton(opts.settingsUrl, "Manage billing")}
    <p style="margin:16px 0 0;font-size:13px;color:#0B1E5C99;font-family:system-ui,sans-serif;">In TripTiles, open Settings → Billing, then choose Manage billing to reach the Stripe Customer Portal.</p>
  `;
  const html = brandEmailShell(inner);
  const text = stripTags(
    `${subject} Hi ${name}, your most recent TripTiles payment did not go through. Stripe will retry automatically over the next week. Manage billing: ${opts.settingsUrl}`,
  );
  return { subject, html, text };
}
