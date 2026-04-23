import { EmailOtpVerifyForm } from "@/components/auth/EmailOtpVerifyForm";
import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { redirect } from "next/navigation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function ResetPasswordVerifyPage({ searchParams }: Props) {
  const p = await searchParams;
  const raw =
    typeof p.email === "string" ? decodeURIComponent(p.email) : "";
  const email = raw.trim();
  if (!email || !EMAIL_RE.test(email)) {
    redirect("/forgot-password");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-transparent px-6">
      <div className="w-full max-w-md rounded-2xl border border-royal/10 bg-white/90 p-8 shadow-lg shadow-royal/5 md:p-10">
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={56}
            imgClassName="h-14 w-auto sm:h-16"
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
          />
        </div>
        <div
          className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold/50 bg-royal/[0.04] text-4xl leading-none"
          aria-hidden
        >
          ✉️
        </div>
        <h1 className="mt-6 text-center font-serif text-2xl font-semibold text-royal">
          Check your email
        </h1>
        <div className="mt-8">
          <EmailOtpVerifyForm mode="recovery" email={email} />
        </div>
      </div>
    </main>
  );
}
