/**
 * Fixed-window limiter.
 *
 * `consumeRateLimit` is process-local and is the deterministic fallback.
 * `consumeSharedRateLimit` stores a hash of the key in Postgres so serverless
 * isolates share one window. If that write is unavailable, it falls back to
 * the process-local counter rather than failing open with no limit.
 */
import { createHash } from "node:crypto";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
};

const hitsByKey = new Map<string, number[]>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  if (!key.trim()) {
    throw new Error("rate limit key is required");
  }
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("rate limit must be at least 1");
  }
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("rate limit window must be positive");
  }

  const windowStart = now - windowMs;
  const hits = (hitsByKey.get(key) ?? []).filter((at) => at > windowStart);
  if (hits.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    hitsByKey.set(key, hits);
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  hits.push(now);
  hitsByKey.set(key, hits);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: limit - hits.length,
  };
}

/** Test-only reset. Production callers should not clear counters. */
export function resetRateLimitsForTests(): void {
  hitsByKey.clear();
}

/** SHA-256 hex. The database stores this, not the email, IP, or user id. */
export function hashRateLimitBucket(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

type SharedRow = {
  allowed?: boolean;
  retry_after_sec?: number;
  remaining?: number;
};

function rowFromRpc(data: unknown): RateLimitResult | null {
  const row = (Array.isArray(data) ? data[0] : data) as SharedRow | null;
  if (!row || typeof row.allowed !== "boolean") return null;
  const retryAfterSec = Number(row.retry_after_sec ?? 0);
  const remaining = Number(row.remaining ?? 0);
  if (!Number.isFinite(retryAfterSec) || !Number.isFinite(remaining)) return null;
  return {
    allowed: row.allowed,
    retryAfterSec: Math.max(0, retryAfterSec),
    remaining: Math.max(0, remaining),
  };
}

/**
 * Shared window when the service-role RPC is available. Falls back to the
 * process-local limiter if the database call fails.
 */
export async function consumeSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/service-role");
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_bucket: hashRateLimitBucket(key),
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) return consumeRateLimit(key, limit, windowMs, now);
    const shared = rowFromRpc(data);
    if (!shared) return consumeRateLimit(key, limit, windowMs, now);
    return shared;
  } catch {
    return consumeRateLimit(key, limit, windowMs, now);
  }
}
