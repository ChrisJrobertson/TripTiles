"use client";

import { cloneTripAction } from "@/actions/trips";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  sourceTripId: string;
  slug: string;
  isAuthed: boolean;
};

export function PublicPlanActions({ sourceTripId, slug, isAuthed }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoCloneStarted = useRef(false);

  const runClone = useCallback(async () => {
    setBusy(true);
    setError(null);
    const r = await cloneTripAction(sourceTripId);
    setBusy(false);
    if (!r.ok) {
      if (r.error === "TIER_LIMIT") {
        setError("You’ve reached your trip limit on this account. Upgrade to add more.");
      } else {
        setError(r.error);
      }
      return;
    }
    const dest =
      r.skippedCustomTiles > 0
        ? `/planner?tile_scrubbed=${r.skippedCustomTiles}`
        : "/planner";
    router.replace(dest);
    router.refresh();
  }, [sourceTripId, router]);

  useEffect(() => {
    if (!isAuthed || searchParams.get("clone") !== "1") return;
    if (autoCloneStarted.current) return;
    autoCloneStarted.current = true;
    void runClone();
  }, [isAuthed, searchParams, runClone]);

  const onCloneClick = () => {
    if (!isAuthed) {
      router.push(
        `/login?next=${encodeURIComponent(`/plans/${slug}?clone=1`)}`,
      );
      return;
    }
    void runClone();
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void onCloneClick()}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gold px-5 py-2.5 font-sans text-sm font-bold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-60"
      >
        {busy ? "Cloning…" : "Clone this plan"}
      </button>
      {error ? (
        <p className="max-w-xs text-right font-sans text-xs text-red-600">
          {error}{" "}
          {error.includes("trip limit") ? (
            <Link href="/pricing" className="font-semibold underline">
              Pricing
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
