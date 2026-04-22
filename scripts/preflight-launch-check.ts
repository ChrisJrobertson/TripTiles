/**
 * Read-only pre-launch diagnostic for TripTiles production.
 * Run: node --env-file=.env.local ./node_modules/.bin/tsx scripts/preflight-launch-check.ts
 * Or:  npx tsx scripts/preflight-launch-check.ts  (after: export $(grep -v '^#' .env.local | xargs) — or use node --env-file)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveTxt, resolveMx } from "node:dns";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const resolveTxtAsync = promisify(resolveTxt);
const resolveMxAsync = promisify(resolveMx);

/** Load .env.local when not injected (e.g. plain `npx tsx`). */
function loadEnvLocal(): void {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

type Level = "PASS" | "WARN" | "FAIL";
const summary = { PASS: 0, WARN: 0, FAIL: 0 };
const failures: string[] = [];

function line(level: Level, msg: string): string {
  summary[level] += 1;
  const icon =
    level === "PASS" ? green("✅") : level === "WARN" ? yellow("⚠️") : red("❌");
  if (level === "FAIL") failures.push(msg);
  return `${icon} ${msg}`;
}

function envVarPresent(v: string | undefined): Level {
  if (v != null && String(v).trim() !== "") return "PASS";
  return "FAIL";
}

async function fetchStatus(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; err?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: "follow",
    });
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      err: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

