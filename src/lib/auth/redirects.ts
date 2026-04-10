import { safeNextPath } from "@/lib/auth/safe-next-path";
import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

/**
 * Ensures a signed-in user; otherwise redirects to /login with a safe return path.
 * `redirect()` throws — do not wrap in try/catch expecting a return.
 */
export async function requireAuth(nextPath = "/planner"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const n = safeNextPath(nextPath);
    redirect(`/login?next=${encodeURIComponent(n)}`);
  }
  return user;
}
