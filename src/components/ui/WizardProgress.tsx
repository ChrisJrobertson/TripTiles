function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type WizardProgressProps = {
  /** 1-based current step for dot fill */
  current: number;
  total: number;
  /** Optional line above dots, e.g. "Step 3 of 8" */
  label?: string;
  className?: string;
};

export function WizardProgress({
  current,
  total,
  label,
  className,
}: WizardProgressProps) {
  const line =
    label ??
    `Step ${current} of ${total}`;

  return (
    <div className={mergeClasses("space-y-2", className)}>
      <p className="text-center font-meta text-xs font-semibold uppercase tracking-wide text-tt-gold">
        {line}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={mergeClasses(
              "h-2.5 w-2.5 rounded-full transition-colors",
              i + 1 <= current ? "bg-tt-gold" : "bg-tt-line",
            )}
          />
        ))}
      </div>
    </div>
  );
}
