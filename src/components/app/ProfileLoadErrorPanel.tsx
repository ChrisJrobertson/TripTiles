import Link from "next/link";

import { Card } from "@/components/ui/Card";

type Props = {
  title?: string;
  detail: string;
};

/** Full-page message when `profiles` could not be loaded (avoids a silent Free tier). */
export function ProfileLoadErrorPanel({
  title = "Could not load your account",
  detail,
}: Props) {
  return (
    <main className="min-h-screen bg-transparent px-6 py-12">
      <Card className="mx-auto max-w-lg p-8">
        <h1 className="font-heading text-xl font-semibold text-tt-royal">{title}</h1>
        <p className="mt-3 font-sans text-sm text-tt-royal/70">{detail}</p>
        <p className="mt-6 font-sans text-sm text-tt-royal/70">
          Try refreshing the page. If this keeps happening, sign out and sign in
          again, or contact support.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/planner"
            className="inline-flex items-center justify-center rounded-tt-md bg-tt-gold px-5 py-2.5 font-sans text-sm font-semibold text-white shadow-tt-sm transition hover:bg-tt-gold/90"
          >
            Back to planner
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-tt-md border border-tt-line bg-tt-surface px-5 py-2.5 font-sans text-sm font-semibold text-tt-royal shadow-tt-sm transition hover:bg-tt-royal-soft"
          >
            Sign in again
          </Link>
        </div>
      </Card>
    </main>
  );
}
