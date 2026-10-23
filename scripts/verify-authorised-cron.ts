import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.log("blocked missing supabase");
    process.exit(2);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const { count: dueEmails, error: emailError } = await admin
    .from("email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("scheduled_for", now);
  if (emailError) {
    console.log("email count error", emailError.code);
    process.exit(2);
  }
  if ((dueEmails ?? 0) > 0) {
    console.log("blocked due emails", dueEmails);
    process.exit(2);
  }

  const secret = randomBytes(24).toString("hex");
  process.env.CRON_SECRET = secret;
  const { GET } = await import("../src/app/api/cron/process-emails/route");
  const denied = await GET(
    new NextRequest("http://127.0.0.1:3001/api/cron/process-emails", {
      headers: { authorization: "Bearer wrong" },
    }),
  );
  const authorised = await GET(
    new NextRequest("http://127.0.0.1:3001/api/cron/process-emails", {
      headers: { authorization: `Bearer ${secret}` },
    }),
  );
  const body = (await authorised.json()) as {
    ok?: boolean;
    sent?: number;
    failed?: number;
    errors?: unknown;
  };
  console.log(
    JSON.stringify({
      denied: denied.status,
      authorised: authorised.status,
      ok: body.ok === true,
      sent: typeof body.sent === "number" ? body.sent : null,
      failed: typeof body.failed === "number" ? body.failed : null,
      errorCount: Array.isArray(body.errors) ? body.errors.length : null,
    }),
  );

  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { GET: waitGet } = await import(
    "../src/app/api/cron/live-wait-ingest/route"
  );
  const waitDenied = await waitGet(
    new NextRequest("http://127.0.0.1:3001/api/cron/live-wait-ingest", {
      headers: { authorization: "Bearer wrong" },
    }),
  );
  const waitMissing = await waitGet(
    new NextRequest("http://127.0.0.1:3001/api/cron/live-wait-ingest", {
      headers: { authorization: `Bearer ${secret}` },
    }),
  );
  const waitBody = (await waitMissing.json()) as { error?: string };
  console.log(
    JSON.stringify({
      waitDenied: waitDenied.status,
      waitMissingConfig: waitMissing.status,
      waitError: waitBody.error === "Missing Supabase configuration",
    }),
  );
}

main();
