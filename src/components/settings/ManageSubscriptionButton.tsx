"use client";

import { showToast } from "@/lib/toast";
import { useCallback, useState } from "react";

export function ManageSubscriptionButton() {
  const [busy, setBusy] = useState(false);

  const openPortal = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/customer-portal", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) {
        showToast(j.error ?? "Could not open billing portal.", { type: "error" });
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void openPortal()}
      className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-royal/20 bg-white px-5 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-cream disabled:opacity-50"
    >
      {busy ? "Opening…" : "Manage subscription"}
    </button>
  );
}
