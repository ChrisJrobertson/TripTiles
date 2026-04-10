"use client";

type Props = {
  isSaving: boolean;
};

export function SavingIndicator({ isSaving }: Props) {
  if (!isSaving) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-royal/50">
      <span
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-royal/40"
        aria-hidden
      />
      Saving…
    </span>
  );
}
