"use client";

import { updateTripPlanningPreferencesAction } from "@/actions/trips";
import { showToast } from "@/lib/toast";
import type {
  PlanningDisneyLightningLane,
  PlanningMobility,
  PlanningUniversalExpress,
  TripPlanningPreferences,
} from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MOBILITY: { id: PlanningMobility; label: string }[] = [
  { id: "none", label: "None" },
  { id: "stroller", label: "Stroller" },
  { id: "wheelchair", label: "Wheelchair" },
  { id: "prefer_shorter_walks", label: "Prefer shorter walks" },
];

const SAVE_WATCHDOG_MS = 30_000;

export function PlanStrategyMiniWizard({
  open,
  tripId,
  initialPrefs,
  tripAdults,
  tripChildren,
  tripChildAges,
  showDisney,
  showUniversal,
  presentation = "overlay",
  helpCtaLabel = "AI Day Strategy",
  onClose,
  onSaved,
  onRetryStrategyGenerate,
}: {
  open: boolean;
  tripId: string;
  initialPrefs: TripPlanningPreferences | null;
  tripAdults: number;
  tripChildren: number;
  tripChildAges: number[];
  showDisney: boolean;
  showUniversal: boolean;
  /** `embedded` = panel only (for nesting inside another modal). */
  presentation?: "overlay" | "embedded";
  /** Shown in timeout copy (e.g. "Plan this day" when embedded). */
  helpCtaLabel?: string;
  onClose: () => void;
  onSaved: (
    prefs: TripPlanningPreferences,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRetryStrategyGenerate?: () => Promise<
    { ok: true } | { ok: false; error: string }
  >;
}) {
  const base = useMemo((): TripPlanningPreferences => {
    if (initialPrefs) return { ...initialPrefs };
    return {
      pace: "balanced",
      mustDoParks: [],
      priorities: [],
      additionalNotes: null,
      adults: tripAdults,
      children: tripChildren,
      childAges: tripChildAges,
      mobility: "none",
    };
  }, [initialPrefs, tripAdults, tripChildren, tripChildAges]);

  const [mobility, setMobility] = useState<PlanningMobility>(
    base.mobility ?? "none",
  );
  const [heights, setHeights] = useState<number[]>(() => {
    const ch = base.childHeights ?? [];
    const out: number[] = [];
    for (let i = 0; i < tripChildren; i++) {
      out.push(ch[i]?.heightCm ?? 100);
    }
    return out;
  });
  const [disneyLL, setDisneyLL] = useState<PlanningDisneyLightningLane>(
    base.disneyLightningLane ?? {
      multiPassStatus: "not_sure",
      singlePassWillingToPay: "not_sure",
      memoryMaker: "not_sure",
    },
  );
  const [univEx, setUnivEx] = useState<PlanningUniversalExpress>(
    base.universalExpress ?? {
      status: "not_sure",
      singleRiderOk: "sometimes",
    },
  );
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveTimedOut, setSaveTimedOut] = useState(false);
  const saveGenerationRef = useRef(0);

  const resetTransientUi = useCallback(() => {
    setSaveError(null);
    setSaveTimedOut(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetTransientUi();
      setBusy(false);
    }
  }, [open, resetTransientUi]);

  useEffect(() => {
    if (!busy || !open) return;
    const t = window.setTimeout(() => {
      saveGenerationRef.current += 1;
      setSaveTimedOut(true);
      setBusy(false);
    }, SAVE_WATCHDOG_MS);
    return () => clearTimeout(t);
  }, [busy, open]);

  const save = useCallback(async () => {
    const myGen = ++saveGenerationRef.current;
    resetTransientUi();
    setBusy(true);
    try {
      const childHeights =
        tripChildren > 0
          ? heights.slice(0, tripChildren).map((heightCm, i) => ({
              ageOrIndex: tripChildAges[i] ?? i,
              heightCm,
            }))
          : undefined;
      const next: TripPlanningPreferences = {
        ...base,
        mobility,
        ...(childHeights && childHeights.length > 0 ? { childHeights } : {}),
        ...(showDisney ? { disneyLightningLane: { ...disneyLL } } : {}),
        ...(showUniversal ? { universalExpress: { ...univEx } } : {}),
      };
      const res = await updateTripPlanningPreferencesAction({
        tripId,
        planningPreferences: next,
      });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      const out = await onSaved(next);
      if (myGen !== saveGenerationRef.current) return;
      if (out.ok) {
        onClose();
      } else {
        setSaveError(out.error);
      }
    } finally {
      if (myGen === saveGenerationRef.current) {
        setBusy(false);
      }
    }
  }, [
    base,
    mobility,
    heights,
    tripChildren,
    tripChildAges,
    showDisney,
    showUniversal,
    disneyLL,
    univEx,
    tripId,
    onSaved,
    onClose,
    resetTransientUi,
  ]);

  const retryStrategyOnly = useCallback(async () => {
    if (!onRetryStrategyGenerate) return;
    const myGen = ++saveGenerationRef.current;
    setSaveError(null);
    setSaveTimedOut(false);
    setBusy(true);
    try {
      const out = await onRetryStrategyGenerate();
      if (myGen !== saveGenerationRef.current) return;
      if (out.ok) {
        onClose();
      } else {
        setSaveError(out.error);
      }
    } finally {
      if (myGen === saveGenerationRef.current) {
        setBusy(false);
      }
    }
  }, [onRetryStrategyGenerate, onClose]);

  if (!open) return null;

  const embedded = presentation === "embedded";

  const panel = (
      <div
        role="dialog"
        aria-modal="true"
        className={
          embedded
            ? "max-h-[min(70vh,28rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-gold/30 bg-cream p-5 shadow-lg sm:rounded-2xl sm:p-6"
            : "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-gold/30 bg-cream p-6 shadow-2xl sm:rounded-2xl"
        }
      >
        <h2 className="font-serif text-lg font-semibold text-royal">
          {embedded
            ? "A few details to finish planning this day"
            : "We need a few quick details to tailor your day"}
        </h2>
        <p className="mt-2 font-sans text-sm text-royal/75">
          {embedded
            ? "Save once — we&apos;ll generate your ride strategy in this window."
            : "Save once — we&apos;ll continue with your AI Day Strategy."}
        </p>

        {saveTimedOut ? (
          <div className="mt-6 space-y-4">
            <p className="font-sans text-sm leading-relaxed text-royal/85">
              Taking longer than expected — your details are saved. You can
              close this and tap{" "}
              <span className="font-semibold">{helpCtaLabel}</span> again on
              that day.
            </p>
            <button
              type="button"
              className="min-h-[44px] w-full rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : saveError ? (
          <div className="mt-6 space-y-4">
            <p className="font-sans text-sm leading-relaxed text-royal/85">
              We saved your details, but couldn&apos;t finish the strategy.{" "}
              <span className="font-medium text-royal">{saveError}</span> Try
              again, or close and run{" "}
              <span className="font-semibold">{helpCtaLabel}</span> from the day
              view.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {onRetryStrategyGenerate ? (
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-[44px] flex-1 rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream disabled:opacity-50"
                  onClick={() => void retryStrategyOnly()}
                >
                  {busy ? "Working…" : "Try again"}
                </button>
              ) : null}
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-lg border border-royal/25 bg-white px-4 py-2 font-sans text-sm text-royal"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              <div>
                <label className="font-sans text-sm font-semibold text-royal">
                  Mobility
                </label>
                <select
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={mobility}
                  onChange={(e) =>
                    setMobility(e.target.value as PlanningMobility)
                  }
                >
                  {MOBILITY.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {tripChildren > 0
                ? heights.slice(0, tripChildren).map((h, i) => (
                    <label key={i} className="block font-sans text-sm text-royal">
                      Child {i + 1} height (cm)
                      <input
                        type="number"
                        min={40}
                        max={200}
                        className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-3"
                        value={h}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (Number.isNaN(v)) return;
                          setHeights((prev) => {
                            const n = [...prev];
                            n[i] = v;
                            return n;
                          });
                        }}
                      />
                    </label>
                  ))
                : null}

              {showDisney ? (
                <div className="rounded-xl border border-royal/10 bg-white/80 p-3">
                  <p className="font-sans text-sm font-semibold text-royal">
                    Disney — queues
                  </p>
                  <p className="mt-2 font-sans text-xs text-royal/70">
                    Multi Pass
                  </p>
                  <select
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-2"
                    value={disneyLL.multiPassStatus}
                    onChange={(e) =>
                      setDisneyLL((d) => ({
                        ...d,
                        multiPassStatus: e.target
                          .value as PlanningDisneyLightningLane["multiPassStatus"],
                      }))
                    }
                  >
                    <option value="all_park_days">All park days</option>
                    <option value="some_park_days">Some park days</option>
                    <option value="none">No</option>
                    <option value="not_sure">Not sure</option>
                  </select>
                  <p className="mt-2 font-sans text-xs text-royal/70">
                    Single Pass willingness
                  </p>
                  <select
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-2"
                    value={disneyLL.singlePassWillingToPay}
                    onChange={(e) =>
                      setDisneyLL((d) => ({
                        ...d,
                        singlePassWillingToPay: e.target
                          .value as PlanningDisneyLightningLane["singlePassWillingToPay"],
                      }))
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="not_sure">Not sure</option>
                  </select>
                  <p className="mt-2 font-sans text-xs text-royal/70">
                    Memory Maker
                  </p>
                  <select
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-2"
                    value={disneyLL.memoryMaker}
                    onChange={(e) =>
                      setDisneyLL((d) => ({
                        ...d,
                        memoryMaker: e.target
                          .value as PlanningDisneyLightningLane["memoryMaker"],
                      }))
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="not_sure">Not sure</option>
                  </select>
                </div>
              ) : null}

              {showUniversal ? (
                <div className="rounded-xl border border-royal/10 bg-white/80 p-3">
                  <p className="font-sans text-sm font-semibold text-royal">
                    Universal — Express &amp; Single Rider
                  </p>
                  <p className="mt-2 font-sans text-xs text-royal/70">Express</p>
                  <select
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-2"
                    value={univEx.status}
                    onChange={(e) =>
                      setUnivEx((u) => ({
                        ...u,
                        status: e.target.value as PlanningUniversalExpress["status"],
                      }))
                    }
                  >
                    <option value="included_with_hotel">
                      Included with hotel
                    </option>
                    <option value="paid">Paid</option>
                    <option value="no">No</option>
                    <option value="not_sure">Not sure</option>
                  </select>
                  <p className="mt-2 font-sans text-xs text-royal/70">
                    Single rider OK?
                  </p>
                  <select
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-2"
                    value={univEx.singleRiderOk}
                    onChange={(e) =>
                      setUnivEx((u) => ({
                        ...u,
                        singleRiderOk: e.target
                          .value as PlanningUniversalExpress["singleRiderOk"],
                      }))
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-lg border border-royal/25 bg-white px-4 py-2 font-sans text-sm text-royal"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-[44px] flex-1 rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream disabled:opacity-50"
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save & continue"}
              </button>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) {
    return <div className="w-full max-w-lg">{panel}</div>;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-royal/50 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      {panel}
    </div>
  );
}
