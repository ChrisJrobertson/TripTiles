/**
 * Proves the shared limiter is one window in Postgres, and that the anonymous
 * role cannot call it or read the bucket table.
 *
 * Run: node --env-file=.env.local --import tsx scripts/verify-shared-rate-limit.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  consumeSharedRateLimit,
  hashRateLimitBucket,
} from "../src/lib/rate-limit";

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anon || !serviceKey) fail("Missing Supabase credentials");

  const key = `rate-limit-probe:${crypto.randomUUID()}`;
  const bucket = hashRateLimitBucket(key);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const first = await consumeSharedRateLimit(key, 1, 60_000);
    const second = await consumeSharedRateLimit(key, 1, 60_000);
    if (!first.allowed || first.remaining !== 0) fail("First shared hit was not allowed");
    if (second.allowed) fail("Second shared hit was allowed inside the same window");

    const { data, error } = await admin
      .from("rate_limit_buckets")
      .select("hits")
      .eq("bucket", bucket)
      .maybeSingle();
    if (error || !data) fail("Shared bucket was not stored");
    if (Number(data.hits) < 2) fail("Shared bucket did not count both hits");

    const anonRead = await fetch(
      `${url}/rest/v1/rate_limit_buckets?select=bucket&limit=1`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
    );
    if (anonRead.status !== 401 && anonRead.status !== 403) {
      const body = await anonRead.text();
      if (body.includes(bucket)) fail("Anonymous client read a rate-limit bucket");
      if (anonRead.status === 200) fail("Anonymous client could select rate-limit buckets");
    }

    const anonCall = await fetch(`${url}/rest/v1/rpc/consume_rate_limit`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_bucket: bucket, p_limit: 1, p_window_ms: 1000 }),
    });
    if (anonCall.ok) fail("Anonymous client executed consume_rate_limit");

    console.log("shared-rate-limit: one database window; anonymous execute denied");
  } finally {
    await admin.from("rate_limit_buckets").delete().eq("bucket", bucket);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Shared rate limit check failed");
  process.exit(1);
});
