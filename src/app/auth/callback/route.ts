import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const loginWithError = () =>
    NextResponse.redirect(
      `${origin}/login?error=invalid_link&next=${encodeURIComponent(next)}`,
    );

  if (!code) {
    return loginWithError();
  }

  const redirectResponse = NextResponse.redirect(`${origin}${next}`);

  try {
    const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return loginWithError();
    }

    return redirectResponse;
  } catch {
    return loginWithError();
  }
}
