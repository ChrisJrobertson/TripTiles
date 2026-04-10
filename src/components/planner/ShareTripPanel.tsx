"use client";

import { updateTripSharingAction } from "@/actions/trips";
import { useCallback, useEffect, useState } from "react";

type Props = {
  tripId: string;
  isPublic: boolean;
  publicSlug: string | null;
  siteUrl: string;
};

export function ShareTripPanel({
  tripId,
  isPublic: initialPublic,
  publicSlug: initialSlug,
  siteUrl,
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
    publicSlug && base ? `${base}/p/${publicSlug}` : "";

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
          setMsg("Anyone with the link can view — not edit.");
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
        Share read-only link
      </p>
      <label className="mt-2 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-royal/35 accent-royal"
          checked={isPublic}
          disabled={loading}
          onChange={(e) => void onToggle(e.target.checked)}
        />
        <span>Enable public link</span>
      </label>
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
            Copy
          </button>
        </div>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-royal/65">{msg}</p> : null}
    </div>
  );
}
