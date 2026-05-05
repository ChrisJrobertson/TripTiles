"use client";

import {
  confirmTweakDay,
  generateDayStrategy,
  popDaySnapshot,
  tweakDay,
  type DayTweakMode,
  type DayTweakProposed,
} from "@/actions/ai";
import {
  getProfilePlannerPreferencesAction,
  incrementProfileAiDayPlanModeASuccessCountAction,
  setProfileAiDayPreviewDefaultAction,
} from "@/actions/profile-preferences";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { formatUndoSnapshotHint, parseDate } from "@/lib/date-helpers";
import {
  hasRequiredDayPlanningIntent,
  readDayPlanningIntent,
} from "@/lib/day-planning-intent";
import { dominantThemeParkForAssignments } from "@/lib/dominant-theme-park";
import { showToast } from "@/lib/toast";
import type {
  AIDayStrategy,
  Assignments,
  DayPlanningIntent,
  DaySnapshot,
  Park,
  SlotAssignmentValue,
  SlotType,
  Trip,
  TripPlanningPreferences,
} from "@/lib/types";
import { classifyThemeParkLine } from "@/lib/wizard-queue-step-region";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlanStrategyMiniWizard } from "./PlanStrategyMiniWizard";

const LS_PREVIEW_KEY = "triptiles.aiDayPreviewDefault";

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
  return (
    [...(trip.day_snapshots ?? [])]
      .filter((snap) => snap.date === date)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

export type DayPlannerModalProps = {
  open: boolean;
  trip: Trip;
  date: string;
  parks: Park[];
  /** Used to gate server-side strategy generation; free users see upgrade CTA for Mode B. */
  productTier: string;
  onClose: () => void;
  /** When true once, open on Strategy tab and auto-run generate after mount (mini-wizard if missing data). */
  autoRunStrategy?: boolean;
  onAutoRunStrategyConsumed?: () => void;
  onApplied: (patch: {
    assignments: Assignments;
    preferences: Record<string, unknown>;
    day_snapshots: DaySnapshot[];
  }) => void;
  onTierLimit: (message: string) => void;
  /**
   * After embedded planning prefs save: parent patches client trip state and runs
   * `generateDayStrategy` (see `PlannerClient`). This is the only path from the
   * mini-wizard save handler to strategy generation — the modal does not fall back.
   */
  onPlanPrefsSavedContinueStrategy: (
    prefs: TripPlanningPreferences,
    intent: DayPlanningIntent,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Retry strategy generate from the mini-wizard error UI (parent-owned; typically `runDayStrategyGenerate` only). */
  onRetryStrategyFromMiniWizard: () => Promise<
    { ok: true } | { ok: false; error: string }
  >;
  onStrategySuccess?: (payload: {
    date: string;
    strategy: AIDayStrategy;
  }) => void;
  onRequestStrategyUpgrade?: () => void;
  onNeedsTripRefresh?: () => void;
  /** When opening from “Regenerate strategy”, start on Mode B. */
  initialTab?: "adjust" | "strategy";
};

export function DayPlannerModal({
  open,
  trip,
  date,
  parks,
  productTier,
  onClose,
  autoRunStrategy = false,
  onAutoRunStrategyConsumed,
  onApplied,
  onTierLimit,
  onPlanPrefsSavedContinueStrategy,
  onRetryStrategyFromMiniWizard,
  onStrategySuccess,
  onRequestStrategyUpgrade,
  onNeedsTripRefresh,
  initialTab = "adjust",
}: DayPlannerModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"adjust" | "strategy">("adjust");
  const [tweakMode, setTweakMode] = useState<DayTweakMode>("smart_suggest");
  const [preview, setPreview] = useState(true);
  const [text, setText] = useState("");
  const [tweakBusy, setTweakBusy] = useState<"generate" | "save" | "undo" | null>(
    null,
  );
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<DayTweakProposed | null>(null);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);
  const [miniWizardOpen, setMiniWizardOpen] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const pendingAutoRunStrategyRef = useRef(false);

  useEffect(() => {
    if (!open) {
      pendingAutoRunStrategyRef.current = false;
      return;
    }
    if (autoRunStrategy) pendingAutoRunStrategyRef.current = true;
    else pendingAutoRunStrategyRef.current = false;
  }, [open, autoRunStrategy]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setTweakMode("smart_suggest");
    setText("");
    setError(null);
    setProposed(null);
    setCancelled(false);
    cancelledRef.current = false;
    setMiniWizardOpen(false);
    setPrefsLoading(true);
    setShowUndoConfirm(false);

    let alive = true;
    void (async () => {
      try {
        const res = await getProfilePlannerPreferencesAction();
        if (!alive) return;
        if (!res.ok) {
          setPreview(true);
          return;
        }
        const prefs = res.preferences;

        if (
          typeof window !== "undefined" &&
          prefs.ai_day_preview_default === undefined &&
          window.localStorage.getItem(LS_PREVIEW_KEY) !== null
        ) {
          const raw = window.localStorage.getItem(LS_PREVIEW_KEY);
          const migrated = raw === "true";
          const w = await setProfileAiDayPreviewDefaultAction(migrated);
          if (w.ok) {
            window.localStorage.removeItem(LS_PREVIEW_KEY);
          }
          const again = await getProfilePlannerPreferencesAction();
          if (!alive || !again.ok) {
            setPreview(true);
            return;
          }
          Object.assign(prefs, again.preferences);
        }

        const explicit = prefs.ai_day_preview_default;
        const nextPreview =
          typeof explicit === "boolean" ? explicit : true;
        setPreview(nextPreview);
      } finally {
        if (alive) setPrefsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, trip.id, date, initialTab]);

  const parkById = useMemo(
    () => new Map(parks.map((p) => [p.id, p] as const)),
    [parks],
  );
  const parkNames = useMemo(
    () => new Map(parks.map((park) => [park.id, park.name] as const)),
    [parks],
  );
  const domPark = dominantThemeParkForAssignments(
    trip.assignments ?? {},
    date,
    parkById,
  );
  const parkLine = classifyThemeParkLine(domPark ?? undefined);
  const showDisney = parkLine === "disney";
  const showUniversal = parkLine === "universal";

  const latestSnapshot = snapshotForDate(trip, date);
  const snapshotCount = (trip.day_snapshots ?? []).filter(
    (snap) => snap.date === date,
  ).length;
  const currentDay = trip.assignments[date] ?? {};
  const dayTitle = formatDayTitle(date);
  const subtitleLine = domPark
    ? `${dayTitle} · ${domPark.name}`
    : `${dayTitle} · No theme park assigned`;

  const afterDay = proposed?.assignments_for_day ?? {};
  const existingDayIntent = useMemo(
    () => readDayPlanningIntent(trip.preferences, date),
    [trip.preferences, date],
  );
  const hasCompleteDayIntent = useMemo(
    () =>
      existingDayIntent ? hasRequiredDayPlanningIntent(existingDayIntent) : false,
    [existingDayIntent],
  );

  const runStrategyGenerateCore = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    const res = await generateDayStrategy({ tripId: trip.id, date });

    if (res.status === "success") {
      onStrategySuccess?.({ date, strategy: res.strategy });
      if (onNeedsTripRefresh) onNeedsTripRefresh();
      else router.refresh();
      showToast("AI Day Strategy is ready.");
      return { ok: true };
    }

    if (res.status === "tier_blocked") {
      const msg = "AI Day Strategy needs a Pro or Family plan.";
      onRequestStrategyUpgrade?.();
      showToast(msg);
      return { ok: false, error: msg };
    }

    if (res.status === "missing_data") {
      setMiniWizardOpen(true);
      const msg = "We still need a few planning details for this day.";
      showToast(msg);
      return { ok: false, error: msg };
    }

    if (res.status === "no_park_assigned") {
      const msg = "Assign a theme park to this day first.";
      showToast(msg);
      return { ok: false, error: msg };
    }

    const err = res.error;
    showToast(err);
    return { ok: false, error: err };
  }, [
    trip.id,
    date,
    onStrategySuccess,
    onNeedsTripRefresh,
    onRequestStrategyUpgrade,
    router,
  ]);

  const handleStrategyPrimary = useCallback(async () => {
    if (strategyBusy || tweakBusy || miniWizardOpen) return;
    if (productTier === "free") {
      onRequestStrategyUpgrade?.();
      return;
    }
    if (!hasCompleteDayIntent) {
      setMiniWizardOpen(true);
      return;
    }
    setStrategyBusy(true);
    try {
      const r = await runStrategyGenerateCore();
      if (r.ok) onClose();
    } finally {
      setStrategyBusy(false);
    }
  }, [
    strategyBusy,
    tweakBusy,
    miniWizardOpen,
    productTier,
    hasCompleteDayIntent,
    onRequestStrategyUpgrade,
    runStrategyGenerateCore,
    onClose,
  ]);

  useEffect(() => {
    if (!open || !pendingAutoRunStrategyRef.current || productTier === "free")
      return;
    if (miniWizardOpen || strategyBusy || tweakBusy) return;
    pendingAutoRunStrategyRef.current = false;
    setTab("strategy");
    void (async () => {
      await handleStrategyPrimary();
      onAutoRunStrategyConsumed?.();
    })();
  }, [
    open,
    miniWizardOpen,
    strategyBusy,
    tweakBusy,
    productTier,
    handleStrategyPrimary,
    onAutoRunStrategyConsumed,
  ]);

  const handleMiniWizardSaved = useCallback(
    async (payload: {
      prefs: TripPlanningPreferences;
      intent: DayPlanningIntent;
    }) => {
      const r = await onPlanPrefsSavedContinueStrategy(
        payload.prefs,
        payload.intent,
      );
      if (r.ok) onClose();
      return r;
    },
    [onPlanPrefsSavedContinueStrategy, onClose],
  );

  async function runTweakGenerate() {
    if (tweakBusy) return;
    setTweakBusy("generate");
    setError(null);
    setCancelled(false);
    cancelledRef.current = false;
    try {
      const res = await tweakDay({
        tripId: trip.id,
        date,
        mode: tweakMode,
        freetext: tweakMode === "freetext" ? text.trim() : undefined,
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
        void incrementProfileAiDayPlanModeASuccessCountAction();
        onApplied({
          assignments: res.assignments,
          preferences: res.preferences,
          day_snapshots: res.daySnapshots,
        });
        showToast("Plan updated.");
        onClose();
      }
    } finally {
      setTweakBusy(null);
    }
  }

  async function saveTweakPreview() {
    if (!proposed || tweakBusy) return;
    setTweakBusy("save");
    setError(null);
    try {
      const res = await confirmTweakDay({
        tripId: trip.id,
        date,
        mode: tweakMode,
        proposed,
        model,
      });
      if (res.status === "error") {
        if (res.code === "tier_limit") onTierLimit(res.error);
        else setError(res.error);
        return;
      }
      if (res.status === "applied") {
        void incrementProfileAiDayPlanModeASuccessCountAction();
        onApplied({
          assignments: res.assignments,
          preferences: res.preferences,
          day_snapshots: res.daySnapshots,
        });
        showToast("Plan updated.");
        onClose();
      }
    } finally {
      setTweakBusy(null);
    }
  }

  async function confirmUndoLatest() {
    if (tweakBusy) return;
    setTweakBusy("undo");
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
      setShowUndoConfirm(false);
    } finally {
      setTweakBusy(null);
    }
  }

  async function persistPreviewDefault(next: boolean) {
    setPreview(next);
    const w = await setProfileAiDayPreviewDefaultAction(next);
    if (!w.ok) {
      showToast(w.error);
    }
  }


  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-royal/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-planner-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/40 bg-cream p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="day-planner-title"
              className="font-serif text-xl font-semibold text-royal"
            >
              ✨ Plan this day
            </h2>
            <p className="mt-1 font-sans text-sm text-royal/70">
              {subtitleLine}. Existing tiles on other days stay as they are.
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

        {!miniWizardOpen ? (
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white/70 p-1">
            <button
              type="button"
              className={`min-h-11 rounded-lg px-3 font-sans text-sm font-semibold ${
                tab === "adjust" ? "bg-royal text-cream" : "text-royal"
              }`}
              onClick={() => setTab("adjust")}
            >
              Quick plan
            </button>
            <button
              type="button"
              className={`min-h-11 rounded-lg px-3 font-sans text-sm font-semibold ${
                tab === "strategy" ? "bg-royal text-cream" : "text-royal"
              }`}
              onClick={() => setTab("strategy")}
            >
              Build day strategy
              {productTier === "free" ? (
                <span className="ml-1 rounded bg-royal/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-royal">
                  Pro
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        {miniWizardOpen ? (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              className="font-sans text-sm font-semibold text-royal underline decoration-dotted decoration-royal/40 underline-offset-4"
              onClick={() => {
                setMiniWizardOpen(false);
              }}
            >
              ← Back to planner
            </button>
            <PlanStrategyMiniWizard
              open
              presentation="embedded"
              helpCtaLabel="Plan this day"
              date={date}
              tripId={trip.id}
              initialPrefs={trip.planning_preferences}
              existingIntent={existingDayIntent}
              dominantParkId={domPark?.id ?? null}
              availableParks={parks}
              currentDayAssignments={currentDay}
              tripAdults={trip.adults}
              tripChildren={trip.children}
              tripChildAges={trip.child_ages ?? []}
              showDisney={showDisney}
              showUniversal={showUniversal}
              onClose={() => {
                setMiniWizardOpen(false);
              }}
              onSaved={handleMiniWizardSaved}
              onRetryStrategyGenerate={onRetryStrategyFromMiniWizard}
            />
          </div>
        ) : tab === "adjust" ? (
          <>
            {!proposed ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white/70 p-1">
                  <button
                    type="button"
                    className={`min-h-11 rounded-lg px-3 font-sans text-sm font-semibold ${
                      tweakMode === "smart_suggest"
                        ? "bg-royal text-cream"
                        : "text-royal"
                    }`}
                    onClick={() => setTweakMode("smart_suggest")}
                  >
                    Suggest a day
                  </button>
                  <button
                    type="button"
                    className={`min-h-11 rounded-lg px-3 font-sans text-sm font-semibold ${
                      tweakMode === "freetext"
                        ? "bg-royal text-cream"
                        : "text-royal"
                    }`}
                    onClick={() => setTweakMode("freetext")}
                  >
                    Custom instructions
                  </button>
                </div>
                <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-royal/12 bg-white/80 px-3 py-2 font-sans text-sm font-medium text-royal">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
                    checked={preview}
                    disabled={prefsLoading}
                    onChange={(e) => void persistPreviewDefault(e.target.checked)}
                  />
                  Preview before saving
                </label>

                <div className="mt-5 rounded-xl border border-royal/10 bg-white/90 p-4">
                  {tweakMode === "smart_suggest" ? (
                    <>
                      <h3 className="font-serif text-lg font-semibold text-royal">
                        Suggest a day
                      </h3>
                      <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                        The AI proposes refreshed AM / PM / meal slots for{" "}
                        {dayTitle} using your trip context.
                      </p>
                    </>
                  ) : (
                    <label className="block">
                      <span className="font-serif text-lg font-semibold text-royal">
                        Custom instructions
                      </span>
                      <textarea
                        value={text}
                        maxLength={500}
                        onChange={(e) => setText(e.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-lg border border-royal/20 bg-cream/50 px-3 py-2 font-sans text-sm text-royal"
                        placeholder="Rest day, swap parks, quieter morning…"
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
                  <h3 className="font-serif text-lg font-semibold text-royal">
                    Before
                  </h3>
                  <dl className="mt-3 space-y-2 font-sans text-sm">
                    {SLOTS.map(({ key, label }) => (
                      <div key={key} className="flex justify-between gap-3">
                        <dt className="font-semibold text-royal/65">{label}</dt>
                        <dd className="text-right text-royal">
                          {slotLabel(currentDay, parkNames, key)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="rounded-xl border border-gold/40 bg-white p-4">
                  <h3 className="font-serif text-lg font-semibold text-royal">
                    After
                  </h3>
                  <dl className="mt-3 space-y-2 font-sans text-sm">
                    {SLOTS.map(({ key, label }) => (
                      <div key={key} className="flex justify-between gap-3">
                        <dt className="font-semibold text-royal/65">{label}</dt>
                        <dd className="text-right text-royal">
                          {slotLabel(afterDay, parkNames, key)}
                        </dd>
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
                    disabled={tweakBusy != null}
                    onClick={() => void saveTweakPreview()}
                    className="min-h-11 flex-1 rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream disabled:opacity-60"
                  >
                    {tweakBusy === "save" ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    disabled={tweakBusy != null}
                    onClick={() => {
                      setProposed(null);
                      void runTweakGenerate();
                    }}
                    className="min-h-11 rounded-lg border border-royal/20 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal"
                  >
                    Try again
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={
                    tweakBusy != null ||
                    (tweakMode === "freetext" && !text.trim()) ||
                    prefsLoading
                  }
                  onClick={() => void runTweakGenerate()}
                  className="min-h-11 flex-1 rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream disabled:opacity-60"
                >
                  {tweakBusy === "generate" ? (
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
                disabled={tweakBusy === "save" || tweakBusy === "undo"}
                onClick={() => {
                  if (tweakBusy === "generate") {
                    setCancelled(true);
                    cancelledRef.current = true;
                    setTweakBusy(null);
                    return;
                  }
                  onClose();
                }}
                className="min-h-11 rounded-lg border border-royal/20 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-royal/10 bg-white/90 p-4">
              <h3 className="font-serif text-lg font-semibold text-royal">
                Sequenced ride strategy
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
                A detailed schedule — arrival window, LL / single rider hints,
                and an ordered ride list for your main park that day.
              </p>
              {productTier === "free" ? (
                <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 font-sans text-sm text-royal">
                  <p>
                    Upgrade to <span className="font-semibold">Pro</span> or{" "}
                    <span className="font-semibold">Family</span> to generate a
                    strategy here. You can still use{" "}
                    <span className="font-semibold">Quick plan</span>{" "}
                    on any plan.
                  </p>
                  <button
                    type="button"
                    className="mt-3 min-h-11 w-full rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream"
                    onClick={() => onRequestStrategyUpgrade?.()}
                  >
                    See plans
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={strategyBusy}
                  className="mt-4 min-h-11 w-full rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream disabled:opacity-60"
                  onClick={() => void handleStrategyPrimary()}
                >
                  {strategyBusy ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <LogoSpinner size="sm" variant="onDark" decorative />
                      Generating…
                    </span>
                  ) : (
                    "Preview day strategy"
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {latestSnapshot && !miniWizardOpen ? (
          showUndoConfirm ? (
            <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4">
              <p className="font-sans text-sm text-royal">
                {latestSnapshot
                  ? `Undo the AI change from ${formatUndoSnapshotHint(latestSnapshot.created_at)}? This restores the day to how it was before.`
                  : "Undo the last AI change on this day?"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-lg border border-royal/25 bg-white px-4 py-2 font-sans text-sm font-semibold text-royal"
                  onClick={() => setShowUndoConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={tweakBusy != null}
                  className="min-h-11 flex-1 rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream disabled:opacity-60"
                  onClick={() => void confirmUndoLatest()}
                >
                  {tweakBusy === "undo" ? "Working…" : "Undo"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 font-sans text-xs text-royal/60">
              Last AI change on this day:{" "}
              {formatUndoSnapshotHint(latestSnapshot.created_at)} ·{" "}
              <button
                type="button"
                disabled={tweakBusy != null}
                onClick={() => setShowUndoConfirm(true)}
                className="font-semibold text-royal underline decoration-gold/50 underline-offset-2"
              >
                Undo
              </button>
              {snapshotCount > 1 ? ` (${snapshotCount} saved)` : ""}
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
