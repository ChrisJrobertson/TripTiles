import type { HTMLAttributes, ReactNode } from "react";

type SurfaceVariant = "default" | "warm" | "soft" | "transparent";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "aside" | "section" | "article";
  variant?: SurfaceVariant;
  children: ReactNode;
};

const BASE_CLASSES = "rounded-tt-xl border";

const VARIANT_CLASSES: Record<SurfaceVariant, string> = {
  default: "border-tt-line bg-tt-surface shadow-tt-sm",
  warm: "border-tt-line bg-tt-surface-warm shadow-tt-sm",
  soft: "border-tt-line-soft bg-tt-bg-soft",
  transparent: "border-tt-line-soft bg-transparent",
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Surface({
  as: Component = "div",
  variant = "default",
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={mergeClasses(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export const Panel = Surface;
