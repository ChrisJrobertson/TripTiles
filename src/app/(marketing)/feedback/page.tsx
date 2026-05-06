import { FeedbackEmailActions } from "@/components/marketing/FeedbackEmailActions";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback · TripTiles",
  description: "Send feedback about TripTiles — we read every message.",
};

export default function FeedbackPage() {
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

      <FeedbackEmailActions />
    </main>
  );
}
