import { logoMarkImageResponse } from "@/lib/brand/logo-icon-response";

export const runtime = "nodejs";

const ALLOWED = new Set([16, 32, 48, 192, 512]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ px: string }> },
) {
  const raw = (await context.params).px;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !ALLOWED.has(n)) {
    return new Response("Not found", { status: 404 });
  }

  return logoMarkImageResponse(n);
}
