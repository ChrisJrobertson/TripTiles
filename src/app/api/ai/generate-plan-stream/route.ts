import { runGenerateAIPlan, type GenerateAIPlanInput } from "@/actions/ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function cancelledResult(): {
  ok: false;
  error: "AI_ERROR";
  message: string;
} {
  return {
    ok: false,
    error: "AI_ERROR",
    message: "Smart Plan cancelled",
  };
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
  const dateKey = (body as { dateKey?: unknown }).dateKey;
  const preserveExistingSlots = (body as { preserveExistingSlots?: unknown }).preserveExistingSlots;

  if (
    typeof tripId !== "string" ||
    (mode !== "smart" && mode !== "custom") ||
    typeof userPrompt !== "string" ||
    (dateKey !== undefined && typeof dateKey !== "string")
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const generationController = new AbortController();
  const input: GenerateAIPlanInput = {
    tripId,
    mode,
    userPrompt,
    dateKey: typeof dateKey === "string" ? dateKey : undefined,
    preserveExistingSlots: preserveExistingSlots !== false,
  };

  req.signal.addEventListener(
    "abort",
    () => {
      generationController.abort();
    },
    { once: true },
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamClosed = false;
      const push = (event: string, data: unknown) => {
        if (streamClosed) return false;
        try {
          controller.enqueue(encoder.encode(sseFrame(event, data)));
          return true;
        } catch {
          streamClosed = true;
          generationController.abort();
          return false;
        }
      };
      const heartbeat = setInterval(() => {
        push("ping", { at: Date.now() });
      }, 10_000);
      try {
        push("started", { ok: true });
        if (req.signal.aborted) {
          generationController.abort();
        }
        const result = await runGenerateAIPlan(input, {
          signal: generationController.signal,
          onTextDelta(deltaText) {
            push("delta", { text: deltaText });
          },
        });
        // Contract: every stream ends with exactly one `done` event the client treats as terminal.
        push("done", result);
      } catch (error) {
        if (generationController.signal.aborted || req.signal.aborted) {
          push("done", cancelledResult());
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unknown streaming error";
        // Contract: even failures are terminal `done` events so the client can leave loading state.
        push("done", {
          ok: false,
          error: "AI_ERROR",
          message,
        });
      } finally {
        clearInterval(heartbeat);
        if (!streamClosed) {
          try {
            controller.close();
          } catch {
            /* Client already disconnected. */
          }
          streamClosed = true;
        }
      }
    },
    cancel() {
      generationController.abort();
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
