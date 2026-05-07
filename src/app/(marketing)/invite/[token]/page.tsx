import { InviteAcceptButton } from "@/components/marketing/InviteAcceptButton";
import { Card } from "@/components/ui/Card";
import { getInvitePreviewByToken } from "@/lib/db/invites-admin";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const preview = await getInvitePreviewByToken(token);
  if (!preview) {
    return (
      <div className="min-h-screen bg-transparent px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold text-tt-royal">
          This invite link is invalid or has expired
        </h1>
        <p className="mt-4 font-sans text-sm text-tt-ink-muted">
          Ask the organiser to send a fresh invite from TripTiles.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block font-sans text-sm font-semibold text-tt-gold underline underline-offset-2"
        >
          Back to TripTiles
        </Link>
      </div>
    );
  }

  if (preview.status === "revoked" || preview.status === "declined") {
    return (
      <div className="min-h-screen bg-transparent px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold text-tt-royal">
          This invite is no longer active
        </h1>
        <p className="mt-4 font-sans text-sm text-tt-ink-muted">
          Ask the organiser for a new invite if you still need access.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block font-sans text-sm font-semibold text-tt-gold underline underline-offset-2"
        >
          Back to TripTiles
        </Link>
      </div>
    );
  }

  const user = await getCurrentUser();
  const isAuthed = Boolean(user);

  return (
    <div className="min-h-screen bg-transparent px-4 py-16">
      <Card
        variant="elevated"
        className="mx-auto max-w-lg border border-tt-line/15 bg-tt-surface/92 p-8 text-center shadow-tt-md backdrop-blur-sm"
      >
        <p className="font-meta text-xs font-semibold uppercase tracking-wide text-tt-gold">
          TripTiles invite
        </p>
        <h1 className="mt-3 font-heading text-2xl font-semibold text-tt-royal">
          {preview.adventureName}
        </h1>
        <p className="mt-2 font-sans text-sm text-tt-ink-muted">
          {preview.familyName} · {preview.startDate} → {preview.endDate}
        </p>
        <p className="mt-6 font-sans text-sm leading-relaxed text-tt-royal">
          You&apos;ve been invited to collaborate on this trip. Accept to open it
          in your planner.
        </p>
        <div className="mt-8">
          <InviteAcceptButton token={token} isAuthed={isAuthed} />
        </div>
        {!isAuthed ? (
          <p className="mt-6 font-sans text-xs text-tt-ink-muted">
            You&apos;ll be asked to sign in or create a free account first.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
