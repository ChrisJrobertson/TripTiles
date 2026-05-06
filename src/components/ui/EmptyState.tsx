import type { ReactNode } from "react";

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={mergeClasses(
        "rounded-tt-xl border border-dashed border-tt-line bg-tt-surface-warm p-6 text-center shadow-tt-sm",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tt-royal-soft text-2xl text-tt-royal">
          {icon}
        </div>
      ) : null}
      <h3 className="font-heading text-lg font-semibold text-tt-ink">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md font-sans text-sm leading-relaxed text-tt-ink-soft">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
