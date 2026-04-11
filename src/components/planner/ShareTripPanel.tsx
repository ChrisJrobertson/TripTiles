"use client";

import { updateTripSharingAction } from "@/actions/trips";
import { useCallback, useEffect, useState } from "react";

type Props = {
  tripId: string;
  isPublic: boolean;
  publicSlug: string | null;
  siteUrl: string;
  cloneCount?: number;
  viewCount?: number;
};

export function ShareTripPanel({
  tripId,
  isPublic: initialPublic,
  publicSlug: initialSlug,
  siteUrl,
  cloneCount = 0,
  viewCount = 0,
}: Props) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [publicSlug, setPublicSlug] = useState(initialSlug);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsPublic(initialPublic);
    setPublicSlug(initialSlug);
  }, [initialPublic, initialSlug]);

  const base = siteUrl.replace(/\/$/, "") || "";
  const shareUrl =
    publicSlug && base ? `${base}/plans/${publicSlug}` : "";

  const onToggle = useCallback(
    async (enabled: boolean) => {
      setLoading(true);
      setMsg(null);
      try {
        const res = await updateTripSharingAction({ tripId, enabled });
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setIsPublic(res.isPublic);
        setPublicSlug(res.publicSlug);
        if (res.isPublic && res.publicSlug) {
          setMsg(
            "Anyone with the link can view your plan and clone it. Your name stays private.",
          );
        } else {
          setMsg("This trip is private again. Your link is saved if you re-publish.");
        }
      } finally {
        setLoading(false);
      }
    },
    [tripId],
  );

  const copy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMsg("Link copied.");
    } catch {
      setMsg("Copy the link manually.");
    }
  }, [shareUrl]);

  return (
    <div className="rounded-xl border border-royal/10 bg-white px-4 py-3 font-sans text-sm text-royal shadow-sm">
      <p className="font-sans text-xs font-semibold text-royal/70">
        Community sharing
      </p>
      <label className="mt-2 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-royal/35 accent-royal"
          checked={isPublic}
          disabled={loading}
          onChange={(e) => void onToggle(e.target.checked)}
        />
        <span>Make this trip public</span>
      </label>
      <p className="mt-2 text-xs leading-relaxed text-royal/60">
        {cloneCount} clones · {viewCount} views on the public page
      </p>
      {isPublic && shareUrl ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <code className="max-w-full flex-1 truncate rounded bg-cream px-2 py-1 text-xs">
            {shareUrl}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-lg bg-royal px-3 py-1 text-xs font-semibold text-cream"
          >
            Copy link
          </button>
        </div>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-royal/65">{msg}</p> : null}
    </div>
  );
}
