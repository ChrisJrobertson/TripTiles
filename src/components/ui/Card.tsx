import type { HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "warm" | "elevated" | "subtle";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article";
  variant?: CardVariant;
  children: ReactNode;
};

const BASE_CLASSES = "rounded-tt-lg border font-sans text-tt-ink";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "border-tt-line bg-tt-surface shadow-tt-sm",
  warm: "border-tt-line bg-tt-surface-warm shadow-tt-sm",
  elevated: "border-tt-line-soft bg-tt-surface shadow-tt-md",
  subtle: "border-tt-line-soft bg-tt-bg-soft/75",
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({
  as: Component = "div",
  variant = "default",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={mergeClasses(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
