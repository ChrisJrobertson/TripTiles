import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const MILESTONES = [90, 60, 30, 14, 7, 1] as const;

function stripLocalMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Replace pending (unsent) reminder rows for a trip based on start date.
 * Only inserts milestones whose send calendar day is still strictly in the future.
 */
export async function syncTripReminderRows(
  supabase: SupabaseClient,
  tripId: string,
  startDateIso: string,
): Promise<void> {
  const start = parseDate(startDateIso);
  const today = new Date();
  const todayT = stripLocalMidnight(today);

  await supabase
    .from("trip_reminders")
    .delete()
    .eq("trip_id", tripId)
    .is("sent_at", null);

  const rows: { trip_id: string; days_before: number }[] = [];
  for (const daysBefore of MILESTONES) {
    const sendDay = addDays(start, -daysBefore);
    const sendT = stripLocalMidnight(sendDay);
    if (sendT > todayT) {
      rows.push({ trip_id: tripId, days_before: daysBefore });
    }
  }
  if (rows.length === 0) return;
  await supabase.from("trip_reminders").insert(rows);
}

/** Calendar date key (Y-M-D) for "trip start minus days_before". */
export function reminderTriggerDateKey(
  startDateIso: string,
  daysBefore: number,
): string {
  return formatDateKey(addDays(parseDate(startDateIso), -daysBefore));
}
