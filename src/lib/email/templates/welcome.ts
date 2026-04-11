import { brandEmailShell, ctaButton } from "./html-shell";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function welcomeEmailHtml(opts: {
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Welcome to TripTiles";
  const inner = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;">Your holiday, beautifully planned</p>
    <p style="margin:0;">Thanks for joining TripTiles. Drag parks onto your calendar, try Smart Plan, and export a polished PDF when you’re ready.</p>
    ${ctaButton(`${opts.siteUrl.replace(/\/$/, "")}/planner`, "Start planning")}
  `;
  const html = brandEmailShell(inner);
  const text = stripTags(`${subject} ${opts.siteUrl}/planner`);
  return { subject, html, text };
}
