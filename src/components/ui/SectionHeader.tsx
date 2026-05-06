import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
  /** Smaller title scale for wizard steps and dense panels */
  compact?: boolean;
  className?: string;
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
  eyebrow,
  compact = false,
  className,
}: SectionHeaderProps) {
  const titleClass = compact
    ? "min-w-0 font-heading text-lg font-semibold leading-snug text-tt-royal sm:text-xl"
    : "min-w-0 font-heading text-xl font-semibold leading-tight text-tt-ink sm:text-2xl";

  return (
    <div
      className={mergeClasses(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="font-meta text-xs font-semibold uppercase tracking-wide text-tt-ink-soft">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="shrink-0 text-tt-gold" aria-hidden>
              {icon}
            </span>
          ) : null}
          <h2 className={titleClass}>{title}</h2>
        </div>
        {subtitle ? (
          <p
            className={mergeClasses(
              "mt-1 max-w-2xl font-sans text-sm leading-relaxed",
              compact ? "text-tt-ink-muted" : "text-tt-ink-soft",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
