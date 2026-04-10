import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireAuth } from "@/lib/auth/redirects";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add{" "}
            <code className="rounded bg-cream px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and either{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            or{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </code>{" "}
            to <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const user = await requireAuth("/planner");
  const email = user.email ?? "there";

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-royal/10 bg-white p-8 text-center shadow-lg shadow-royal/5 md:p-10">
        <h1 className="font-serif text-2xl font-semibold text-royal md:text-3xl">
          ✨ You&apos;re signed in!
        </h1>
        <p className="mt-4 font-serif text-lg text-royal/85">
          Welcome, {email}
        </p>
        <p className="mt-6 font-sans text-sm leading-relaxed text-royal/55">
          The real planner is coming in Session 3. For now, this proves auth is
          working.
        </p>
        <div className="mt-10 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
