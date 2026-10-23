import { type NextRequest, NextResponse } from "next/server";
import { authUnavailableDecision } from "@/lib/auth/route-guard";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import {
  isPublishedPlanSlug,
  missingPublicPlanHtml,
  publicPlanLookupSlug,
} from "@/lib/public-plan-status";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/update-session";

let loggedMissingSupabaseEnv = false;

function missingPublicPlanResponse(): NextResponse {
  return new NextResponse(missingPublicPlanHtml(), {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

/**
 * Dynamic `notFound()` is streamed as HTTP 200. Ask Postgres whether this
 * published slug exists, using a boolean function the anonymous key may call.
 * A failed lookup falls through so a database blip does not hide real plans.
 */
async function publishedPlanIsVisible(slug: string): Promise<boolean | null> {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/published_plan_exists`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ lookup_slug: slug }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return body === true;
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", safeNextPath(request.nextUrl.pathname));
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lookupSlug = publicPlanLookupSlug(pathname);
  if (lookupSlug !== null) {
    if (!isPublishedPlanSlug(lookupSlug)) return missingPublicPlanResponse();
    const visible = await publishedPlanIsVisible(lookupSlug);
    if (visible === false) return missingPublicPlanResponse();
  }

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
    if (authUnavailableDecision(pathname) === "redirect-login") {
      return redirectToLogin(request);
    }
    return NextResponse.next();
  }

  try {
    const { response, user } = await updateSession(request);
    const { pathname } = request.nextUrl;

    if (authUnavailableDecision(pathname) === "redirect-login" && !user) {
      const redirectResponse = redirectToLogin(request);
      response.cookies.getAll().forEach((c) => {
        redirectResponse.cookies.set(c.name, c.value);
      });
      return redirectResponse;
    }

    return response;
  } catch (err) {
    console.warn("[TripTiles middleware] Unexpected error:", err);
    if (authUnavailableDecision(pathname) === "redirect-login") {
      return redirectToLogin(request);
    }
    return NextResponse.next();
  }
}

/**
 * Explicit allowlist — `/_next/*` and `/src/*` never hit middleware (avoids dev 404 spam).
 * `/auth/callback` is excluded so PKCE is not intercepted.
 * `/plans/:slug` is included so a missing published plan can return HTTP 404
 * before the page streams. The check returns only true or false.
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
    "/passport",
    "/passport/:path*",
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
    "/internal",
    "/internal/:path*",
  ],
};
