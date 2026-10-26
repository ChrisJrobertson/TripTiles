/**
 * Smart Plan provider selection and Hugging Face Inference Providers.
 *
 * Anthropic stays the default whenever `ANTHROPIC_API_KEY` is set, and those
 * requests still go through the existing Anthropic client. This module is used
 * when Hugging Face is selected. Prompt caching stays on the Anthropic path;
 * Hugging Face receives the same instructions as ordinary chat messages.
 */

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_HF_MODEL = "openai/gpt-oss-120b:fastest";

export type PlannerProviderName = "anthropic" | "huggingface";

export type PlannerUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type PlannerMessage = {
  stop_reason: string | null;
  usage: PlannerUsage;
  content: Array<{ type: "text"; text: string }>;
};

export type PlannerStreamEvent =
  | { type: "message_start"; message: { usage?: PlannerUsage } }
  | {
      type: "message_delta";
      usage?: PlannerUsage;
      delta?: { stop_reason?: string | null };
    }
  | {
      type: "content_block_delta";
      delta: { type: "text_delta"; text: string };
    };

type SystemBlock = {
  type?: string;
  text?: string;
  cache_control?: unknown;
};

export type PlannerPrompt = {
  model: string;
  max_tokens: number;
  system?: string | SystemBlock[];
  messages: Array<{ role: "user"; content: string | Array<{ type?: string; text?: string }> }>;
  stream?: boolean;
};

type ProviderEnv = {
  ANTHROPIC_API_KEY?: string;
  HF_TOKEN?: string;
  HF_PLANNER_MODEL?: string;
  TRIPTILES_AI_PROVIDER?: string;
};

function providerEnv(env?: ProviderEnv): ProviderEnv {
  if (env) return env;
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    HF_PLANNER_MODEL: process.env.HF_PLANNER_MODEL,
    TRIPTILES_AI_PROVIDER: process.env.TRIPTILES_AI_PROVIDER,
  };
}

export function selectPlannerProvider(
  env?: ProviderEnv,
): PlannerProviderName | null {
  const source = providerEnv(env);
  const requested = source.TRIPTILES_AI_PROVIDER?.trim().toLowerCase();
  const anthropicKey = Boolean(source.ANTHROPIC_API_KEY?.trim());
  const huggingFaceKey = Boolean(source.HF_TOKEN?.trim());
  if (requested === "anthropic") return anthropicKey ? "anthropic" : null;
  if (requested === "huggingface") return huggingFaceKey ? "huggingface" : null;
  if (anthropicKey) return "anthropic";
  if (huggingFaceKey) return "huggingface";
  return null;
}

export function plannerAiConfigured(env?: ProviderEnv): boolean {
  return selectPlannerProvider(env) !== null;
}

export function huggingfacePlannerModel(env?: ProviderEnv): string {
  const configured = providerEnv(env).HF_PLANNER_MODEL?.trim();
  return configured || DEFAULT_HF_MODEL;
}

/** Anthropic model ids stay unchanged. Hugging Face uses its own hosted model. */
export function resolvePlannerModel(
  anthropicModel: string,
  env?: ProviderEnv,
): string {
  return selectPlannerProvider(env) === "huggingface"
    ? huggingfacePlannerModel(env)
    : anthropicModel;
}

export function plannerSystemText(system: PlannerPrompt["system"]): string {
  if (!system) return "";
  if (typeof system === "string") return system;
  return system
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
}

function userText(message: PlannerPrompt["messages"][number] | undefined): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("");
}

export function mapFinishReason(reason: unknown): string | null {
  if (typeof reason !== "string" || !reason) return null;
  if (reason === "stop") return "end_turn";
  if (reason === "length") return "max_tokens";
  return reason;
}

type HfChoice = {
  message?: { content?: unknown };
  delta?: { content?: unknown };
  finish_reason?: unknown;
};

