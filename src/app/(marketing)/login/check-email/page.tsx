import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="max-w-md rounded-2xl border border-royal/10 bg-white/90 p-8 text-center shadow-lg shadow-royal/5 md:p-10">
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold/50 bg-royal/[0.04] text-4xl leading-none"
          aria-hidden
        >
          ✉️
        </div>
        <h1 className="mt-8 font-serif text-2xl font-semibold text-royal">
          Check your email
        </h1>
        <p className="mt-4 font-serif text-base leading-relaxed text-royal/80">
          We&apos;ve sent you a magic link. Click it to sign in. The link expires
          in 1 hour and can only be used once.
        </p>
        <p className="mt-8 font-sans text-sm text-royal/65">
          Wrong email or didn&apos;t get it?{" "}
          <Link
            href="/login"
            className="font-medium text-royal underline underline-offset-2 hover:text-gold"
          >
            Try again
          </Link>
        </p>
      </div>
    </main>
  );
}
