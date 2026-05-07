"use client";

import { Button } from "@/components/ui/Button";
import { showToast } from "@/lib/toast";
import { useCallback, useState } from "react";

export function ManageSubscriptionButton({
  label = "Manage subscription",
  variant = "primary",
  openInNewTab = false,
}: {
  label?: string;
  variant?: "primary" | "link";
  openInNewTab?: boolean;
}) {
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
        showToast(j.error ?? "Could not open billing portal.", {
          type: "error",
        });
        return;
      }
      if (openInNewTab) {
        window.open(j.url, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = j.url;
      }
    } finally {
      setBusy(false);
    }
  }, [openInNewTab]);

  if (variant === "link") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void openPortal()}
        className="mt-3 inline-flex min-h-11 items-center font-sans text-sm font-semibold text-tt-royal underline decoration-tt-gold/50 underline-offset-4 hover:text-tt-royal/80 disabled:opacity-50"
      >
        {busy ? "Opening…" : label}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="primary"
      size="md"
      className="mt-2 w-full sm:w-auto"
      loading={busy}
      loadingLabel="Opening…"
      onClick={() => void openPortal()}
    >
      {label}
    </Button>
  );
}
