import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/planner", "/admin", "/agency"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[TripTiles middleware] Missing Supabase env; allowing request through.",
    );
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

export const config = {
  matcher: [
    "/planner",
    "/planner/:path*",
    "/admin",
    "/admin/:path*",
    "/agency",
    "/agency/:path*",
  ],
};
