import { brandEmailShell, ctaButton, GOLD, ROYAL } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Free-tier upgrade nudge — only rendered when the recipient is on the free plan. */
function upgradeBlock(pricingUrl: string): string {
  const bullets = [
    "Unlimited Smart Plans — re-plan as much as you like before you go",
    "Full AI day-by-day timelines with ride-by-ride order",
    "Clean, watermark-free PDFs to take into the park",
  ]
    .map(
      (b) =>
        `<li style="margin:0 0 6px;">${escapeHtml(b)}</li>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border:1px solid ${GOLD}55;border-radius:10px;background:#fffaf3;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:${ROYAL};">Travelling soon? Go Pro before you pack</p>
          <p style="margin:0 0 10px;font-size:14px;color:${ROYAL};">You’re on the free plan. Upgrade before your trip to unlock everything you’ll want on the day:</p>
          <ul style="margin:0;padding-left:18px;font-size:14px;color:${ROYAL};font-family:system-ui,sans-serif;">${bullets}</ul>
          ${ctaButton(pricingUrl, "See plans & upgrade")}
        </td>
      </tr>
    </table>
  `;
}

export function countdownEmailHtml(opts: {
  adventureName: string;
  destinationName: string;
  tripUrl: string;
  daysUntil: number;
  /** Pricing page URL — required to render the upgrade nudge. */
  pricingUrl?: string;
  /** When true (free tier), show the upgrade nudge. */
  showUpgrade?: boolean;
}): { subject: string; html: string; text: string } {
  const subject = `Your adventure starts in ${opts.daysUntil} days`;
  const showUpgrade = Boolean(opts.showUpgrade && opts.pricingUrl?.trim());
  const inner = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;">${escapeHtml(opts.adventureName)}</p>
    <p style="margin:0;">Your ${escapeHtml(opts.destinationName)} trip is almost here. Open TripTiles for your day-by-day plan and last-minute tweaks.</p>
    ${ctaButton(opts.tripUrl, "Open your plan")}
    ${showUpgrade ? upgradeBlock(opts.pricingUrl!.trim()) : ""}
  `;
  const html = brandEmailShell(inner);
  const textParts = [
    `${subject}.`,
    `${opts.adventureName} — ${opts.destinationName}.`,
    opts.tripUrl,
  ];
  if (showUpgrade) {
    textParts.push(
      `Travelling soon? Upgrade to Pro for unlimited Smart Plans, full AI day timelines, and clean PDFs: ${opts.pricingUrl!.trim()}`,
    );
  }
  const text = stripTags(textParts.join(" "));
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
