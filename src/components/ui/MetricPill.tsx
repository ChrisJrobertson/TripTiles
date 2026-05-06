import type { HTMLAttributes, ReactNode } from "react";

type MetricPillVariant = "default" | "warm" | "success" | "warning" | "magic";

type MetricPillProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  variant?: MetricPillVariant;
};

const BASE_CLASSES =
  "inline-flex min-w-0 items-center gap-2 rounded-tt-lg border px-3 py-2 shadow-tt-sm";

const VARIANT_CLASSES: Record<MetricPillVariant, string> = {
  default: "border-tt-line bg-tt-surface text-tt-ink",
  warm: "border-tt-line bg-tt-surface-warm text-tt-ink",
  success: "border-tt-success/20 bg-tt-success-soft text-green-800",
  warning: "border-tt-warning/20 bg-tt-warning-soft text-tt-warning",
  magic: "border-tt-magic/20 bg-tt-magic/10 text-tt-royal",
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function MetricPill({
  label,
  value,
  icon,
  variant = "default",
  className,
  ...props
}: MetricPillProps) {
  return (
    <div
      className={mergeClasses(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...props}
    >
      {icon ? (
        <span className="shrink-0 text-base leading-none" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block truncate font-meta text-[11px] font-semibold uppercase tracking-wide text-current/70">
          {label}
        </span>
        <span className="block truncate font-sans text-sm font-semibold">
          {value}
        </span>
      </span>
    </div>
  );
}
