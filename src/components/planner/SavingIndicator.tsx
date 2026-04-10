"use client";

type Props = {
  isSaving: boolean;
  lastSavedAt: Date | null;
};

function formatSaved(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SavingIndicator({ isSaving, lastSavedAt }: Props) {
  if (isSaving) {
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
  if (lastSavedAt) {
    return (
      <span className="font-sans text-xs font-medium text-royal/45">
        Saved {formatSaved(lastSavedAt)}
      </span>
    );
  }
  return null;
}
