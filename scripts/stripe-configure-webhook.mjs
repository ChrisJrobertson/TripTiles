/**
 * Ensure Stripe webhook endpoint exists with required subscription events.
 * Usage: node scripts/stripe-configure-webhook.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path, override = false) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || !process.env[key]) process.env[key] = val;
  }
}

const root = resolve(import.meta.dirname, "..");
loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, ".env.local"), true);

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret || secret.includes("...")) {
  console.error("STRIPE_SECRET_KEY missing or placeholder in .env.local");
  process.exit(1);
}

const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
];

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.triptiles.app";
const webhookUrl = `${siteUrl}/api/webhooks/stripe`;

async function stripe(path, method = "GET", body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return JSON.parse(text);
}

const { data: endpoints } = await stripe("/webhook_endpoints?limit=20");
let endpoint = endpoints?.find(
  (ep) =>
    ep.url === webhookUrl ||
    ep.url?.endsWith("/api/webhooks/stripe"),
);

if (!endpoint) {
  const params = new URLSearchParams();
  params.set("url", webhookUrl);
  for (const ev of REQUIRED_EVENTS) params.append("enabled_events[]", ev);
  endpoint = await stripe("/webhook_endpoints", "POST", params);
  console.log(`Created webhook endpoint ${endpoint.id} → ${webhookUrl}`);
  console.log(
    "Add signing secret to STRIPE_WEBHOOK_SECRET / Vercel env (Dashboard → Webhooks → signing secret).",
  );
  process.exit(0);
}

const current = new Set(endpoint.enabled_events ?? []);
const missing = REQUIRED_EVENTS.filter((e) => !current.has(e));
if (missing.length === 0) {
  console.log(`Webhook ${endpoint.id} already has all required events.`);
  process.exit(0);
}

const merged = [...new Set([...current, ...REQUIRED_EVENTS])];
const params = new URLSearchParams();
for (const ev of merged) params.append("enabled_events[]", ev);
const updated = await stripe(
  `/webhook_endpoints/${endpoint.id}`,
  "POST",
  params,
);
console.log(
  `Updated webhook ${updated.id}: added events ${missing.join(", ")}`,
);
