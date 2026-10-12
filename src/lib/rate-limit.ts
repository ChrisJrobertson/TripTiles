/**
 * Process-local fixed-window limiter.
 *
 * Each Node process keeps its own counters. That stops accidental bursts on
 * one instance and is deterministic in tests. It is not a shared edge limiter:
 * serverless isolates do not see each other's counts.
 */

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
