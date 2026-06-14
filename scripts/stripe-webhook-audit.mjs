/**
 * Audit Stripe webhook endpoints and subscription price env alignment.
 * Usage: node scripts/stripe-webhook-audit.mjs
 * Loads .env.local then .env (no secrets printed).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
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
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = resolve(import.meta.dirname, "..");
loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, ".env.local"));

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

const priceKeys = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_FAMILY_MONTHLY",
  "STRIPE_PRICE_FAMILY_ANNUAL",
  "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY",
  "NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL",
  "NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY",
  "NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL",
];

console.log("=== Stripe price env (set / unset only) ===");
for (const k of priceKeys) {
  console.log(`${k}: ${process.env[k]?.trim() ? "set" : "MISSING"}`);
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://www.triptiles.app";
const webhookUrl = `${siteUrl}/api/webhooks/stripe`;

const res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=20", {
  headers: { Authorization: `Bearer ${secret}` },
});
if (!res.ok) {
  console.error("Stripe API error:", res.status, await res.text());
  process.exit(1);
}
const { data: endpoints } = await res.json();

console.log("\n=== Webhook endpoints ===");
if (!endpoints?.length) {
  console.log("No webhook endpoints configured.");
}

let matched = null;
for (const ep of endpoints ?? []) {
  const events = ep.enabled_events ?? [];
  const missing = REQUIRED_EVENTS.filter((e) => !events.includes(e));
  console.log(`\n${ep.id}`);
  console.log(`  url: ${ep.url}`);
  console.log(`  status: ${ep.status}`);
  console.log(`  enabled_events: ${events.length}`);
  if (missing.length) console.log(`  missing_events: ${missing.join(", ")}`);
  else console.log("  all_required_events: yes");
  if (ep.url === webhookUrl || ep.url?.includes("/api/webhooks/stripe")) {
    matched = ep;
  }
}

if (!matched) {
  console.log(`\nNo endpoint matches ${webhookUrl}`);
  console.log("Create one in Stripe Dashboard or via API.");
} else {
  console.log(`\nProduction webhook matched: ${matched.id}`);
}