type HfBody = {
  choices?: HfChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export function parseHuggingFaceChatCompletion(body: unknown): PlannerMessage {
  const parsed = body as HfBody;
  const choice = parsed.choices?.[0];
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  return {
    stop_reason: mapFinishReason(choice?.finish_reason),
    usage: {
      input_tokens: parsed.usage?.prompt_tokens ?? 0,
      output_tokens: parsed.usage?.completion_tokens ?? 0,
    },
    content: [{ type: "text", text }],
  };
}

export function eventsFromHuggingFaceChunk(body: unknown): PlannerStreamEvent[] {
  const parsed = body as HfBody;
  const choice = parsed.choices?.[0];
  const events: PlannerStreamEvent[] = [];
  const delta = choice?.delta?.content;
  if (typeof delta === "string" && delta.length > 0) {
    events.push({
      type: "content_block_delta",
      delta: { type: "text_delta", text: delta },
    });
  }
  const finish = mapFinishReason(choice?.finish_reason);
  if (finish || parsed.usage) {
    events.push({
      type: "message_delta",
      usage: parsed.usage
        ? {
            input_tokens: parsed.usage.prompt_tokens ?? 0,
            output_tokens: parsed.usage.completion_tokens ?? 0,
          }
        : undefined,
      delta: { stop_reason: finish },
    });
  }
  return events;
}

/** Parse one SSE buffer. `rest` is the incomplete trailing line. */
export function consumePlannerSse(buffer: string): {
  events: PlannerStreamEvent[];
  rest: string;
} {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: PlannerStreamEvent[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    events.push(...eventsFromHuggingFaceChunk(JSON.parse(data) as unknown));
  }
  return { events, rest };
}

export function huggingFaceChatBody(prompt: PlannerPrompt): Record<string, unknown> {
  const system = plannerSystemText(prompt.system);
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: userText(prompt.messages[0]) },
  ];
  return {
    model: prompt.model,
    max_tokens: prompt.max_tokens,
    messages,
    ...(prompt.stream
      ? { stream: true, stream_options: { include_usage: true } }
      : {}),
  };
}

async function huggingFaceError(response: Response): Promise<Error> {
  return new Error(`Hugging Face planner request failed (HTTP ${response.status}).`);
}

async function completeWithHuggingFace(
  prompt: PlannerPrompt,
  signal?: AbortSignal,
): Promise<PlannerMessage> {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) throw new Error("AI is not configured.");
  const response = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(huggingFaceChatBody(prompt)),
    signal,
  });
  if (!response.ok) throw await huggingFaceError(response);
  return parseHuggingFaceChatCompletion(await response.json());
}

async function* streamWithHuggingFace(
  prompt: PlannerPrompt,
  signal?: AbortSignal,
): AsyncGenerator<PlannerStreamEvent> {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) throw new Error("AI is not configured.");
  const response = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(huggingFaceChatBody({ ...prompt, stream: true })),
    signal,
  });
  if (!response.ok || !response.body) throw await huggingFaceError(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let started = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = consumePlannerSse(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      if (event.type === "message_delta" && event.usage?.input_tokens) {
        inputTokens = event.usage.input_tokens;
      }
      if (!started && event.type === "content_block_delta") {
        started = true;
        yield {
          type: "message_start",
          message: { usage: { input_tokens: inputTokens, output_tokens: 0 } },
        };
      }
      yield event;
    }
  }
  if (!started) {
    yield {
      type: "message_start",
      message: { usage: { input_tokens: inputTokens, output_tokens: 0 } },
    };
  }
}

export async function createHuggingFacePlannerMessage(
  prompt: PlannerPrompt & { stream: true },
  options?: { signal?: AbortSignal },
): Promise<AsyncIterable<PlannerStreamEvent>>;
export async function createHuggingFacePlannerMessage(
  prompt: PlannerPrompt,
  options?: { signal?: AbortSignal },
): Promise<PlannerMessage>;
export async function createHuggingFacePlannerMessage(
  prompt: PlannerPrompt,
  options?: { signal?: AbortSignal },
): Promise<PlannerMessage | AsyncIterable<PlannerStreamEvent>> {
  return prompt.stream
    ? streamWithHuggingFace(prompt, options?.signal)
    : completeWithHuggingFace(prompt, options?.signal);
}
