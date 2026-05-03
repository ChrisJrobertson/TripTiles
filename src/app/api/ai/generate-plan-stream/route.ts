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

  // Diagnostic logs use a stable `[smart-plan-stream]` prefix so logs can be greppped
  // across Vercel runtime output. Logs only — no behaviour changes in this part.
  const startTs = Date.now();
  const logCtx = { tripId, mode, hasDateKey: typeof dateKey === "string" };
  console.log("[smart-plan-stream] start", logCtx);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamClosed = false;
      let pingCount = 0;
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
        pingCount += 1;
        // 10s heartbeat × 3 = ~30s, matching the client idle-timeout window.
        // Avoid log spam: only log every 3rd ping.
        if (pingCount % 3 === 0) {
          console.log("[smart-plan-stream] ping", {
            ...logCtx,
            pingCount,
            ageMs: Date.now() - startTs,
          });
        }
        push("ping", { at: Date.now() });
      }, 10_000);
      try {
        push("started", { ok: true });
        if (req.signal.aborted) {
          generationController.abort();
        }
        console.log("[smart-plan-stream] anthropic-call-start", logCtx);
        const anthropicStartTs = Date.now();
        const result = await runGenerateAIPlan(input, {
          signal: generationController.signal,
          onTextDelta(deltaText) {
            push("delta", { text: deltaText });
          },
        });
        console.log("[smart-plan-stream] anthropic-call-complete", {
          ...logCtx,
          durationMs: Date.now() - anthropicStartTs,
          ok: result.ok,
        });
        // Contract: every stream ends with exactly one `done` event the client treats as terminal.
        const doneSent = push("done", result);
        console.log("[smart-plan-stream] done-emitted", {
          ...logCtx,
          hasResult: !!result,
          enqueued: doneSent,
          totalDurationMs: Date.now() - startTs,
        });
      } catch (error) {
        if (generationController.signal.aborted || req.signal.aborted) {
          console.log("[smart-plan-stream] aborted", {
            ...logCtx,
            ageMs: Date.now() - startTs,
          });
          push("done", cancelledResult());
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unknown streaming error";
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("[smart-plan-stream] error", {
          ...logCtx,
          message,
          stack: stack?.slice(0, 500),
          ageMs: Date.now() - startTs,
        });
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
        console.log("[smart-plan-stream] stream-closed", {
          ...logCtx,
          totalDurationMs: Date.now() - startTs,
          pingCount,
        });
      }
    },
    cancel() {
      console.log("[smart-plan-stream] cancel-callback", {
        ...logCtx,
        ageMs: Date.now() - startTs,
      });
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
