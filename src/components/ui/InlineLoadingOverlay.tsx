"use client";

import type { ReactNode } from "react";
import { LogoSpinner } from "@/components/ui/LogoSpinner";

type Props = {
  isLoading: boolean;
  children: ReactNode;
  label?: string;
  className?: string;
};

/**
 * In-place busy state: keeps layout mounted, blocks interaction on children while loading.
 */
export function InlineLoadingOverlay({
  isLoading,
  children,
  label,
  className = "",
}: Props) {
  return (
    <div
      className={`relative${isLoading ? " pointer-events-none" : ""} ${className}`.trim()}
    >
      {children}
      {isLoading ? (
        <LogoSpinner fullscreen size="lg" label={label} fullscreenClassName="z-50" />
      ) : null}
    </div>
  );
}
