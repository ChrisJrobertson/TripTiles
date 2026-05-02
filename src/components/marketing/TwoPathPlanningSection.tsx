import Link from "next/link";

/** Inline icons — no extra icon dependency. */
function IconCalendarGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M9 4V2M15 4V2" />
      <path d="M7 13h2M7 17h2M11 13h2M11 17h2M15 13h2M15 17h2" />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1.5l2.2 6.8h7.1l-5.7 4.1 2.2 6.8-5.8-4.2-5.8 4.2 2.2-6.8-5.7-4.1h7.1z" />
    </svg>
  );
}

type Props = {
  variant?: "marketing" | "onboardingChoice";
  onPickManual?: () => void;
  onPickAi?: () => void;
};

/**
 * Equal-weight comparison of manual vs Smart Plan paths for marketing
 * and onboarding-adjacent flows.
 */
export function TwoPathPlanningSection({
  variant = "marketing",
  onPickManual,
  onPickAi,
}: Props) {
  if (variant === "onboardingChoice") {
    if (!onPickManual || !onPickAi) {
      throw new Error(
        "TwoPathPlanningSection: onPickManual and onPickAi are required for onboardingChoice",
      );
    }
    return (
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="text-center">
          <h2 className="font-serif text-xl font-semibold text-royal md:text-2xl">
            You&apos;re set up — how do you want to start?
          </h2>
          <p className="mt-2 font-sans text-sm text-royal/75">
            Pick one to open your planner. You can always switch later.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPickManual}
            className="flex min-h-[200px] flex-col rounded-2xl border border-royal/25 bg-cream p-5 text-left shadow-sm transition hover:border-royal/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <IconCalendarGrid className="h-10 w-10 shrink-0 text-royal" />
            <h3 className="mt-4 font-serif text-lg font-semibold text-royal">
              I&apos;ll plan it myself
            </h3>
            <p className="mt-2 flex-1 font-sans text-sm leading-relaxed text-royal/80">
              Start with an empty calendar and drag your parks in.
            </p>
          </button>
          <button
            type="button"
            onClick={onPickAi}
            className="flex min-h-[200px] flex-col rounded-2xl border border-royal/20 border-l-4 border-l-gold bg-cream p-5 text-left shadow-sm transition hover:border-gold/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <IconSparkles className="h-10 w-10 shrink-0 text-gold" />
            <h3 className="mt-4 font-serif text-lg font-semibold text-royal">
              Ask Trip for a first draft ✨
            </h3>
            <p className="mt-2 flex-1 font-sans text-sm leading-relaxed text-royal/80">
              Set anchors and priorities — get a first draft in seconds, then
              use nudges and the day timeline to refine.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
        Two ways to plan — your choice
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center font-sans text-sm leading-relaxed text-royal/75 md:text-base">
        Whether you love planning every detail or just want a great itinerary
        fast, TripTiles works the way you do.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2 md:items-stretch">
        <Link
          href="/signup?intent=manual"
          className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          <article className="flex min-h-[220px] flex-col rounded-2xl border border-royal/25 bg-cream p-6 shadow-sm transition hover:border-royal/40 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <IconCalendarGrid className="h-10 w-10 shrink-0 text-royal" />
              <span className="rounded-full border border-royal/20 bg-white px-2.5 py-0.5 font-sans text-xs font-semibold text-royal/80">
                Free to use
              </span>
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold text-royal">
              Build it yourself
            </h3>
            <p className="mt-3 flex-1 font-sans text-sm leading-relaxed text-royal/80">
              Drag parks, restaurants, and activities onto your calendar.
              Rearrange anything, any time. You&apos;re in full control.
            </p>
          </article>
        </Link>
        <Link
          href="/signup?intent=smart"
          className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          <article className="flex min-h-[220px] flex-col rounded-2xl border-y border-r border-l-[4px] border-royal/25 border-l-gold bg-cream p-6 shadow-sm transition hover:border-gold/50 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <IconSparkles className="h-10 w-10 shrink-0 text-gold" />
              <span className="rounded-full border border-gold/40 bg-white/90 px-2.5 py-0.5 font-sans text-xs font-semibold text-royal">
                Smart Plan ✨
              </span>
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold text-royal">
              Let Trip plan it
            </h3>
            <p className="mt-3 flex-1 font-sans text-sm leading-relaxed text-royal/80">
              Set must-dos, dining anchors, and who&apos;s traveling — Trip
              drafts a day-by-day itinerary in seconds, then the timeline and
              nudges help you harden the plan. Tweak anything you like.
            </p>
          </article>
        </Link>
      </div>
    </div>
  );
}
