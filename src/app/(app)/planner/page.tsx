import { SignOutButton } from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add{" "}
            <code className="rounded bg-cream px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            to <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/planner");
  }

  const email = user.email ?? "your account";

  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-xl font-semibold text-gold">
              TripTiles
            </p>
            <h1 className="mt-2 font-serif text-2xl font-semibold text-royal">
              Planner
            </h1>
          </div>
          <SignOutButton />
        </header>

        <div className="rounded-2xl border border-royal/10 bg-white p-8 shadow-md shadow-royal/5">
          <p className="font-serif text-lg text-royal">
            You&apos;re signed in as{" "}
            <span className="font-semibold">{email}</span>
          </p>
          <p className="mt-4 font-sans text-sm text-royal/65">
            Your trip planner will appear here in a later session.
          </p>
        </div>
      </div>
    </main>
  );
}
