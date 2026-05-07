import { getPublicSiteUrl } from "@/lib/site";

const ROYAL = "#2455ac";
const GOLD = "#dd4e14";
const CREAM = "#fce7cc";

/** Absolute PNG URL for the compact programmatic lockup (hosted under `/public/email`). */
export function emailLogoCompactAbsoluteUrl(): string {
  const base = getPublicSiteUrl() || "https://www.triptiles.app";
  return `${base.replace(/\/$/, "")}/email/logo-compact.png`;
}

export function brandEmailShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREAM};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid ${ROYAL}22;overflow:hidden;">
          <tr>
            <td style="padding:18px 24px;background:${ROYAL};">
              <img src="${emailLogoCompactAbsoluteUrl()}" width="168" alt="TripTiles" style="display:block;border:0;height:auto;outline:none;text-decoration:none;margin:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;color:${ROYAL};font-size:15px;line-height:1.55;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;font-size:12px;color:${ROYAL}99;font-family:system-ui,sans-serif;">
              You’re receiving this because you use TripTiles or were invited by a member.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:18px;padding:12px 22px;background:${GOLD};color:${ROYAL};font-weight:700;border-radius:8px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;">${label}</a>`;
}

export { ROYAL, GOLD, CREAM };
