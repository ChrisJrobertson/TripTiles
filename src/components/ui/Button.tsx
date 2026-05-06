import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconBefore?: ReactNode;
  iconAfter?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-tt-md font-sans font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-tt-royal text-white shadow-tt-sm hover:bg-tt-royal-deep focus-visible:outline-tt-royal",
  secondary:
    "border border-tt-line bg-tt-surface text-tt-royal shadow-tt-sm hover:bg-tt-royal-soft focus-visible:outline-tt-royal",
  accent:
    "bg-tt-gold text-white shadow-tt-sm hover:bg-tt-gold/90 focus-visible:outline-tt-gold",
  ghost:
    "text-tt-royal hover:bg-tt-royal-soft focus-visible:outline-tt-royal",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:outline-red-600",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-3 text-base",
};

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  iconBefore,
  iconAfter,
  loading = false,
  loadingLabel = "Loading",
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={mergeClasses(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
        />
      ) : (
        iconBefore
      )}
      <span>{loading ? loadingLabel : children}</span>
      {!loading ? iconAfter : null}
    </button>
  );
}
