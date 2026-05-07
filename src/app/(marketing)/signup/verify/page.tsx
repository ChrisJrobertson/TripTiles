import { EmailOtpVerifyForm } from "@/components/auth/EmailOtpVerifyForm";
import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_INLINE_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { redirect } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  searchParams: Promise<{ email?: string }>;
};

const logoFocus =
  "inline-flex items-center rounded-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal";

export default async function SignupVerifyPage({ searchParams }: Props) {
  const p = await searchParams;
  const raw = typeof p.email === "string" ? decodeURIComponent(p.email) : "";
  const email = raw.trim();
  if (!email || !EMAIL_RE.test(email)) {
    redirect("/signup");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-transparent px-6 py-12">
      <Card
        variant="elevated"
        className="w-full max-w-md border border-tt-line/15 bg-tt-surface/92 p-8 shadow-tt-md backdrop-blur-sm md:p-10"
      >
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={120}
            imgClassName={TRIP_TILES_LOGO_INLINE_IMG_CLASS}
            className={logoFocus}
          />
        </div>
        <div
          className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-tt-gold/40 bg-tt-royal-soft text-4xl leading-none"
          aria-hidden
        >
          ✉️
        </div>
        <SectionHeader
          compact
          className="mt-6 flex-col items-center text-center [&>div]:items-center"
          title="Check your email"
        />
        <div className="mt-6">
          <EmailOtpVerifyForm mode="signup" email={email} />
        </div>
      </Card>
    </main>
  );
}
