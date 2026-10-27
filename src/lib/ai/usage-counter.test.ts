/**
 * Run: npx tsx src/lib/ai/usage-counter.test.ts
 */
import assert from "node:assert/strict";
import {
  canGenerateFromUsage,
  incrementLifetimeOnStore,
  parseLifetimeCount,
  type UsageStore,
} from "./usage-counter";

function memoryStore(initial: Record<string, number>): UsageStore {
  const rows = { ...initial };
  return {
    async readLifetime(userId) {
      if (!(userId in rows)) throw new Error("not found");
      return rows[userId];
    },
    async writeLifetime(userId, nextTotal) {
      if (!(userId in rows)) throw new Error("not found");
      rows[userId] = nextTotal;
    },
  };
}

async function run() {
  assert.equal(parseLifetimeCount(0), 0);
  assert.equal(parseLifetimeCount(4), 4);
  assert.equal(parseLifetimeCount("5"), 5);
  assert.equal(parseLifetimeCount(undefined), 0);
  assert.equal(parseLifetimeCount(null), 0);
  assert.equal(parseLifetimeCount(-1), null);
  assert.equal(parseLifetimeCount(Number.NaN), null);

  assert.equal(canGenerateFromUsage(0, 5), true);
  assert.equal(canGenerateFromUsage(4, 5), true);
  assert.equal(canGenerateFromUsage(5, 5), false);
  assert.equal(canGenerateFromUsage(6, 5), false);
  assert.equal(canGenerateFromUsage(null, 5), false);
  assert.equal(canGenerateFromUsage(999, null), true);
  assert.equal(canGenerateFromUsage(null, null), true);

  const store = memoryStore({ "user-1": 4 });
  const first = await incrementLifetimeOnStore(store, "user-1");
  assert.deepEqual(first, { ok: true, nextTotal: 5 });
  assert.equal(canGenerateFromUsage(5, 5), false);
  const second = await incrementLifetimeOnStore(store, "user-1");
  assert.deepEqual(second, { ok: true, nextTotal: 6 });

  const missing = await incrementLifetimeOnStore(memoryStore({}), "missing");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /not found/);

  const emptyId = await incrementLifetimeOnStore(memoryStore({}), "  ");
  assert.equal(emptyId.ok, false);

  console.log("usage-counter.test.ts: ok");
}

void run();
