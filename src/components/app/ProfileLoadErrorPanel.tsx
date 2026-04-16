import Link from "next/link";

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
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-xl font-semibold text-royal">{title}</h1>
        <p className="mt-3 font-sans text-sm text-royal/70">{detail}</p>
        <p className="mt-6 font-sans text-sm text-royal/70">
          Try refreshing the page. If this keeps happening, sign out and sign in
          again, or contact support.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/planner"
            className="inline-flex items-center justify-center rounded-lg bg-gold px-5 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90"
          >
            Back to planner
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-royal/20 bg-white px-5 py-2.5 font-sans text-sm font-semibold text-royal transition hover:bg-cream"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </main>
  );
}