async function main(): Promise<void> {
  const runAt = new Date().toISOString();
  const out: string[] = [];

  out.push("# TripTiles Pre-Launch Diagnostic");
  out.push(`Run at: ${runAt}`);
  out.push("");

  // --- Environment variables ---
  out.push("## Environment variables");
  const hasAnon = envVarPresent(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === "PASS";
  const hasPublishable =
    envVarPresent(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) === "PASS";
  if (hasAnon || hasPublishable) {
    const which = [hasAnon && "ANON", hasPublishable && "PUBLISHABLE"].filter(Boolean).join(" + ");
    out.push(line("PASS", `Supabase public client key (${which}) present`));
  } else {
    out.push(
      line(
        "FAIL",
        "Set NEXT_PUBLIC_SUPABASE_ANON_KEY and/or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (at least one required)",
      ),
    );
  }

  const requiredSimple = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "ANTHROPIC_API_KEY",
    "RESEND_API_KEY",
    "CRON_SECRET",
    "NEXT_PUBLIC_PAYHIP_PRO_URL",
    "NEXT_PUBLIC_PAYHIP_FAMILY_URL",
    "NEXT_PUBLIC_PAYHIP_PREMIUM_URL",
    "NEXT_PUBLIC_BOOKING_AFFILIATE_ID",
    "NEXT_PUBLIC_GYG_PARTNER_ID",
  ] as const;

  for (const key of requiredSimple) {
    const v = process.env[key];
    const lev = envVarPresent(v);
    if (lev === "PASS") {
      out.push(line("PASS", `${key}: present`));
      if (key === "NEXT_PUBLIC_SITE_URL") {
        const u = String(v).trim().replace(/\/$/, "");
        if (u !== "https://www.triptiles.app") {
          out.push(
            line(
              "WARN",
              `NEXT_PUBLIC_SITE_URL is not exactly https://www.triptiles.app (got ${u}) — expected for local dev; use production URL in Vercel for launch`,
            ),
          );
        }
      }
      if (
        (key === "NEXT_PUBLIC_BOOKING_AFFILIATE_ID" ||
          key === "NEXT_PUBLIC_GYG_PARTNER_ID") &&
        (String(v).trim() === "placeholder" ||
          String(v).trim().toUpperCase() === "TODO")
      ) {
        out.push(line("WARN", `${key} is set to placeholder/TODO`));
      }
    } else {
      out.push(line(lev, `${key}: missing`));
    }
  }

  if (envVarPresent(process.env.PAYHIP_WEBHOOK_SECRET) === "PASS") {
    out.push(line("PASS", "PAYHIP_WEBHOOK_SECRET: present (legacy; Stripe is primary)"));
  } else {
    out.push(
      line(
        "WARN",
        "PAYHIP_WEBHOOK_SECRET: missing — OK if you only use Stripe; set in Vercel if Payhip webhooks are still wired",
      ),
    );
  }
  out.push("");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !serviceKey) {
    out.push("## Database state");
    out.push(line("FAIL", "Cannot query database: missing Supabase URL or service role key"));
    out.push("");
    printReport(out);
    process.exit(1);
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Database ---
  out.push("## Database state");

  async function count(table: string): Promise<number | null> {
    const { count, error } = await admin.from(table).select("*", {
      count: "exact",
      head: true,
    });
    if (error) return null;
    return count ?? 0;
  }

  const purchasesN = await count("purchases");
  if (purchasesN !== null) {
    out.push(`- purchases: ${purchasesN} rows`);
    if (purchasesN > 0) {
      out.push(line("WARN", `purchases: expected 0 before test purchase — found ${purchasesN}`));
    } else {
      out.push(line("PASS", "purchases: 0 rows (no test purchase yet)"));
    }
  } else {
    out.push(line("FAIL", "purchases: could not count"));
  }

  const { error: pheErr } = await admin.from("payhip_webhook_events").select("id").limit(1);
  if (pheErr && (pheErr.message.includes("does not exist") || pheErr.code === "PGRST205")) {
    out.push(
      line(
        "WARN",
        "payhip_webhook_events: table not found (Payhip dropped in favour of Stripe — expected)",
      ),
    );
  } else if (pheErr) {
    out.push(line("FAIL", `payhip_webhook_events: ${pheErr.message}`));
  } else {
    const n = await count("payhip_webhook_events");
    out.push(`- payhip_webhook_events: ${n ?? "?"} rows`);
  }

  const collabN = await count("trip_collaborators");
  out.push(`- trip_collaborators: ${collabN ?? "?"} rows`);
  if (collabN !== null && collabN > 0) {
    out.push(line("WARN", `trip_collaborators: ${collabN} (expected 0 for pristine pre-test)`));
  }

  const statusLabels = ["pending", "queued", "sent", "failed"] as const;
  const byStatus: Record<string, number> = {};
  for (const st of statusLabels) {
    const { count, error: ceq } = await admin
      .from("email_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", st);
    if (!ceq) byStatus[st] = count ?? 0;
  }
  const eqTotal = await count("email_queue");
  out.push(`- email_queue: ${eqTotal ?? "?"} total rows`);
  out.push(`  - by status (pending / queued / sent / failed): ${JSON.stringify(byStatus)}`);

  const feedbackN = await count("feedback");
  out.push(`- feedback: ${feedbackN ?? "?"} rows`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: genSpend } = await admin
    .from("ai_generations")
    .select("cost_gbp_pence")
    .gte("created_at", thirtyDaysAgo.toISOString());
  let sumPence = 0;
  for (const r of genSpend ?? []) {
    const c = (r as { cost_gbp_pence: number | null }).cost_gbp_pence;
    if (typeof c === "number") sumPence += c;
  }
  const genTotalN = await count("ai_generations");
  out.push(
    `- ai_generations: ${genTotalN ?? "?"} rows; cost_gbp_pence sum (last 30d): ${(sumPence / 100).toFixed(2)} GBP`,
  );

  const { count: pubTrips } = await admin
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("is_public", true);
  out.push(`- trips (is_public = true): ${pubTrips ?? 0}`);

  const { data: tiers } = await admin.from("profiles").select("tier");
  const tierCount: Record<string, number> = {};
  for (const r of tiers ?? []) {
    const t = String((r as { tier: string }).tier ?? "unknown");
    tierCount[t] = (tierCount[t] ?? 0) + 1;
  }
  out.push(`- profiles by tier: ${JSON.stringify(tierCount)}`);

  const { data: latestGen } = await admin
    .from("ai_generations")
    .select("created_at, model, success, error")
    .order("created_at", { ascending: false })
    .limit(3);
  out.push("- latest 3 ai_generations:");
  for (const r of latestGen ?? []) {
    const row = r as {
      created_at: string;
      model: string;
      success: boolean | null;
      error: string | null;
    };
    out.push(
      `  - ${row.created_at} | ${row.model} | success=${row.success} | error=${row.error ? String(row.error).slice(0, 80) : "null"}`,
    );
  }
  out.push("");

  // --- Schema sanity ---
  out.push("## Schema sanity");

  const expectedParks = [
    "mk",
    "ep",
    "hs",
    "ak",
    "us",
    "ioa",
    "eu",
    "dl",
    "dca",
    "dlp",
    "wdsp",
    "hkdl",
  ];
  const missingAttr: string[] = [];
  for (const parkId of expectedParks) {
    const { count: c, error: ce } = await admin
      .from("attractions")
      .select("*", { count: "exact", head: true })
      .eq("park_id", parkId);
    if (ce) {
      missingAttr.push(parkId + "(err)");
    } else if (!c || c === 0) {
      missingAttr.push(parkId);
    }
  }
  if (missingAttr.length === 0) {
    out.push(
      line(
        "PASS",
        `attractions: at least one row for each of 12 park_ids (${expectedParks.join(", ")})`,
      ),
    );
  } else {
    out.push(
      line("FAIL", `attractions: missing or zero rows for: ${missingAttr.join(", ")}`),
    );
  }
  out.push(
    `ℹ️ Note: international batch 1 uses **wdsp** (Walt Disney Studios Paris), not \`wds\`.`,
  );

  const { count: featRegions } = await admin
    .from("regions")
    .select("*", { count: "exact", head: true })
    .eq("is_featured", true);
  if (featRegions && featRegions > 0) {
    out.push(
      line("PASS", `regions: ${featRegions} rows with is_featured = true (destination picker)`),
    );
  } else {
    out.push(
      line(
        "FAIL",
        "regions: no is_featured rows — landing / wizard destination grid may be empty",
      ),
    );
  }
  out.push(
    `ℹ️ \`parks\` has no is_featured column; featured destinations use **regions.is_featured**.`,
  );

  const achN = await count("achievement_definitions");
  if (achN !== null && achN > 0) {
    out.push(line("PASS", `achievement_definitions: ${achN} rows`));
  } else {
    out.push(line("FAIL", "achievement_definitions: empty or unreadable"));
  }

  const regionsN = await count("regions");
  if (regionsN === 43) {
    out.push(line("PASS", "regions: 43 rows (matches project overview)"));
  } else {
    out.push(
      line("WARN", `regions: ${regionsN ?? "?"} rows (expected 43 per overview — verify if OK)`),
    );
  }
  out.push("");

  // --- URL reachability ---
  out.push("## URL reachability");
  const base = "https://www.triptiles.app";
  const urlChecks: { label: string; path: string; good: (n: number) => boolean }[] = [
    {
      label: "/api/webhooks/payhip",
      path: "/api/webhooks/payhip",
      good: (n) => n === 405 || n === 404,
    },
    {
      label: "/api/webhooks/stripe (Stripe; Payhip removed)",
      path: "/api/webhooks/stripe",
      good: (n) => n === 405 || n === 400,
    },
    { label: "/api/cron/process-emails", path: "/api/cron/process-emails", good: (n) => n === 401 },
    { label: "/", path: "/", good: (n) => n === 200 },
    { label: "/pricing", path: "/pricing", good: (n) => n === 200 },
    { label: "/sitemap.xml", path: "/sitemap.xml", good: (n) => n === 200 },
    { label: "/robots.txt", path: "/robots.txt", good: (n) => n === 200 },
  ];
  for (const u of urlChecks) {
    const r = await fetchStatus(`${base}${u.path}`);
    if (!r.ok) {
      out.push(line("FAIL", `${u.label}: ${r.err ?? "timeout"}`));
    } else if (u.good(r.status)) {
      out.push(line("PASS", `${u.label}: ${r.status}`));
    } else {
      out.push(line("FAIL", `${u.label}: HTTP ${r.status} (unexpected)`));
    }
  }
  for (const og of ["/opengraph-image", "/opengraph-image.png"]) {
    const r = await fetchStatus(`${base}${og}`);
    if (r.ok && (r.status === 200 || r.status === 304)) {
      out.push(line("PASS", `${og}: ${r.status}`));
    } else if (r.ok) {
      out.push(line("WARN", `${og}: HTTP ${r.status}`));
    } else {
      out.push(line("FAIL", `${og}: ${r.err}`));
    }
  }
  out.push("");

  // --- RLS (anon) ---
  out.push("## RLS (anon key)");
  if (!anonKey) {
    out.push(line("FAIL", "No anon key — cannot run RLS checks"));
  } else {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    {
      const { data, error } = await anon.from("profiles").select("id").limit(1);
      if (error) {
        if (error.message.includes("RLS") || error.message.includes("permission") || error.code === "42501") {
          out.push(line("PASS", `profiles: anon blocked (${error.message.slice(0, 70)})`));
        } else {
          out.push(line("FAIL", `profiles: ${error.message}`));
        }
      } else {
        const len = Array.isArray(data) ? data.length : 0;
        out.push(
          line(len === 0 ? "PASS" : "FAIL", `profiles: anon ${len === 0 ? "received 0 rows" : `leaked ${len} row(s)`}`),
        );
      }
    }
    {
      const { data, error } = await anon.from("purchases").select("id").limit(1);
      if (error) {
        if (error.message.includes("RLS") || error.message.includes("permission") || error.code === "42501") {
          out.push(line("PASS", `purchases: anon blocked (${error.message.slice(0, 70)})`));
        } else {
          out.push(line("FAIL", `purchases: ${error.message}`));
        }
      } else {
        const len = Array.isArray(data) ? data.length : 0;
        out.push(
          line(len === 0 ? "PASS" : "FAIL", `purchases: anon ${len === 0 ? "received 0 rows" : `leaked ${len} row(s)`}`),
        );
      }
    }
    {
      const { data, error } = await anon.from("parks").select("id").limit(1);
      if (error) {
        out.push(line("FAIL", `parks: ${error.message}`));
      } else {
        const len = Array.isArray(data) ? data.length : 0;
        out.push(
          line(len > 0 ? "PASS" : "FAIL", `parks: anon ${len > 0 ? `read OK (${len} row sample)` : "0 rows"}`),
        );
      }
    }
    {
      const { data, error } = await anon.from("regions").select("id").limit(1);
      if (error) {
        out.push(line("FAIL", `regions: ${error.message}`));
      } else {
        const len = Array.isArray(data) ? data.length : 0;
        out.push(
          line(len > 0 ? "PASS" : "FAIL", `regions: anon ${len > 0 ? `read OK (${len} row sample)` : "0 rows"}`),
        );
      }
    }
    {
      const { data, error } = await anon
        .from("trips")
        .select("id, is_public")
        .eq("is_public", true)
        .limit(1);
      if (error) {
        out.push(line("FAIL", `trips (public): ${error.message}`));
      } else {
        const len = Array.isArray(data) ? data.length : 0;
        out.push(
          line(
            "PASS",
            `trips (is_public = true): ${len} row(s) visible to anon (OK if zero or published plans exist)`,
          ),
        );
      }
    }
  }
  out.push("");

  // --- Resend ---
  out.push("## Resend");
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    out.push(line("FAIL", "RESEND_API_KEY missing — cannot call Resend API"));
  } else {
    const rr = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (!rr.ok) {
      out.push(line("FAIL", `Resend domains API: HTTP ${rr.status}`));
    } else {
      const body = (await rr.json()) as { data?: Array<{ name: string; status: string; region?: string }> };
      const domains = body.data ?? [];
      out.push(line("PASS", `Resend: ${domains.length} domain(s) listed`));
      for (const d of domains) {
        out.push(`  - ${d.name}: status=${d.status}${d.region ? ` region=${d.region}` : ""}`);
        if (d.name?.includes("triptiles") && d.status !== "verified") {
          out.push(line("WARN", `triptiles domain not verified: ${d.status}`));
        }
      }
    }
  }
  out.push("");

  // --- DNS ---
  out.push("## DNS");
  const root = "triptiles.app";
  try {
    const mx = await resolveMxAsync(root);
    const hasIcloud = mx.some((m) => m.exchange?.includes("icloud.com"));
    if (hasIcloud) {
      out.push(line("PASS", `MX: ${mx.map((m) => m.exchange).join(", ")}`));
    } else {
      out.push(line("WARN", `MX: ${JSON.stringify(mx)} — iCloud not obvious; verify for your mail host`));
    }
  } catch (e) {
    out.push(line("FAIL", `MX lookup: ${e instanceof Error ? e.message : e}`));
  }

  let spfCount = 0;
  let spfWithBoth = false;
  try {
    const txts = await resolveTxtAsync(root);
    for (const arr of txts) {
      for (const record of arr) {
        if (record.toLowerCase().includes("v=spf1")) {
          spfCount += 1;
          const l = record.toLowerCase();
          if (l.includes("include:icloud.com") && l.includes("include:amazonses.com")) {
            spfWithBoth = true;
          }
        }
      }
    }
    if (spfCount === 0) {
      out.push(line("WARN", "No SPF (v=spf1) TXT on apex — email deliverability may suffer"));
    } else if (spfCount > 1) {
      out.push(line("FAIL", `SPF: ${spfCount} TXT records with v=spf1 — must merge to one`));
    } else if (spfWithBoth) {
      out.push(line("PASS", "SPF: single record includes iCloud and Amazon SES"));
    } else {
      out.push(
        line("WARN", "SPF: one record but missing include:icloud.com and/or include:amazonses.com"),
      );
    }
  } catch (e) {
    out.push(line("FAIL", `TXT/SPF: ${e instanceof Error ? e.message : e}`));
  }

  try {
    const dkim = await resolveTxtAsync("resend._domainkey.triptiles.app");
    const flat = dkim.flat();
    if (flat.length) {
      out.push(line("PASS", "DKIM: resend._domainkey has TXT (Resend)"));
    } else {
      out.push(line("WARN", "DKIM: no TXT at resend._domainkey.triptiles.app"));
    }
  } catch {
    out.push(line("WARN", "DKIM: resend._domainkey lookup failed (may be normal if not using Resend domain)"));
  }

  try {
    const dmarc = await resolveTxtAsync(`_dmarc.${root}`);
    const f = dmarc.flat().join(" ");
    if (f) {
      out.push(line("PASS", `_dmarc: present`));
    } else {
      out.push(line("WARN", "_dmarc: missing (recommended)"));
    }
  } catch {
    out.push(line("WARN", "_dmarc: lookup failed or missing"));
  }
  out.push("");

  // --- Anthropic ---
  out.push("## Anthropic");
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    out.push(line("FAIL", "ANTHROPIC_API_KEY missing"));
  } else {
    const t0 = Date.now();
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      out.push(
        line("PASS", `Haiku reachable (${Date.now() - t0}ms). Response not logged.`),
      );
    } catch (e) {
      out.push(
        line("FAIL", `Anthropic: ${e instanceof Error ? e.message : String(e)}`),
      );
    }
  }
  out.push("");

  // --- Cron last run ---
  out.push("## Cron (email last sent)");
  const { data: lastSent } = await admin
    .from("email_queue")
    .select("sent_at, status")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1);
  const sentAt = lastSent?.[0] as { sent_at: string } | undefined;
  if (sentAt?.sent_at) {
    const d = new Date(sentAt.sent_at);
    const hours = (Date.now() - d.getTime()) / 36e5;
    out.push(`- Most recent sent_at: ${sentAt.sent_at}`);
    if (hours > 24) {
      out.push(
        line(
          "WARN",
          "No email sent in last 24h — cron may not be running (check Vercel cron + CRON_SECRET)",
        ),
      );
    } else {
      out.push(line("PASS", "Email sent within last 24h"));
    }
  } else {
    out.push(
      line("WARN", "No rows with sent_at set — cron may never have sent, or email_queue empty"),
    );
  }
  out.push("");

  // --- Legal ---
  out.push("## Legal pages");
  for (const path of ["/privacy", "/terms"] as const) {
    const r = await fetchStatus(`${base}${path}`);
    if (!r.ok || r.status !== 200) {
      out.push(line("FAIL", `${path}: HTTP ${r.status} ${r.err ?? ""}`));
    } else {
      const tr = await fetch(`${base}${path}`);
      const text = await tr.text();
      if (text.includes("[YOUR UK REGISTERED ADDRESS]")) {
        out.push(
          line("FAIL", `${path}: still contains [YOUR UK REGISTERED ADDRESS]`),
        );
      } else {
        out.push(line("PASS", `${path}: no UK address placeholder`));
      }
    }
  }
  out.push("");

  // --- Summary ---
  out.push("## Summary");
  out.push(`PASS: ${summary.PASS}`);
  out.push(`WARN: ${summary.WARN}`);
  out.push(`FAIL: ${summary.FAIL}`);
  out.push("");
  out.push("## Action required (failures)");
  if (failures.length === 0) {
    out.push("None (no FAIL items).");
  } else {
    failures.forEach((f, i) => out.push(`${i + 1}. ${f}`));
  }

  printReport(out);
  process.exit(summary.FAIL > 0 ? 1 : 0);
}

function printReport(lines: string[]): void {
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
