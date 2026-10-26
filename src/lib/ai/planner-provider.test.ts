/**
 * Run: npx tsx src/lib/ai/planner-provider.test.ts
 */
import assert from "node:assert/strict";
import {
  consumePlannerSse,
  huggingFaceChatBody,
  parseHuggingFaceChatCompletion,
  plannerAiConfigured,
  resolvePlannerModel,
  selectPlannerProvider,
} from "./planner-provider";

function run() {
  assert.equal(selectPlannerProvider({}), null);
  assert.equal(plannerAiConfigured({}), false);
  assert.equal(
    selectPlannerProvider({ ANTHROPIC_API_KEY: "sk-ant", HF_TOKEN: "hf" }),
    "anthropic",
  );
  assert.equal(
    selectPlannerProvider({
      ANTHROPIC_API_KEY: "sk-ant",
      HF_TOKEN: "hf",
      TRIPTILES_AI_PROVIDER: "huggingface",
    }),
    "huggingface",
  );
  assert.equal(
    selectPlannerProvider({ TRIPTILES_AI_PROVIDER: "huggingface" }),
    null,
  );
  assert.equal(
    selectPlannerProvider({ HF_TOKEN: "hf" }),
    "huggingface",
  );
  assert.equal(
    resolvePlannerModel("claude-haiku-4-5-20251001", { HF_TOKEN: "hf" }),
    "openai/gpt-oss-120b:fastest",
  );
  assert.equal(
    resolvePlannerModel("claude-haiku-4-5-20251001", {
      HF_TOKEN: "hf",
      HF_PLANNER_MODEL: "Qwen/Qwen2.5-72B-Instruct:fastest",
    }),
    "Qwen/Qwen2.5-72B-Instruct:fastest",
  );
  assert.equal(
    resolvePlannerModel("claude-haiku-4-5-20251001", { ANTHROPIC_API_KEY: "sk" }),
    "claude-haiku-4-5-20251001",
  );

  const body = huggingFaceChatBody({
    model: "openai/gpt-oss-120b:fastest",
    max_tokens: 1200,
    stream: false,
    system: [
      { type: "text", text: "Return JSON only.", cache_control: { type: "ephemeral" } },
      { type: "text", text: "Parks: mk" },
    ],
    messages: [{ role: "user", content: "Plan Orlando." }],
  });
  assert.equal(body.model, "openai/gpt-oss-120b:fastest");
  assert.equal(body.max_tokens, 1200);
  assert.equal("stream" in body, false);
  const messages = body.messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[0]?.content.includes("cache_control"), false);
  assert.match(messages[0]?.content ?? "", /Return JSON only/);
  assert.match(messages[0]?.content ?? "", /Parks: mk/);
  assert.equal(messages[1]?.content, "Plan Orlando.");

  const message = parseHuggingFaceChatCompletion({
    choices: [
      {
        message: { content: "{\"assignments\":{}}" },
        finish_reason: "length",
      },
    ],
    usage: { prompt_tokens: 11, completion_tokens: 7 },
  });
  assert.equal(message.stop_reason, "max_tokens");
  assert.equal(message.content[0]?.text, "{\"assignments\":{}}");
  assert.equal(message.usage.input_tokens, 11);
  assert.equal(message.usage.output_tokens, 7);

  const sse = consumePlannerSse(
    [
      'data: {"choices":[{"delta":{"content":"{\\"park\\":"}}]}',
      'data: {"choices":[{"delta":{"content":"\\"mk\\"}"},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2}}',
      "data: [DONE]",
      "",
    ].join("\n"),
  );
  assert.equal(sse.rest, "");
  assert.equal(sse.events[0]?.type, "content_block_delta");
  assert.equal(sse.events[1]?.type, "content_block_delta");
  assert.equal(sse.events[2]?.type, "message_delta");
  if (sse.events[2]?.type === "message_delta") {
    assert.equal(sse.events[2].delta?.stop_reason, "end_turn");
    assert.equal(sse.events[2].usage?.output_tokens, 2);
  }

  console.log("planner-provider.test.ts: ok");
}

run();
