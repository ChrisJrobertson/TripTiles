import { MarketingFooter } from "@/components/marketing/Footer";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tt-marketing-bg flex min-h-screen flex-col bg-transparent">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
