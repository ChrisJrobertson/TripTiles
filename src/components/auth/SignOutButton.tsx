"use client";

import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="bg-transparent p-0 font-sans text-sm font-medium text-royal underline-offset-4 transition hover:text-gold hover:underline disabled:opacity-60"
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <LogoSpinner size="sm" className="shrink-0" decorative />
          Signing out
        </span>
      ) : (
        "Sign out"
      )}
    </button>
  );
}
