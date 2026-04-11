import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

function stripLocalMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function utcNineAmOnCalendarDate(dateKey: string): string {
  const d = parseDate(dateKey);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0, 0),
  ).toISOString();
}

/** Cancel pending lifecycle rows for this trip so dates can be rescheduled. */
export async function cancelPendingTripLifecycleEmails(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<void> {
  await supabase
    .from("email_queue")
    .update({ status: "cancelled" })
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("template", ["countdown_3d", "followup_1d"]);
}

/**
 * Queue countdown (3 days before start, 09:00 UTC) and follow-up (day after
 * end, 09:00 UTC). Skips countdown when the trip starts in under 3 days.
 */
export async function syncTripLifecycleEmailQueue(input: {
  supabase: SupabaseClient;
  userId: string;
  tripId: string;
  startDate: string;
  endDate: string;
}): Promise<void> {
  const { supabase, userId, tripId, startDate, endDate } = input;

  await cancelPendingTripLifecycleEmails(supabase, userId, tripId);

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const today = new Date();
  const daysUntilStart = Math.floor(
    (stripLocalMidnight(start) - stripLocalMidnight(today)) / 86400000,
  );

  if (daysUntilStart >= 3) {
    const notifyDate = addDays(start, -3);
    const scheduledFor = utcNineAmOnCalendarDate(formatDateKey(notifyDate));
    if (new Date(scheduledFor).getTime() > Date.now()) {
      await supabase.from("email_queue").insert({
        user_id: userId,
        trip_id: tripId,
        template: "countdown_3d",
        scheduled_for: scheduledFor,
        status: "pending",
      });
    }
  }

  const followupDate = addDays(end, 1);
  const followupScheduled = utcNineAmOnCalendarDate(
    formatDateKey(followupDate),
  );
  if (new Date(followupScheduled).getTime() > Date.now()) {
    await supabase.from("email_queue").insert({
      user_id: userId,
      trip_id: tripId,
      template: "followup_1d",
      scheduled_for: followupScheduled,
      status: "pending",
    });
  }
}
