import { getSupabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client with the service role (bypasses RLS).
 * Used by server actions, webhooks, cron, and internal diagnostics.
 */
export function createServiceRoleClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
