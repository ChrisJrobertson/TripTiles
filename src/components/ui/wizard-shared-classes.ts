/** Reusable field classes for wizards (visual only; no behaviour change). */
export const wizardFieldInput =
  "mt-1 min-h-11 w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-sm text-tt-ink placeholder:text-tt-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/35";

export const wizardFieldLabel =
  "font-sans text-sm font-medium text-tt-royal";

export const wizardSegmentedTrack =
  "flex min-w-0 gap-1 rounded-tt-md border border-tt-line bg-tt-bg-soft p-1";

export const wizardSegmentedButton = (active: boolean) =>
  [
    "min-h-11 flex-1 rounded-tt-sm px-3 py-2 text-center font-sans text-sm font-semibold transition",
    active
      ? "bg-tt-royal text-white shadow-tt-sm"
      : "text-tt-ink-muted hover:bg-tt-surface",
  ].join(" ");

export const wizardChoiceCard = (selected: boolean) =>
  [
    "min-h-11 rounded-tt-md border px-3 py-3 text-left font-sans text-sm transition",
    selected
      ? "border-tt-gold bg-tt-gold-soft shadow-tt-sm ring-2 ring-tt-gold/40"
      : "border-tt-line bg-tt-surface hover:border-tt-royal-soft",
  ].join(" ");

export const wizardChoicePill = (selected: boolean) =>
  [
    "min-h-10 rounded-full border px-3 py-2 font-sans text-xs font-medium transition",
    selected
      ? "border-tt-royal bg-tt-royal text-white"
      : "border-tt-line bg-tt-surface text-tt-ink",
  ].join(" ");
