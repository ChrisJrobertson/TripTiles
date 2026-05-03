"use client";

import {
  confirmTweakDay,
  popDaySnapshot,
  tweakDay,
  type DayTweakProposed,
} from "@/actions/ai";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { formatUndoSnapshotHint, parseDate } from "@/lib/date-helpers";
import { showToast } from "@/lib/toast";
import type {
  Assignments,
  DaySnapshot,
  Park,
  SlotAssignmentValue,
  SlotType,
  Trip,
} from "@/lib/types";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "smart_suggest" | "freetext";

type Props = {
  open: boolean;
  trip: Trip;
  date: string;
  parks: Park[];
  onClose: () => void;
  onApplied: (patch: {
    assignments: Assignments;
    preferences: Record<string, unknown>;
    day_snapshots: DaySnapshot[];
  }) => void;
  onTierLimit: (message: string) => void;
};

const SLOTS: { key: SlotType; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

function formatDayTitle(date: string): string {
  return parseDate(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function slotLabel(
  assignments: Partial<Record<SlotType, SlotAssignmentValue>>,
  parks: Map<string, string>,
  slot: SlotType,
): string {
  const id = getParkIdFromSlotValue(assignments[slot]);
  return id ? (parks.get(id) ?? id) : "Empty";
}

function snapshotForDate(trip: Trip, date: string): DaySnapshot | null {
  return [...(trip.day_snapshots ?? [])]
    .filter((snap) => snap.date === date)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function DayTweakModal({
  open,
  trip,
  date,
  parks,
  onClose,
  onApplied,
  onTierLimit,
}: Props) {
  const [mode, setMode] = useState<Mode>("smart_suggest");
  const [preview, setPreview] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"generate" | "save" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<DayTweakProposed | null>(null);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setMode("smart_suggest");
    setText("");
    setError(null);
    setProposed(null);
    setCancelled(false);
    cancelledRef.current = false;
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("triptiles.aiDayPreviewDefault")
        : null;
    setPreview(saved == null ? true : saved === "true");
  }, [open, trip.id, date]);

  const parkNames = useMemo(
    () => new Map(parks.map((park) => [park.id, park.name] as const)),
    [parks],
  );
  const latestSnapshot = snapshotForDate(trip, date);
  const snapshotCount = (trip.day_snapshots ?? []).filter(
    (snap) => snap.date === date,
  ).length;
  const currentDay = trip.assignments[date] ?? {};
  const dayTitle = formatDayTitle(date);

  if (!open) return null;

  async function runGenerate() {
    if (busy) return;
    setBusy("generate");
    setError(null);
    setCancelled(false);
    cancelledRef.current = false;
    try {
      const res = await tweakDay({
        tripId: trip.id,
        date,
        mode,
        freetext: mode === "freetext" ? text.trim() : undefined,
        preview,
      });
      if (cancelledRef.current) return;
      if (res.status === "error") {
        if (res.code === "tier_limit") onTierLimit(res.error);
        else setError(res.error);
        return;
      }
      if (res.status === "preview") {
        setProposed(res.proposed);
        setModel(res.model);
        return;
      }
      if (res.status === "applied") {
        onApplied({
          assignments: res.assignments,
          preferences: res.preferences,
          day_snapshots: res.daySnapshots,
        });
        showToast("AI tweak applied.");
        onClose();
      }
    } finally {
      setBusy(null);
    }
  }

  async function savePreview() {
    if (!proposed || busy) return;
    setBusy("save");
    setError(null);
    try {
      const res = await confirmTweakDay({
        tripId: trip.id,
        date,
        mode,
        proposed,
        model,
      });
      if (res.status === "error") {
        if (res.code === "tier_limit") onTierLimit(res.error);
        else setError(res.error);
        return;
      }
      if (res.status === "applied") {
        onApplied({
          assignments: res.assignments,
          preferences: res.preferences,
          day_snapshots: res.daySnapshots,
        });
        showToast("AI tweak applied.");
        onClose();
      }
    } finally {
      setBusy(null);
    }
  }

  async function undoLatest() {
    if (busy) return;
    const ok = window.confirm(
      latestSnapshot
        ? `Undo the AI tweak from ${formatUndoSnapshotHint(latestSnapshot.created_at)}? This restores the day to its previous state.`
        : "Undo the last AI tweak?",
    );
    if (!ok) return;
    setBusy("undo");
    try {
      const res = await popDaySnapshot(trip.id, date);
      if (!res.restored) {
        showToast(res.error ?? "Nothing to undo.");
        return;
      }
      onApplied({
        assignments: res.assignments,
        preferences: res.preferences,
        day_snapshots: res.daySnapshots,
      });
      showToast("Reverted.");
    } finally {
      setBusy(null);
    }
  }

  const afterDay = proposed?.assignments_for_day ?? {};

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-royal/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-tweak-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/40 bg-cream p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="day-tweak-title" className="font-serif text-xl font-semibold text-royal">
              ✨ AI tweak — {dayTitle}
            </h2>
            <p className="mt-1 font-sans text-sm text-royal/70">
              Existing tiles on other days will not change.
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-lg border border-royal/15 bg-white text-royal"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!proposed ? (
          <>
            <div className="mt-5 grid gap-2 rounded-xl bg-white/70 p-1 sm:grid-cols-3">
              <button
                type="button"
                className={`min-h-11 rounded-lg px-3 font-sans text-sm font-semibold ${
                  mode === "smart_suggest" ? "bg-royal text-cream" : "text-royal"
                }`}
                onClick={() => setMode("smart_suggest")}
              >
                Smart suggest
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-lg px-3 font-sans text-sm font-semibold ${
                  mode === "freetext" ? "bg-royal text-cream" : "text-royal"
                }`}
                onClick={() => setMode("freetext")}
              >
                Tell the AI
              </button>
              <label className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 font-sans text-sm font-semibold text-royal">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-royal/35 accent-royal"
                  checked={preview}
                  onChange={(e) => {
                    setPreview(e.target.checked);
                    window.localStorage.setItem(
                      "triptiles.aiDayPreviewDefault",
                      String(e.target.checked),
                    );
                  }}
                />
                Preview
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-royal/10 bg-white/90 p-4">
              {mode === "smart_suggest" ? (
                <>
                  <h3 className="font-serif text-lg font-semibold text-royal">
                    Smart suggest
                  </h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                    The AI will propose a fresh plan for {dayTitle} based on your
                    trip preferences and this day&apos;s slots.
                  </p>
                </>
              ) : (
                <label className="block">
                  <span className="font-serif text-lg font-semibold text-royal">
                    Tell the AI what to change
                  </span>
                  <textarea
                    value={text}
                    maxLength={500}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-lg border border-royal/20 bg-cream/50 px-3 py-2 font-sans text-sm text-royal"
                    placeholder="Make this a rest day, swap Magic Kingdom for Epcot, or give us a quieter morning."
                  />
                  <span className="mt-1 block text-right font-sans text-xs text-royal/50">
                    {text.length}/500
                  </span>
                </label>
              )}
            </div>
          </>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-royal/10 bg-white p-4">
              <h3 className="font-serif text-lg font-semibold text-royal">Before</h3>
              <dl className="mt-3 space-y-2 font-sans text-sm">
                {SLOTS.map(({ key, label }) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="font-semibold text-royal/65">{label}</dt>
                    <dd className="text-right text-royal">{slotLabel(currentDay, parkNames, key)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl border border-gold/40 bg-white p-4">
              <h3 className="font-serif text-lg font-semibold text-royal">After</h3>
              <dl className="mt-3 space-y-2 font-sans text-sm">
                {SLOTS.map(({ key, label }) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="font-semibold text-royal/65">{label}</dt>
                    <dd className="text-right text-royal">{slotLabel(afterDay, parkNames, key)}</dd>
                  </div>
                ))}
              </dl>
              {proposed.note ? (
                <p className="mt-4 rounded-lg bg-cream px-3 py-2 font-sans text-sm text-royal/75">
                  Day note: {proposed.note}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-900">
            {error}
          </p>
        ) : null}
        {cancelled ? (
          <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 font-sans text-sm text-royal">
            Cancelled — try again?
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {proposed ? (
            <>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void savePreview()}
                className="min-h-11 flex-1 rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream disabled:opacity-60"
              >
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => {
                  setProposed(null);
                  void runGenerate();
                }}
                className="min-h-11 rounded-lg border border-royal/20 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal"
              >
                Try again
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy != null || (mode === "freetext" && !text.trim())}
              onClick={() => void runGenerate()}
              className="min-h-11 flex-1 rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream disabled:opacity-60"
            >
              {busy === "generate" ? (
                <span className="inline-flex items-center gap-2">
                  <LogoSpinner size="sm" variant="onDark" decorative />
                  Generating…
                </span>
              ) : (
                "Generate"
              )}
            </button>
          )}
          <button
            type="button"
            disabled={busy === "save" || busy === "undo"}
            onClick={() => {
              if (busy === "generate") {
                setCancelled(true);
                cancelledRef.current = true;
                setBusy(null);
                return;
              }
              onClose();
            }}
            className="min-h-11 rounded-lg border border-royal/20 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal"
          >
            Cancel
          </button>
        </div>

        {latestSnapshot ? (
          <p className="mt-4 font-sans text-xs text-royal/60">
            Last AI tweak on this day:{" "}
            {formatUndoSnapshotHint(latestSnapshot.created_at)} ·{" "}
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void undoLatest()}
              className="font-semibold text-royal underline decoration-gold/50 underline-offset-2"
            >
              Undo
            </button>
            {snapshotCount > 1 ? ` (${snapshotCount} saved changes)` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
