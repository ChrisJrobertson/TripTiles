import { AppNavServer } from "@/components/app/AppNavServer";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { Suspense } from "react";

function AppNavSkeleton() {
  return (
    <div
      className="relative z-30 h-[3.25rem] animate-pulse border-b border-tt-line/90 bg-white/90"
      aria-hidden
    />
  );
}

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<AppNavSkeleton />}>
        <AppNavServer />
      </Suspense>
      {children}
      <FeedbackWidget />
    </>
  );
}
