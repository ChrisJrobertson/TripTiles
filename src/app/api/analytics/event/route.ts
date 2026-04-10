import { NextResponse } from "next/server";

/**
 * Minimal server-side event logging (no third-party SDK).
 * Safe for friends launch: event name + optional non-PII meta only.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event = (body as { event?: unknown }).event;
  const meta = (body as { meta?: unknown }).meta;
  if (typeof event !== "string" || !/^[a-z0-9._-]{1,64}$/i.test(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const safeMeta =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? Object.fromEntries(
          Object.entries(meta as Record<string, unknown>).filter(
            ([k, v]) =>
              typeof k === "string" &&
              k.length <= 32 &&
              (typeof v === "string" ||
                typeof v === "number" ||
                typeof v === "boolean"),
          ),
        )
      : {};
  console.info("[analytics]", event, safeMeta);
  return NextResponse.json({ ok: true });
}
