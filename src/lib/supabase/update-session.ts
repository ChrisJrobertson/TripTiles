import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { type NextRequest, NextResponse } from "next/server";

/** Refreshes the auth session; returns the `NextResponse` to continue (or merge cookies into a redirect). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return {
      response: NextResponse.next({
        request: {
          headers: request.headers,
        },
      }),
      user: null,
    };
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response, user };
  } catch (err) {
    console.warn("[TripTiles middleware] Supabase auth check failed:", err);
    return {
      response: NextResponse.next({
        request: {
          headers: request.headers,
        },
      }),
      user: null,
    };
  }
}
