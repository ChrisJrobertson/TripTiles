const HIGHLIGHTS = [
  {
    icon: "✨" as const,
    title: "Smart Plan with your rules",
    body: "Must-dos, dining anchors, and group size feed the first draft — then you drag, edit, and re-run as much as you like.",
  },
  {
    icon: "⏱️" as const,
    title: "Day timeline with clash checks",
    body: "The planner flags overlapping park blocks, back-to-back rope drops, and skip-the-line return windows that do not add up on the same day.",
  },
  {
    icon: "💡" as const,
    title: "Nudges that explain why",
    body: "When something is overloaded or would break a booking, you get a short, readable nudge with the fix — not a wall of red errors.",
  },
  {
    icon: "🎢" as const,
    title: "Ride- and day-level detail",
    body: "Parks, dining, and ride notes (including paste-in waits) stay in one scrollable day so everyone sees the same plan.",
  },
] as const;

type Variant = "full" | "compact";

/**
 * Reusable value props for marketing / community flows — keep in sync with real planner behaviour.
 */
export function PlannerValueHighlights({ variant = "full" }: { variant?: Variant }) {
  if (variant === "compact") {
    return (
      <div className="rounded-2xl border border-royal/10 bg-white/80 p-5 shadow-sm backdrop-blur-sm md:p-6">
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gold">
          What you get in the app
        </p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-royal/80">
          These plans are a live preview. Clone one into your account to use
          the same calendar, nudges, and clash checks on your own trip.
        </p>
        <ul className="mt-4 space-y-3">
          {HIGHLIGHTS.map((h) => (
            <li
              key={h.title}
              className="flex gap-3 font-sans text-sm leading-relaxed text-royal/85"
            >
              <span className="shrink-0 text-base" aria-hidden>
                {h.icon}
              </span>
              <span>
                <span className="font-semibold text-royal">{h.title}.</span>{" "}
                {h.body}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ul className="mt-10 grid gap-5 sm:grid-cols-2">
      {HIGHLIGHTS.map((h) => (
        <li
          key={h.title}
          className="flex gap-4 rounded-2xl border border-royal/10 bg-white/90 p-5 shadow-sm"
        >
          <span className="text-2xl leading-none" aria-hidden>
            {h.icon}
          </span>
          <div>
            <h3 className="font-serif text-base font-semibold text-royal">
              {h.title}
            </h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-royal/80">
              {h.body}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
