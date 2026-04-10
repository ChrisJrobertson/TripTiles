import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link:
    "That sign-in link is invalid or has expired. Request a new magic link below.",
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const errorKey = params.error;
  const errorMessage =
    errorKey && ERROR_MESSAGES[errorKey] ? ERROR_MESSAGES[errorKey] : null;

  return (
    <main className="min-h-screen bg-cream px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-royal/10 bg-white/80 p-8 shadow-lg shadow-royal/5 backdrop-blur-sm md:p-10">
        <Link
          href="/"
          className="block text-center font-serif text-2xl font-semibold tracking-tight text-gold md:text-3xl"
        >
          TripTiles
        </Link>

        <h1 className="mt-8 text-center font-serif text-2xl font-semibold text-royal md:text-3xl">
          Sign in to TripTiles
        </h1>
        <p className="mt-3 text-center font-serif text-base text-royal/75">
          We&apos;ll email you a magic link. No passwords required.
        </p>

        {errorMessage ? (
          <div
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <LoginForm next={next} />

        <p className="mt-8 text-center font-sans text-sm leading-relaxed text-royal/65">
          Don&apos;t have an account? Just sign in — we&apos;ll create one
          automatically.
        </p>

        <p className="mt-4 text-center font-sans text-sm text-royal/50">
          <Link href="/" className="text-royal underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
