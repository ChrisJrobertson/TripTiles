"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SESSION_KEY = "triptiles_purchase_banner_dismissed";

type Props = {
  /** From URL (?purchase=pending etc.) — server-detected. */
  highlight: boolean;
  /** Nested inside PlannerTopNotices — tighter padding, no outer radius. */
  embedded?: boolean;
};

export function PurchaseHelpBanner({ highlight, embedded }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (highlight) {
        setDismissed(false);
        return;
      }
      setDismissed(sessionStorage.getItem(SESSION_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [highlight]);

  const hide = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="status"
      className={
        embedded
          ? "rounded-lg border border-royal/10 bg-white/95 px-3 py-2 font-sans text-xs leading-snug text-royal/90 shadow-sm"
          : "mx-auto mb-4 max-w-6xl rounded-xl border border-gold/40 bg-white px-4 py-3 font-sans text-sm text-royal shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1">
          <strong className="font-semibold text-royal">Purchased?</strong> Use
          the <strong>same email</strong> as TripTiles. Upgrades can take a
          minute — refresh or{" "}
          <Link href="/feedback" className="text-gold underline">
            contact us
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={hide}
          className="shrink-0 rounded-md border border-royal/15 px-2 py-0.5 text-[0.65rem] font-medium text-royal/60 hover:bg-cream"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
