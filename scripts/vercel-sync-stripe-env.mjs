/**
 * Upsert Stripe-related env vars on Vercel from local .env.local values.
 * Requires VERCEL_TOKEN (create at vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=xxx node scripts/vercel-sync-stripe-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ID = "prj_1oHeZJTsbX4a7iMhyx8bCZk0KwbP";
const TEAM_ID = "team_V1tzZ1Xyjz9BzEZKwvvREZjf";

const KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_FAMILY_MONTHLY",
  "STRIPE_PRICE_FAMILY_ANNUAL",
  "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY",
  "NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL",
  "NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY",
  "NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL",
];

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

const token = process.env.VERCEL_TOKEN?.trim();
if (!token) {
  console.error("Set VERCEL_TOKEN (vercel.com/account/tokens)");
  process.exit(1);
}

// Mirror server price ids to NEXT_PUBLIC when missing locally
const mirror = [
  ["STRIPE_PRICE_PRO_MONTHLY", "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY"],
  ["STRIPE_PRICE_PRO_ANNUAL", "NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL"],
  ["STRIPE_PRICE_FAMILY_MONTHLY", "NEXT_PUBLIC_STRIPE_PRICE_FAMILY_MONTHLY"],
  ["STRIPE_PRICE_FAMILY_ANNUAL", "NEXT_PUBLIC_STRIPE_PRICE_FAMILY_ANNUAL"],
];
for (const [src, dst] of mirror) {
  const v = process.env[src]?.trim();
  if (v && !process.env[dst]?.trim()) process.env[dst] = v;
}

const base = `https://api.vercel.com/v10/projects/${PROJECT_ID}/env`;
const q = `?teamId=${TEAM_ID}`;

async function listEnv() {
  const res = await fetch(`${base}${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`list env: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.envs ?? [];
}

async function upsert(key, value) {
  const type = key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted";
  const existing = (await listEnv()).find((e) => e.key === key);
  if (existing) {
    const res = await fetch(`${base}/${existing.id}${q}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value,
        target: ["production", "preview", "development"],
        type,
      }),
    });
    if (!res.ok) throw new Error(`patch ${key}: ${res.status} ${await res.text()}`);
    console.log(`updated ${key}`);
    return;
  }
  const res = await fetch(`${base}${q}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type,
      target: ["production", "preview", "development"],
    }),
  });
  if (!res.ok) throw new Error(`create ${key}: ${res.status} ${await res.text()}`);
  console.log(`created ${key}`);
}

for (const key of KEYS) {
  const value = process.env[key]?.trim();
  if (!value || value.includes("...")) {
    console.log(`skip ${key} (unset or placeholder)`);
    continue;
  }
  await upsert(key, value);
}

console.log("Done. Redeploy production for NEXT_PUBLIC_* changes to apply.");
