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
        <h1 className="font-serif text-3xl font-semibold text-royal md:text-4xl">
          Feedback
        </h1>
        <p className="mt-4 font-sans text-base leading-relaxed text-royal/75">
          Tell us what broke, what confused you, or what would make TripTiles
          magical for your next trip. We read everything.
        </p>

        {!configured ? (
          <p
            className="mt-6 rounded-xl border border-royal/15 bg-white px-4 py-3 font-sans text-sm text-royal/80"
            role="status"
          >
            <strong className="font-semibold text-royal">Host:</strong> set{" "}
            <code className="rounded bg-cream px-1 text-xs">
              NEXT_PUBLIC_FEEDBACK_EMAIL
            </code>{" "}
            in <code className="rounded bg-cream px-1 text-xs">.env.local</code>{" "}
            to your real inbox. Until then, the button uses a placeholder address
            — replace it before sharing widely.
          </p>
        ) : null}

        <a
          href={mailto}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-royal px-8 py-3 font-serif text-base font-semibold text-cream shadow-md transition hover:bg-royal/90"
        >
          Email us
        </a>

        <p className="mt-6 font-sans text-sm text-royal/55">
          <Link href="/" className="text-royal underline underline-offset-2">
            ← Home
          </Link>
        </p>
    </main>
  );
}
