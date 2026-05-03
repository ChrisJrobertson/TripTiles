"use client";

import {
  updateTripPublicViewLabelsAction,
  updateTripSharingAction,
} from "@/actions/trips";
import { getPublicViewFormValues } from "@/lib/public-trip-display";
import { copyTextToClipboard } from "@/lib/clipboard-access";
import type { Trip } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Props = {
  tripId: string;
  /** Trip for public-label fields (not sent to the wire except via actions). */
  trip: Pick<Trip, "preferences" | "adventure_name" | "is_public" | "public_slug">;
  isPublic: boolean;
  publicSlug: string | null;
  siteUrl: string;
  canPublishPublic: boolean;
  cloneCount?: number;
  viewCount?: number;
};

export function ShareTripPanel({
  tripId,
  trip: tripProp,
  isPublic: initialPublic,
  publicSlug: initialSlug,
  siteUrl,
  canPublishPublic,
  cloneCount = 0,
  viewCount = 0,
}: Props) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [publicSlug, setPublicSlug] = useState(initialSlug);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingLabels, setSavingLabels] = useState(false);
  const initialForm = getPublicViewFormValues(tripProp);
  const [familyLabel, setFamilyLabel] = useState(initialForm.familyLabel);
  const [adventureTitle, setAdventureTitle] = useState(
    initialForm.adventureTitle,
  );

  useEffect(() => {
    setIsPublic(initialPublic);
    setPublicSlug(initialSlug);
  }, [initialPublic, initialSlug]);

  useEffect(() => {
    const v = getPublicViewFormValues(tripProp);
    setFamilyLabel(v.familyLabel);
    setAdventureTitle(v.adventureTitle);
  }, [tripProp]);

  const base = siteUrl.replace(/\/$/, "") || "";
  const shareUrl = publicSlug && base ? `${base}/plans/${publicSlug}` : "";

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
            "Anyone with the link can view and clone. Your private family name in the trip header is never shown — use the fields below for the public page, or we show a generic label.",
          );
        } else {
          setMsg(
            "This trip is private again. Your link is saved if you re-publish.",
          );
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
      await copyTextToClipboard(shareUrl);
      setMsg("Link copied.");
    } catch {
      setMsg("Copy the link manually.");
    }
  }, [shareUrl]);

  const savePublicLabels = useCallback(async () => {
    setSavingLabels(true);
    setMsg(null);
    try {
      const res = await updateTripPublicViewLabelsAction({
        tripId,
        familyLabel,
        adventureTitle,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg("Public page labels saved.");
      router.refresh();
    } finally {
      setSavingLabels(false);
    }
  }, [tripId, familyLabel, adventureTitle, router]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-royal/10 bg-white px-4 py-3 font-sans text-sm text-royal shadow-sm">
        <p className="font-sans text-xs font-semibold text-royal/70">
          Community sharing
        </p>
        <label className="mt-2 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-royal/35 accent-royal"
            checked={isPublic}
            disabled={loading || (!canPublishPublic && !isPublic)}
            onChange={(e) => void onToggle(e.target.checked)}
          />
          <span>Make this trip public</span>
        </label>
        {!canPublishPublic && !isPublic ? (
          <p className="mt-2 text-xs leading-relaxed text-royal/65">
            Public sharing is included with Pro and Family plans.
          </p>
        ) : null}
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

      {isPublic ? (
        <div className="rounded-xl border border-royal/10 bg-cream/60 px-4 py-3 font-sans text-sm text-royal shadow-sm">
          <p className="text-xs font-semibold text-royal/80">
            Public page name (anonymise if you like)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-royal/60">
            Visitors never see the private <strong>Family</strong> name you use
            in the planner. Set friendly labels for the shared /plans page, or
            leave the first line blank to show &ldquo;Travelling party&rdquo;.
            Leave the title blank to use your trip name (
            {tripProp.adventure_name || "—"}).
          </p>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-royal/70">
              Public group line
            </span>
            <input
              type="text"
              value={familyLabel}
              onChange={(e) => setFamilyLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 text-sm"
              placeholder="e.g. A family of four (optional)"
              autoComplete="off"
            />
          </label>
          <label className="mt-2 block">
            <span className="text-xs font-medium text-royal/70">
              Public trip title (optional)
            </span>
            <input
              type="text"
              value={adventureTitle}
              onChange={(e) => setAdventureTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 text-sm"
              placeholder={`Default: ${tripProp.adventure_name || "Your trip name"}`}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={() => void savePublicLabels()}
            disabled={savingLabels}
            className="mt-3 rounded-lg border border-royal/20 bg-white px-4 py-2 text-xs font-semibold text-royal transition hover:border-gold/50 disabled:opacity-50"
          >
            {savingLabels ? "Saving…" : "Save public labels"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
