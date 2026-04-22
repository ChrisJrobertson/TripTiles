"use client";

import { GlobalLoadingProvider } from "@/components/app/GlobalLoadingContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <GlobalLoadingProvider>{children}</GlobalLoadingProvider>;
}
