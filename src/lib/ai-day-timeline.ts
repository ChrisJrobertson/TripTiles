import type { AiDayTimeline } from "@/lib/types";

/** Client-safe read of `preferences.ai_day_timeline[dateKey]`. */
export function getAiDayTimelineForDate(
  preferences: Record<string, unknown> | undefined,
  dateKey: string,
): AiDayTimeline | undefined {
  if (!preferences || typeof preferences !== "object") return undefined;
  const raw = (preferences as { ai_day_timeline?: unknown }).ai_day_timeline;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const day = (raw as Record<string, unknown>)[dateKey];
  if (!day || typeof day !== "object" || Array.isArray(day)) return undefined;
  const t = day as Partial<AiDayTimeline>;
  if (!Array.isArray(t.timeline) || t.timeline.length === 0) return undefined;
  if (typeof t.generated_at !== "string" || t.generated_at.length === 0) {
    return undefined;
  }
  if (t.model !== "haiku-4.5" && t.model !== "sonnet-4.6") return undefined;
  if (
    !t.park_hours ||
    typeof t.park_hours !== "object" ||
    typeof (t.park_hours as { open?: unknown }).open !== "string" ||
    typeof (t.park_hours as { close?: unknown }).close !== "string"
  ) {
    return undefined;
  }
  if (!Array.isArray(t.must_do)) return undefined;
  return t as AiDayTimeline;
}
