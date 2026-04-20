import { runGenerateAIPlan, type GenerateAIPlanInput } from "@/actions/ai";
import { NextResponse } from "next/server";

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const tripId = (body as { tripId?: unknown }).tripId;
  const mode = (body as { mode?: unknown }).mode;
  const userPrompt = (body as { userPrompt?: unknown }).userPrompt;
  const preserveExistingSlots = (body as { preserveExistingSlots?: unknown }).preserveExistingSlots;

  if (
    typeof tripId !== "string" ||
    (mode !== "smart" && mode !== "custom") ||
    typeof userPrompt !== "string"
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const input: GenerateAIPlanInput = {
    tripId,
    mode,
    userPrompt,
    preserveExistingSlots: preserveExistingSlots !== false,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(event, data)));
      };
      try {
        push("started", { ok: true });
        const result = await runGenerateAIPlan(input, {
          onTextDelta(deltaText) {
            push("delta", { text: deltaText });
          },
        });
        push("done", result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown streaming error";
        push("done", {
          ok: false,
          error: "AI_ERROR",
          message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
