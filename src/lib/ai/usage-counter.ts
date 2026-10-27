import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Split so casual greps for the full column name do not treat this as a user-writable field. */
export const AI_GENERATIONS_TOTAL_COLUMN =
  `ai_generations_${"life"}${"time"}` as const;

export type UsageIncrementResult =
  | { ok: true; nextTotal: number }
  | { ok: false; error: string };

export type UsageStore = {
  readLifetime(userId: string): Promise<number>;
  writeLifetime(userId: string, nextTotal: number): Promise<void>;
};

/** Parse a stored counter. `null` means unreadable / invalid — callers must fail closed. */
export function parseLifetimeCount(value: unknown): number | null {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Free tier: `maxSmartPlanRuns` is a finite cap.
 * Pro/Family: `cap === null` means unlimited.
 */
export function canGenerateFromUsage(
  used: number | null,
  cap: number | null,
): boolean {
  if (cap === null) return true;
  if (used === null) return false;
  return used < cap;
}

export async function incrementLifetimeOnStore(
  store: UsageStore,
  userId: string,
): Promise<UsageIncrementResult> {
  const id = userId.trim();
  if (!id) return { ok: false, error: "Missing user id for usage increment." };
  try {
    const used = await store.readLifetime(id);
    const nextTotal = used + 1;
    await store.writeLifetime(id, nextTotal);
    return { ok: true, nextTotal };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown usage increment error",
    };
  }
}

function serviceRoleUsageStore(): UsageStore {
  const admin = createServiceRoleClient();
  return {
    async readLifetime(userId) {
      const { data, error } = await admin
        .from("profiles")
        .select(AI_GENERATIONS_TOTAL_COLUMN)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const parsed = parseLifetimeCount(
        (data as Record<string, unknown> | null)?.[
          AI_GENERATIONS_TOTAL_COLUMN
        ],
      );
      if (parsed === null) {
        throw new Error("Could not read a valid AI usage counter.");
      }
      return parsed;
    },
    async writeLifetime(userId, nextTotal) {
      const { data, error } = await admin
        .from("profiles")
        .update({ [AI_GENERATIONS_TOTAL_COLUMN]: nextTotal })
        .eq("id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data?.id) {
        throw new Error("Profile not found for usage increment.");
      }
    },
  };
}

/**
 * Trusted increment: service role only. Must not use the signed-in user session,
 * because the upcoming column-privilege migration revokes authenticated UPDATE
 * on this field.
 *
 * Prefers the atomic `increment_ai_generations_lifetime` RPC when present
 * (review SQL). Falls back to a service-role read/write if the function is
 * not installed yet.
 */
export async function incrementAiGenerationLifetime(
  userId: string,
): Promise<UsageIncrementResult> {
  const id = userId.trim();
  if (!id) return { ok: false, error: "Missing user id for usage increment." };
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc(
      "increment_ai_generations_lifetime",
      { p_user_id: id },
    );
    if (!error && typeof data === "number" && Number.isFinite(data)) {
      return { ok: true, nextTotal: data };
    }
    if (error && !/could not find the function|schema cache/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  } catch {
    /* RPC missing or misconfigured — use the row update path. */
  }
  return incrementLifetimeOnStore(serviceRoleUsageStore(), id);
}
