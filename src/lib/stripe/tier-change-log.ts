/** Structured audit log for tier / subscription transitions (grep: tier-change). */
export function logTierChange(payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      kind: "tier-change",
      at: new Date().toISOString(),
      ...payload,
    }),
  );
}
