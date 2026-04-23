import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { supabaseAuthClientOptions } from "@/lib/supabase/auth-options";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Supabase client for Route Handlers where session cookies must be written to a
 * specific `NextResponse` (e.g. PKCE `exchangeCodeForSession` + redirect).
 * Applies cache headers from `setAll` so CDNs do not cache authenticated responses.
 */
export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse,
) {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and a browser key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }

  return createServerClient(url, anonKey, {
    auth: supabaseAuthClientOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });
}
