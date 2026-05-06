import { marketingLinkAccentLg, marketingLinkUnderline } from "@/components/marketing/marketing-classes";
import { Card } from "@/components/ui/Card";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Feedback · TripTiles",
  description: "Send feedback about TripTiles — we read every message.",
};

function feedbackMailto(): string {
  const email =
    process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || "feedback@example.com";
  const origin = getPublicSiteUrl() || "TripTiles";
  const subject = encodeURIComponent("TripTiles feedback");
  const body = encodeURIComponent(
    `\n\n---\nContext: signed-in user\nApp: ${origin}\n`,
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export default function FeedbackPage() {
  const mailto = feedbackMailto();
  const configured = Boolean(
    process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim(),
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-14">
      <h1 className="font-heading text-3xl font-semibold text-tt-royal md:text-4xl">
        Feedback
      </h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-tt-royal/75">
        Tell us what broke, what confused you, or what would make TripTiles
        magical for your next trip. We read everything.
      </p>

      {!configured ? (
        <Card variant="subtle" className="mt-6 p-4" role="status">
          <p className="font-sans text-sm text-tt-royal/80">
            <strong className="font-semibold text-tt-royal">Host:</strong> set{" "}
            <code className="rounded-tt-md bg-tt-surface-warm px-1 font-meta text-xs">
              NEXT_PUBLIC_FEEDBACK_EMAIL
            </code>{" "}
            in{" "}
            <code className="rounded-tt-md bg-tt-surface-warm px-1 font-meta text-xs">
              .env.local
            </code>{" "}
            to your real inbox. Until then, the button uses a placeholder address
            — replace it before sharing widely.
          </p>
        </Card>
      ) : null}

      <a href={mailto} className={`mt-8 ${marketingLinkAccentLg}`}>
        Email us
      </a>

      <p className="mt-6 font-sans text-sm text-tt-royal/55">
        <Link href="/" className={marketingLinkUnderline}>
          ← Home
        </Link>
      </p>
    </main>
  );
}
