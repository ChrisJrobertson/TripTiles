import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <FeedbackWidget />
    </>
  );
}
