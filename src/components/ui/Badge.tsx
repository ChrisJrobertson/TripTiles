import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "magic";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const BASE_CLASSES =
  "inline-flex items-center rounded-full border px-2.5 py-1 font-meta text-[11px] font-semibold uppercase tracking-wide";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "border-tt-line bg-tt-surface text-tt-ink-muted",
  info: "border-tt-royal/15 bg-tt-royal-soft text-tt-royal",
  success: "border-tt-success/20 bg-tt-success-soft text-green-800",
  warning: "border-tt-warning/20 bg-tt-warning-soft text-tt-warning",
  danger: "border-red-200 bg-red-50 text-red-700",
  magic: "border-tt-magic/20 bg-tt-magic/10 text-tt-magic",
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={mergeClasses(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}

export const Pill = Badge;
