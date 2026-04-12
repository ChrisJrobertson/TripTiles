import { formatDateKey, parseDate } from "@/lib/date-helpers";
import { sendTemplatedEmail, type EmailTemplate } from "@/lib/email/send";
import {
  reminderDefaultBullets,
  reminderExtraLines,
  reminderSubject,
} from "@/lib/trip-reminder-copy";
import { reminderTriggerDateKey } from "@/lib/trip-reminder-seed";
import { getSupabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.triptiles.app"
  ).replace(/\/$/, "");

  const { data: queued, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = {
    ok: true as const,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  const stripLocalMidnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  for (const row of queued ?? []) {
    const id = String((row as { id: string }).id);
    const template = String(
      (row as { template: string }).template,
    ) as EmailTemplate;
    const userId = String((row as { user_id: string }).user_id);
    const tripId = (row as { trip_id: string | null }).trip_id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const to = profile && typeof profile.email === "string" ? profile.email.trim() : "";
    if (!to) {
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          error: "No profile email",
        })
        .eq("id", id);
      results.failed += 1;
      results.errors.push(`${id}: no email`);
      continue;
    }

    let data: Record<string, unknown> = { siteUrl };

    if (template === "welcome") {
      data = { siteUrl };
    } else if (
      tripId &&
      (template === "countdown_3d" || template === "followup_1d")
    ) {
      const { data: trip } = await supabase
        .from("trips")
        .select("adventure_name, start_date, end_date, region_id")
        .eq("id", tripId)
        .maybeSingle();

      if (!trip) {
        await supabase
          .from("email_queue")
          .update({ status: "failed", error: "Trip missing" })
          .eq("id", id);
        results.failed += 1;
        continue;
      }

      const t = trip as {
        adventure_name: string;
        start_date: string;
        end_date: string;
        region_id: string | null;
      };

      let destinationName = "your destination";
      if (t.region_id) {
        const { data: reg } = await supabase
          .from("regions")
          .select("short_name, name")
          .eq("id", t.region_id)
          .maybeSingle();
        if (reg && typeof reg === "object") {
          const r = reg as { short_name?: string; name?: string };
          destinationName =
            (r.short_name?.trim() || r.name?.trim() || destinationName) ??
            destinationName;
        }
      }

      const tripUrl = `${siteUrl}/planner`;
      if (template === "countdown_3d") {
        const start = parseDate(t.start_date);
        const today = new Date();
        const daysUntil = Math.max(
          0,
          Math.floor(
            (stripLocalMidnight(start) - stripLocalMidnight(today)) /
              86400000,
          ),
        );
        data = {
          adventureName: t.adventure_name,
          destinationName,
          tripUrl,
          daysUntil: daysUntil > 0 ? daysUntil : 3,
        };
      } else {
        data = {
          adventureName: t.adventure_name,
          destinationName,
          tripUrl,
        };
      }
    }

    if (
      template === "invite" ||
      template === "year_review" ||
      template === "share_notification"
    ) {
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          error: "Template not supported via queue",
        })
        .eq("id", id);
      results.failed += 1;
      continue;
    }

    const sendResult = await sendTemplatedEmail({
      to,
      template,
      data,
    });

    if (!sendResult.ok) {
      await supabase
        .from("email_queue")
        .update({ status: "failed", error: sendResult.error })
        .eq("id", id);
      results.failed += 1;
      results.errors.push(`${id}: ${sendResult.error}`);
      continue;
    }

    await supabase
      .from("email_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", id);
    results.sent += 1;
  }

  const todayKey = formatDateKey(new Date());

  const { data: pendingRem, error: remErr } = await supabase
    .from("trip_reminders")
    .select("id, trip_id, days_before")
    .is("sent_at", null)
    .limit(200);

  if (remErr) {
    results.errors.push(`trip_reminders: ${remErr.message}`);
  } else {
    for (const row of pendingRem ?? []) {
      const remId = String((row as { id: string }).id);
      const tripId = String((row as { trip_id: string }).trip_id);
      const daysBefore = Number((row as { days_before: number }).days_before);

      const { data: trip } = await supabase
        .from("trips")
        .select(
          "start_date, adventure_name, region_id, owner_id, email_reminders",
        )
        .eq("id", tripId)
        .maybeSingle();

      if (!trip || typeof trip !== "object") {
        await supabase.from("trip_reminders").delete().eq("id", remId);
        continue;
      }

      const t = trip as {
        start_date: string;
        adventure_name: string;
        region_id: string | null;
        owner_id: string;
        email_reminders: boolean | null;
      };

      if (t.email_reminders === false) {
        continue;
      }

      const triggerKey = reminderTriggerDateKey(t.start_date, daysBefore);
      if (triggerKey !== todayKey) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, email_marketing_opt_out")
        .eq("id", t.owner_id)
        .maybeSingle();

      const pr = profile as {
        email?: string | null;
        email_marketing_opt_out?: boolean | null;
      } | null;

      if (pr?.email_marketing_opt_out === true) {
        continue;
      }

      const to =
        pr && typeof pr.email === "string" ? pr.email.trim() : "";
      if (!to) {
        await supabase
          .from("trip_reminders")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", remId);
        continue;
      }

      let destinationName = "your destination";
      if (t.region_id) {
        const { data: reg } = await supabase
          .from("regions")
          .select("short_name, name")
          .eq("id", t.region_id)
          .maybeSingle();
        if (reg && typeof reg === "object") {
          const r = reg as { short_name?: string; name?: string };
          destinationName =
            (r.short_name?.trim() || r.name?.trim() || destinationName) ??
            destinationName;
        }
      }

      const tripUrl = `${siteUrl}/planner`;
      const subject = reminderSubject(daysBefore);
      const extras = reminderExtraLines(daysBefore, t.region_id);
      const bulletLines = [...reminderDefaultBullets(daysBefore), ...extras];

      const sendResult = await sendTemplatedEmail({
        to,
        template: "trip_reminder" as EmailTemplate,
        data: {
          siteUrl,
          adventureName: t.adventure_name,
          destinationName,
          tripUrl,
          daysBefore,
          subject,
          bulletLines,
        },
      });

      if (!sendResult.ok) {
        results.failed += 1;
        results.errors.push(`reminder ${remId}: ${sendResult.error}`);
        continue;
      }

      await supabase
        .from("trip_reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", remId);
      results.sent += 1;
    }
  }

  return NextResponse.json(results);
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
