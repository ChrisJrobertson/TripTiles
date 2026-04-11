import { FROM_ADDRESS, REPLY_TO_HELLO, getResend } from "./client";
import { countdownEmailHtml } from "./templates/countdown-3d";
import { followupEmailHtml } from "./templates/followup-1d";
import { inviteEmailHtml } from "./templates/invite";
import { shareNotificationEmailHtml } from "./templates/share-notification";
import { welcomeEmailHtml } from "./templates/welcome";

export type EmailTemplate =
  | "countdown_3d"
  | "followup_1d"
  | "invite"
  | "welcome"
  | "share_notification"
  | "year_review";

function renderTemplate(
  template: EmailTemplate,
  data: Record<string, unknown>,
): { subject: string; html: string; text: string } {
  switch (template) {
    case "countdown_3d":
      return countdownEmailHtml({
        adventureName: String(data.adventureName ?? "Your trip"),
        destinationName: String(data.destinationName ?? "your destination"),
        tripUrl: String(data.tripUrl ?? ""),
        daysUntil: Number(data.daysUntil ?? 3),
      });
    case "followup_1d":
      return followupEmailHtml({
        adventureName: String(data.adventureName ?? "Your trip"),
        destinationName: String(data.destinationName ?? "your destination"),
        tripUrl: String(data.tripUrl ?? ""),
      });
    case "invite":
      return inviteEmailHtml({
        inviterDisplayName: String(data.inviterDisplayName ?? "A TripTiles member"),
        adventureName: String(data.adventureName ?? "A trip"),
        inviteUrl: String(data.inviteUrl ?? ""),
      });
    case "welcome":
      return welcomeEmailHtml({
        siteUrl: String(data.siteUrl ?? "https://www.triptiles.app"),
      });
    case "share_notification":
      return shareNotificationEmailHtml({
        adventureName: String(data.adventureName ?? "Your plan"),
        planUrl: String(data.planUrl ?? ""),
        cloneCount: Number(data.cloneCount ?? 0),
      });
    case "year_review":
      return {
        subject: "Your TripTiles year in review",
        html: `<p>Year in review is coming soon.</p>`,
        text: "Year in review is coming soon.",
      };
  }
}

export async function sendTemplatedEmail(input: {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  try {
    const rendered = renderTemplate(input.template, input.data);
    const result = await getResend().emails.send({
      from: FROM_ADDRESS,
      replyTo: REPLY_TO_HELLO,
      to: [input.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id ?? "unknown" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
