import { FeedbackEmailActions } from "@/components/marketing/FeedbackEmailActions";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback · TripTiles",
  description: "Send feedback about TripTiles — we read every message.",
};

export default function FeedbackPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-14">
      <Card variant="elevated" className="border border-tt-line/15 p-6 shadow-tt-md md:p-8">
        <SectionHeader
          title="We’d love to hear from you"
          subtitle={
            <>
              Tell us what felt magical, what broke, or what would make planning
              easier. Honest notes help us polish TripTiles — we read everything.
            </>
          }
        />
        <FeedbackEmailActions />
      </Card>
    </main>
  );
}
