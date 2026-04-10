import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and a browser key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }

  return createBrowserClient(url, anonKey);
}
