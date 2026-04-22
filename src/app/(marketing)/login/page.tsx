import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to TripTiles with a magic link or password — theme park trip planner.",
  openGraph: {
    title: "Sign in · TripTiles",
    description: "Magic link or password sign-in for TripTiles.",
    url: `${site}/login`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign in · TripTiles",
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link:
    "That sign-in link is invalid or has expired. Request a new magic link below.",
  auth_failed:
    "We couldn’t complete sign-in from that link. Details below — try a new magic link if needed.",
};

type Props = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reason?: string;
    email?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const errorKey = params.error;
  const reason = params.reason?.trim();
  const errorMessage =
    errorKey && ERROR_MESSAGES[errorKey] ? ERROR_MESSAGES[errorKey] : null;
  const initialEmail =
    typeof params.email === "string" ? params.email : "";

  return (
    <main className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={56}
            imgClassName="h-14 w-auto max-h-[56px]"
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
          />
        </div>

        <h1 className="mt-8 text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
          Sign in to TripTiles
        </h1>
        <p className="mt-3 text-center font-sans text-sm leading-relaxed text-royal/75">
          Welcome back. Use a magic link or your password.
        </p>
        <p className="mt-2 text-center font-sans text-xs leading-relaxed text-royal/60">
          Use the email you registered with (there is no separate username). Fill in the password field and choose{" "}
          <span className="font-semibold text-royal/75">Sign in with password</span>, or leave password empty and use{" "}
          <span className="font-semibold text-royal/75">Send magic link</span>.
        </p>

        {errorMessage ? (
          <div
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
            role="alert"
          >
            <p>{errorMessage}</p>
            {errorKey === "auth_failed" && reason ? (
              <p className="mt-2 break-words font-mono text-xs text-red-900/90">
                {reason}
              </p>
            ) : null}
          </div>
        ) : null}

        <LoginForm next={next} initialEmail={initialEmail} />

        <p className="mt-8 text-center font-sans text-sm text-royal/50">
          <Link href="/" className="text-royal underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
