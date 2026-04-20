"use client";

import type { ProductTier } from "@/lib/product-tier-labels";
import { useCallback, useState } from "react";

const LABELS: Record<ProductTier, string> = {
  free: "Free",
  pro: "Pro",
  family: "Family",
};

export function DevTierWidget() {
  const [busy, setBusy] = useState<ProductTier | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const setTier = useCallback(async (tier: ProductTier) => {
    setErr(null);
    setBusy(tier);
    try {
      const res = await fetch("/api/dev/set-profile-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? `Request failed (${res.status})`);
        return;
      }
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <section className="mt-8 rounded-xl border border-dashed border-amber-400/60 bg-amber-50/40 px-4 py-4">
      <h2 className="font-serif text-base font-semibold text-royal">
        Dev: product tier
      </h2>
      <p className="mt-1 font-sans text-xs text-royal/70">
        Updates your <code className="rounded bg-white/80 px-1">profiles.tier</code>{" "}
        row (no Stripe). Reloads the page after each change.
      </p>
      {err ? (
        <p className="mt-2 font-sans text-xs text-red-800">{err}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(LABELS) as ProductTier[]).map((tier) => (
          <button
            key={tier}
            type="button"
            disabled={busy !== null}
            className="min-h-11 min-w-[7.5rem] flex-1 rounded-lg border border-royal/20 bg-white px-3 font-sans text-xs font-semibold text-royal shadow-sm hover:bg-cream disabled:opacity-50 sm:flex-none"
            onClick={() => void setTier(tier)}
          >
            {busy === tier ? "…" : LABELS[tier]}
          </button>
        ))}
      </div>
    </section>
  );
}
