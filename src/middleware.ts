import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/update-session";

const PROTECTED_PREFIXES = [
  "/planner",
  "/trip",
  "/onboarding",
  "/admin",
  "/agency",
  "/achievements",
  "/settings",
] as const;

let loggedMissingSupabaseEnv = false;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/_archive" || pathname.startsWith("/_archive/")) {
    return new NextResponse(null, { status: 404 });
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    if (!loggedMissingSupabaseEnv) {
      loggedMissingSupabaseEnv = true;
      console.warn(
        "[TripTiles middleware] Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (non-empty).",
      );
    }
    return NextResponse.next();
  }

  try {
    const { response, user } = await updateSession(request);
    const { pathname } = request.nextUrl;

    if (isProtectedPath(pathname) && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", safeNextPath(pathname));
      const redirectResponse = NextResponse.redirect(loginUrl);
      response.cookies.getAll().forEach((c) => {
        redirectResponse.cookies.set(c.name, c.value);
      });
      return redirectResponse;
    }

    return response;
  } catch (err) {
    console.warn("[TripTiles middleware] Unexpected error:", err);
    return NextResponse.next();
  }
}

/**
 * Explicit allowlist — `/_next/*` and `/src/*` never hit middleware (avoids dev 404 spam).
 * `/auth/callback` is excluded so PKCE is not intercepted.
 */
export const config = {
  matcher: [
    "/_archive",
    "/_archive/:path*",
    "/",
    "/login",
    "/login/:path*",
    "/signup",
    "/signup/:path*",
    "/forgot-password",
    "/forgot-password/:path*",
    "/reset-password",
    "/reset-password/:path*",
    "/planner",
    "/planner/:path*",
    "/trip",
    "/trip/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/privacy",
    "/terms",
    "/cookies",
    "/achievements",
    "/achievements/:path*",
    "/settings",
    "/settings/:path*",
    "/pricing",
    "/pricing/:path*",
    "/feedback",
    "/feedback/:path*",
    "/p",
    "/p/:path*",
    "/plans",
    "/plans/:path*",
    "/invite",
    "/invite/:path*",
    "/api/analytics/:path*",
    "/admin",
    "/admin/:path*",
    "/agency",
    "/agency/:path*",
  ],
};
