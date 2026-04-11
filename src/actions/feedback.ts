"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type FeedbackCategory =
  | "bug"
  | "feature"
  | "question"
  | "compliment"
  | "other";

export async function submitFeedbackAction(input: {
  category: FeedbackCategory;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const msg = input.message.trim();
  if (msg.length < 5 || msg.length > 5000) {
    return { ok: false, error: "Message must be 5–5000 characters." };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase.from("feedback").insert({
    user_id: user?.id ?? null,
    category: input.category,
    message: msg,
    page_url: input.pageUrl,
    user_agent: input.userAgent,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
