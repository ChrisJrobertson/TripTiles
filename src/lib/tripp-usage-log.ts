import { createClient } from "@/lib/supabase/server";
import type { PublicTier } from "@/lib/tiers";

export async function logTrippUsage(input: {
  userId: string;
  tier: PublicTier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("tripp_usage").insert({
    user_id: input.userId,
    tier: input.tier,
    model: input.model,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    latency_ms: input.latencyMs,
  });
  if (error) {
    console.warn("[tripp_usage] insert failed", error.message);
  }
}
