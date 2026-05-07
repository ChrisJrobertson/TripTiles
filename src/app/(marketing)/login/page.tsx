import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_AUTH_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
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

const logoFocus =
  "inline-flex items-center rounded-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal";

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const hasError = Boolean(params.error && String(params.error).trim() !== "");
  const initialEmail = typeof params.email === "string" ? params.email : "";
  const showCallbackNotice = params.notice === "old_callback";

  return (
    <main className="min-h-screen bg-transparent px-4 py-12">
      <Card
        variant="elevated"
        className="mx-auto w-full max-w-md border border-tt-line/15 bg-tt-surface/92 p-8 shadow-tt-md backdrop-blur-sm md:p-10"
      >
        <div className="flex justify-center">
          <TripTilesLogoLink
            href="/"
            height={200}
            imgClassName={TRIP_TILES_LOGO_AUTH_IMG_CLASS}
            className={logoFocus}
          />
        </div>

        <SectionHeader
          compact
          className="mt-8 flex-col items-center text-center [&>div:first-child]:items-center [&>div:first-child]:justify-center [&>div:last-child]:w-full [&_p]:mx-auto [&_p]:max-w-md"
          title="Sign in to TripTiles"
          subtitle={
            <>
              Welcome back. Use an email sign-in code or your password.
            </>
          }
        />

        <p className="mt-2 text-center font-sans text-xs leading-relaxed text-tt-ink-muted">
          Use the email you registered with (there is no separate username).
          Fill in the password field and choose{" "}
          <span className="font-semibold text-tt-royal">Sign in with password</span>,
          or leave the password empty and use{" "}
          <span className="font-semibold text-tt-royal">Send sign-in code</span>.
        </p>

        {hasError ? (
          <div
            className="mt-6 rounded-tt-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
            role="alert"
          >
            <p>{GENERIC_AUTH_ERROR}</p>
          </div>
        ) : null}

        {showCallbackNotice ? (
          <div
            className="mt-6 rounded-tt-md border border-tt-line-soft bg-tt-surface-warm px-4 py-3 font-sans text-sm text-tt-royal"
            role="status"
          >
            <p className="font-semibold">{CALLBACK_NOTICE.title}</p>
            <p className="mt-2 leading-relaxed text-tt-ink-muted">
              {CALLBACK_NOTICE.body}
            </p>
          </div>
        ) : null}

        <LoginForm next={next} initialEmail={initialEmail} />

        <p className="mt-8 text-center font-sans text-sm text-tt-ink-soft">
          <Link href="/" className="text-tt-royal underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </Card>
    </main>
  );
}
