import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: string;
      stack?: string;
      url?: string | null;
      userAgent?: string | null;
      context?: Record<string, unknown>;
    };

    const msg = String(body.message ?? "Unknown error").slice(0, 2000);
    const stack = String(body.stack ?? "").slice(0, 8000);
    const ctx =
      body.context && typeof body.context === "object"
        ? JSON.stringify(body.context).slice(0, 2000)
        : "";

    const admin = createServiceRoleClient();
    await admin.from("feedback").insert({
      user_id: null,
      anonymous_email: "noreply@triptiles.app",
      category: "bug",
      message: `[AUTO-ERROR] ${msg}\n\nStack:\n${stack}\n\nContext:\n${ctx}\n\nURL: ${body.url ?? ""}`,
      page_url: body.url ?? null,
      user_agent: body.userAgent ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
