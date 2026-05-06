import type { HTMLAttributes, ReactNode } from "react";

function mergeClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export type ModalShellProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "role" | "children"
> & {
  children: ReactNode;
  /** Panel max width Tailwind fragment, e.g. max-w-lg */
  maxWidthClass?: string;
  /** z-index utility */
  zClassName?: string;
  /** Overlay tint */
  overlayClassName?: string;
  /** Inner panel classes (padding, scroll) */
  panelClassName?: string;
  /** Bottom sheet on small screens only */
  bottomSheetOnMobile?: boolean;
  role?: "dialog" | "presentation";
  "aria-modal"?: boolean | "false";
  "aria-labelledby"?: string;
};

/**
 * Full-viewport modal overlay + scrollable panel using TripTiles design tokens.
 * Parent is responsible for backdrop close buttons / focus traps when needed.
 */
export function ModalShell({
  children,
  className,
  maxWidthClass = "max-w-lg",
  zClassName = "z-[120]",
  overlayClassName = "bg-tt-royal/80 backdrop-blur-[1px]",
  panelClassName,
  bottomSheetOnMobile = false,
  role = "dialog",
  "aria-modal": ariaModal = true,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: ModalShellProps) {
  return (
    <div
      role={role}
      aria-modal={ariaModal === "false" ? undefined : (ariaModal as boolean)}
      aria-labelledby={ariaLabelledBy}
      className={mergeClasses(
        "fixed inset-0 flex justify-center p-0 sm:p-4",
        bottomSheetOnMobile ? "items-end sm:items-center" : "items-center",
        zClassName,
        overlayClassName,
        className,
      )}
      {...rest}
    >
      <div
        className={mergeClasses(
          "relative z-10 max-h-[min(92vh,52rem)] w-full overflow-y-auto rounded-t-tt-xl border border-tt-line bg-tt-surface-warm shadow-tt-lg sm:rounded-tt-xl",
          maxWidthClass,
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
