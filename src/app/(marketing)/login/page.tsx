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
    "Sign in to TripTiles with an email sign-in code or password — theme park trip planner.",
  openGraph: {
    title: "Sign in · TripTiles",
    description: "Email sign-in code or password sign-in for TripTiles.",
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

const GENERIC_AUTH_ERROR =
  "We couldn't sign you in. Request a new code or use your password.";

const CALLBACK_NOTICE = {
  title: "This link is incomplete or out of date",
  body: "We now send 8-digit sign-in codes to your email. Go back to sign in and choose “Send sign-in code”.",
} as const;

type Props = {
  searchParams: Promise<{
    next?: string;
    error?: string;
    reason?: string;
    email?: string;
    notice?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const hasError = Boolean(
    params.error && String(params.error).trim() !== "",
  );
  const initialEmail =
    typeof params.email === "string" ? params.email : "";
  const showCallbackNotice = params.notice === "old_callback";

  return (
    <main className="min-h-screen bg-transparent px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={72}
            imgClassName="h-[4.5rem] w-auto max-h-[4.5rem] sm:h-20 sm:max-h-20"
            className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
          />
        </div>

        <h1 className="mt-8 text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
          Sign in to TripTiles
        </h1>
        <p className="mt-3 text-center font-sans text-sm leading-relaxed text-royal/75">
          Welcome back. Use an email sign-in code or your password.
        </p>
        <p className="mt-2 text-center font-sans text-xs leading-relaxed text-royal/60">
          Use the email you registered with (there is no separate username). Fill
          in the password field and choose{" "}
          <span className="font-semibold text-royal/75">Sign in with password</span>
          , or leave the password empty and use{" "}
          <span className="font-semibold text-royal/75">Send sign-in code</span>.
        </p>

        {hasError ? (
          <div
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
            role="alert"
          >
            <p>{GENERIC_AUTH_ERROR}</p>
          </div>
        ) : null}

        {showCallbackNotice ? (
          <div
            className="mt-6 rounded-lg border border-royal/20 bg-cream px-4 py-3 font-sans text-sm text-royal/90"
            role="status"
          >
            <p className="font-semibold text-royal">{CALLBACK_NOTICE.title}</p>
            <p className="mt-2 leading-relaxed">{CALLBACK_NOTICE.body}</p>
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
