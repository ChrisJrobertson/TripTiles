import { Logo } from "@/components/brand/Logo";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";

/** Session-dependent; avoids static prerender at build (needs cookies / Supabase env). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set new password · TripTiles",
  description: "Choose a new password for your TripTiles account.",
};

const logoFocus =
  "focus-visible:ring-0 focus-visible:ring-offset-0 inline-flex items-center rounded-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-transparent px-4 py-12">
      <Card
        variant="elevated"
        className="mx-auto w-full max-w-md border border-tt-line/15 bg-tt-surface/92 p-8 shadow-tt-md backdrop-blur-sm md:p-10"
      >
        <div className="flex justify-center">
          <Logo href="/" variant="full" sizePreset="auth" className={logoFocus} />
        </div>

        {!user ? (
          <>
            <div className="mt-8 space-y-4 font-sans text-sm text-tt-ink-muted">
              <p>
                This session is invalid or has expired. Request a new reset code
                from the forgot password page.
              </p>
              <p>
                <Link
                  href="/forgot-password"
                  className="font-semibold text-tt-gold underline underline-offset-2"
                >
                  Forgot password
                </Link>
              </p>
            </div>
          </>
        ) : (
          <ResetPasswordForm />
        )}

        <p className="mt-8 text-center font-sans text-sm text-tt-ink-soft">
          <Link
            href="/login"
            className="text-tt-royal underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
