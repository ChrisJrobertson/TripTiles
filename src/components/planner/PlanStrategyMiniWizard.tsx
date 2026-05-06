"use client";

import { Button } from "@/components/ui/Button";
import {
  saveDayPlanningIntentAction,
  updateTripPlanningPreferencesAction,
} from "@/actions/trips";
import {
  getDefaultDayPlanningIntent,
  hasRequiredDayPlanningIntent,
} from "@/lib/day-planning-intent";
import { showToast } from "@/lib/toast";
import type {
  DayPlanningChangePermission,
  DayPlanningDayType,
  DayPlanningFinishPreference,
  DayPlanningIntent,
  DayPlanningMealPreference,
  DayPlanningPaidAccess,
  DayPlanningPace,
  DayPlanningParkAction,
  DayPlanningRideLevel,
  DayPlanningStartPreference,
  Park,
  PlanningDisneyLightningLane,
  PlanningMobility,
  PlanningUniversalExpress,
  SlotAssignmentValue,
  SlotType,
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
const PARK_ACTIONS_WITH_PARK_SELECTION = new Set<DayPlanningParkAction>([
  "keep_existing",
  "change_park",
  "add_park",
]);

export function PlanStrategyMiniWizard({
  open,
  date,
  tripId,
  initialPrefs,
  existingIntent,
  dominantParkId,
  availableParks,
  currentDayAssignments,
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
  date: string;
  tripId: string;
  initialPrefs: TripPlanningPreferences | null;
  existingIntent: DayPlanningIntent | null;
  dominantParkId?: string | null;
  availableParks: Park[];
  currentDayAssignments: Partial<Record<SlotType, SlotAssignmentValue>>;
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
  onSaved: (payload: {
    prefs: TripPlanningPreferences;
    intent: DayPlanningIntent;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
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
  const [validationError, setValidationError] = useState<string | null>(null);

  const defaultIntent = useMemo(
    () =>
      getDefaultDayPlanningIntent({
        date,
        dominantParkId,
        existingIntent,
      }),
    [date, dominantParkId, existingIntent],
  );
  const [parkAction, setParkAction] = useState<DayPlanningParkAction>(
    defaultIntent.parkAction,
  );
  const [selectedParkIds, setSelectedParkIds] = useState<string[]>(
    defaultIntent.selectedParkIds,
  );
  const [dayType, setDayType] = useState<DayPlanningDayType>(defaultIntent.dayType);
  const [rideLevel, setRideLevel] = useState<DayPlanningRideLevel>(
    defaultIntent.rideLevel,
  );
  const [avoid, setAvoid] = useState<string[]>(defaultIntent.avoid);
  const [mealPreference, setMealPreference] = useState<DayPlanningMealPreference>(
    defaultIntent.mealPreference,
  );
  const [pace, setPace] = useState<DayPlanningPace>(defaultIntent.pace);
  const [startPreference, setStartPreference] = useState<DayPlanningStartPreference>(
    defaultIntent.startPreference,
  );
  const [finishPreference, setFinishPreference] =
    useState<DayPlanningFinishPreference>(defaultIntent.finishPreference);
  const [paidAccess, setPaidAccess] = useState<DayPlanningPaidAccess>(
    defaultIntent.paidAccess,
  );
  const [mustInclude, setMustInclude] = useState(defaultIntent.mustInclude);
  const [mustAvoid, setMustAvoid] = useState(defaultIntent.mustAvoid);
  const [changePermission, setChangePermission] =
    useState<DayPlanningChangePermission>(defaultIntent.changePermission);

  const currentAssignedParkIds = useMemo(() => {
    const out = new Set<string>();
    for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
      const value = currentDayAssignments[slot];
      if (typeof value === "string" && value.trim()) out.add(value);
      else if (
        value &&
        typeof value === "object" &&
        "parkId" in value &&
        typeof value.parkId === "string" &&
        value.parkId.trim()
      ) {
        out.add(value.parkId);
      }
    }
    return [...out];
  }, [currentDayAssignments]);

  const resetTransientUi = useCallback(() => {
    setSaveError(null);
    setSaveTimedOut(false);
    setValidationError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetTransientUi();
      setBusy(false);
    }
  }, [open, resetTransientUi]);

  useEffect(() => {
    if (!open) return;
    setParkAction(defaultIntent.parkAction);
    setSelectedParkIds(defaultIntent.selectedParkIds);
    setDayType(defaultIntent.dayType);
    setRideLevel(defaultIntent.rideLevel);
    setAvoid(defaultIntent.avoid);
    setMealPreference(defaultIntent.mealPreference);
    setPace(defaultIntent.pace);
    setStartPreference(defaultIntent.startPreference);
    setFinishPreference(defaultIntent.finishPreference);
    setPaidAccess(defaultIntent.paidAccess);
    setMustInclude(defaultIntent.mustInclude);
    setMustAvoid(defaultIntent.mustAvoid);
    setChangePermission(defaultIntent.changePermission);
  }, [open, defaultIntent]);

  useEffect(() => {
    if (!busy || !open) return;
    const t = window.setTimeout(() => {
      saveGenerationRef.current += 1;
      setSaveTimedOut(true);
      setBusy(false);
    }, SAVE_WATCHDOG_MS);
    return () => clearTimeout(t);
  }, [busy, open]);

  useEffect(() => {
    if (!PARK_ACTIONS_WITH_PARK_SELECTION.has(parkAction)) {
      setSelectedParkIds([]);
      return;
    }
    if (selectedParkIds.length > 0) return;
    if (parkAction === "keep_existing" && dominantParkId) {
      setSelectedParkIds([dominantParkId]);
      return;
    }
    if (parkAction === "keep_existing" && currentAssignedParkIds.length > 0) {
      setSelectedParkIds([currentAssignedParkIds[0]!]);
    }
  }, [parkAction, dominantParkId, currentAssignedParkIds, selectedParkIds.length]);

  const builtIntent = useMemo<DayPlanningIntent>(
    () => ({
      parkAction,
      selectedParkIds,
      dayType,
      rideLevel,
      avoid,
      mealPreference,
      pace,
      startPreference,
      finishPreference,
      paidAccess,
      mustInclude: mustInclude.trim(),
      mustAvoid: mustAvoid.trim(),
      changePermission,
      completedAt: existingIntent?.completedAt,
    }),
    [
      parkAction,
      selectedParkIds,
      dayType,
      rideLevel,
      avoid,
      mealPreference,
      pace,
      startPreference,
      finishPreference,
      paidAccess,
      mustInclude,
      mustAvoid,
      changePermission,
      existingIntent?.completedAt,
    ],
  );

  const save = useCallback(async () => {
    const myGen = ++saveGenerationRef.current;
    resetTransientUi();
    if (!hasRequiredDayPlanningIntent(builtIntent)) {
      setValidationError(
        "Please complete the required day details before continuing.",
      );
      return;
    }
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
      const intentRes = await saveDayPlanningIntentAction({
        tripId,
        date,
        intent: builtIntent,
      });
      if (!intentRes.ok) {
        showToast(intentRes.error);
        return;
      }
      const res = await updateTripPlanningPreferencesAction({
        tripId,
        planningPreferences: next,
      });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      const out = await onSaved({ prefs: next, intent: intentRes.intent });
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
    builtIntent,
    disneyLL,
    univEx,
    tripId,
    date,
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
            ? "max-h-[min(70vh,28rem)] w-full max-w-lg overflow-y-auto rounded-tt-xl border border-tt-line bg-tt-surface-warm p-5 shadow-tt-md sm:p-6"
            : "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-tt-xl border border-tt-line bg-tt-surface-warm p-6 shadow-tt-lg sm:rounded-tt-xl"
        }
      >
        <h2 className="font-heading text-lg font-semibold text-tt-royal">
          {embedded
            ? "Build day strategy"
            : "Tell TripTiles how this day should run"}
        </h2>
        <p className="mt-2 font-sans text-sm text-tt-ink-muted">
          {embedded
            ? "Save once — we&apos;ll generate your ride strategy in this window."
            : "Save once — we&apos;ll continue with your AI Day Strategy."}
        </p>

        {saveTimedOut ? (
          <div className="mt-6 space-y-4">
            <p className="font-sans text-sm leading-relaxed text-tt-royal/85">
              Taking longer than expected — your details are saved. You can
              close this and tap{" "}
              <span className="font-semibold">{helpCtaLabel}</span> again on
              that day.
            </p>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        ) : saveError ? (
          <div className="mt-6 space-y-4">
            <p className="font-sans text-sm leading-relaxed text-tt-royal/85">
              We saved your details, but couldn&apos;t finish the strategy.{" "}
              <span className="font-medium text-tt-royal">{saveError}</span> Try
              again, or close and run{" "}
              <span className="font-semibold">{helpCtaLabel}</span> from the day
              view.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {onRetryStrategyGenerate ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  className="flex-1"
                  onClick={() => void retryStrategyOnly()}
                >
                  {busy ? "Working…" : "Try again"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              <section className="rounded-xl border border-royal/10 bg-white/90 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  1. What should this day be built around?
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ["keep_existing", "Keep existing park"],
                    ["change_park", "Change park"],
                    ["add_park", "Add another park"],
                    ["rest_day", "Rest / pool day"],
                    ["suggest", "Let TripTiles suggest"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setParkAction(value as DayPlanningParkAction)}
                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-left font-sans text-sm ${
                        parkAction === value
                          ? "border-gold bg-cream text-tt-royal"
                          : "border-royal/20 bg-white text-tt-royal/85"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {PARK_ACTIONS_WITH_PARK_SELECTION.has(parkAction) ? (
                  <div className="mt-3">
                    <p className="font-sans text-xs text-tt-royal/70">
                      Select park{parkAction === "add_park" ? "s" : ""}.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableParks.map((park) => {
                        const selected = selectedParkIds.includes(park.id);
                        return (
                          <button
                            key={park.id}
                            type="button"
                            onClick={() => {
                              setSelectedParkIds((prev) => {
                                if (parkAction === "add_park") {
                                  return selected
                                    ? prev.filter((id) => id !== park.id)
                                    : [...prev, park.id];
                                }
                                return [park.id];
                              });
                            }}
                            className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs ${
                              selected
                                ? "border-gold bg-cream text-tt-royal"
                                : "border-royal/20 bg-white text-tt-royal/85"
                            }`}
                          >
                            {park.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-xl border border-royal/10 bg-white/90 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  2. What kind of day do you want?
                </h3>
                <select
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={dayType}
                  onChange={(e) => setDayType(e.target.value as DayPlanningDayType)}
                >
                  <option value="thrill_heavy">Thrill-heavy day</option>
                  <option value="balanced_family">Balanced family day</option>
                  <option value="lower_thrill">Lower-thrill day</option>
                  <option value="shows_food_exploring">Shows, food and exploring</option>
                  <option value="shorter_easier">Shorter / easier day</option>
                  <option value="suggest">Let TripTiles suggest</option>
                </select>

                <h3 className="mt-4 font-heading text-base font-semibold text-tt-royal">
                  3. What ride level should TripTiles plan for?
                </h3>
                <select
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={rideLevel}
                  onChange={(e) =>
                    setRideLevel(e.target.value as DayPlanningRideLevel)
                  }
                >
                  <option value="big_thrills">
                    Big coasters and thrill rides are fine
                  </option>
                  <option value="some_thrills">
                    Some thrill rides, mixed with gentler rides
                  </option>
                  <option value="gentle">Gentle / lower-intensity rides only</option>
                  <option value="shows_lands_food">
                    Mostly shows, lands, food and atmosphere
                  </option>
                </select>
              </section>

              <section className="rounded-xl border border-royal/10 bg-white/90 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  4. Anything to avoid?
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ["big_drops", "Big drops"],
                    ["inversions", "Inversions"],
                    ["spinning", "Spinning"],
                    ["motion_simulators", "Motion simulators"],
                    ["scary_rides", "Scary rides"],
                    ["water_rides", "Water rides"],
                    ["long_standing_queues", "Long standing queues"],
                  ].map(([id, label]) => {
                    const selected = avoid.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setAvoid((prev) =>
                            selected
                              ? prev.filter((v) => v !== id)
                              : [...prev, id],
                          )
                        }
                        className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs ${
                          selected
                            ? "border-gold bg-cream text-tt-royal"
                            : "border-royal/20 bg-white text-tt-royal/85"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-royal/10 bg-white/90 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  5. How should meals work today?
                </h3>
                <select
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={mealPreference}
                  onChange={(e) =>
                    setMealPreference(e.target.value as DayPlanningMealPreference)
                  }
                >
                  <option value="do_not_plan">Do not plan meals</option>
                  <option value="quick_service">Quick-service only</option>
                  <option value="table_service">Table-service only</option>
                  <option value="mixed">
                    Mix of quick-service and table-service
                  </option>
                  <option value="snacks">Snacks / light food only</option>
                  <option value="existing_only">Use existing reservations only</option>
                  <option value="suggest">Let TripTiles suggest</option>
                </select>

                <h3 className="mt-4 font-heading text-base font-semibold text-tt-royal">
                  6. What pace do you want?
                </h3>
                <select
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={pace}
                  onChange={(e) => setPace(e.target.value as DayPlanningPace)}
                >
                  <option value="packed">Packed day</option>
                  <option value="balanced">Balanced day</option>
                  <option value="relaxed">Relaxed day</option>
                  <option value="half_day">Half-day / lighter day</option>
                </select>
              </section>

              <section className="rounded-xl border border-royal/10 bg-white/90 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  7. How should the day start and finish?
                </h3>
                <label className="mt-2 block font-sans text-sm font-semibold text-tt-royal">
                  Start
                </label>
                <select
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={startPreference}
                  onChange={(e) =>
                    setStartPreference(e.target.value as DayPlanningStartPreference)
                  }
                >
                  <option value="rope_drop">Rope drop</option>
                  <option value="normal_morning">Normal morning start</option>
                  <option value="slow_start">Slow start</option>
                  <option value="afternoon">Afternoon start</option>
                </select>
                <label className="mt-3 block font-sans text-sm font-semibold text-tt-royal">
                  Finish
                </label>
                <select
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={finishPreference}
                  onChange={(e) =>
                    setFinishPreference(e.target.value as DayPlanningFinishPreference)
                  }
                >
                  <option value="after_lunch">Leave after lunch</option>
                  <option value="mid_afternoon">Leave mid-afternoon</option>
                  <option value="early_evening">Early evening</option>
                  <option value="night_atmosphere">Stay for night atmosphere</option>
                  <option value="close">Stay until close</option>
                </select>

                <h3 className="mt-4 font-heading text-base font-semibold text-tt-royal">
                  8. Are you using paid queue access?
                </h3>
                <select
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={paidAccess}
                  onChange={(e) =>
                    setPaidAccess(e.target.value as DayPlanningPaidAccess)
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="not_sure">Not sure</option>
                  <option value="decide_later">Decide later</option>
                </select>
              </section>

              <section className="rounded-xl border border-royal/10 bg-white/90 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  9. Anything TripTiles must include or avoid?
                </h3>
                <label className="mt-2 block font-sans text-sm font-semibold text-tt-royal">
                  Must include today
                </label>
                <textarea
                  rows={3}
                  value={mustInclude}
                  onChange={(e) => setMustInclude(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm text-tt-royal"
                />
                <label className="mt-3 block font-sans text-sm font-semibold text-tt-royal">
                  Must avoid today
                </label>
                <textarea
                  rows={3}
                  value={mustAvoid}
                  onChange={(e) => setMustAvoid(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm text-tt-royal"
                />

                <h3 className="mt-4 font-heading text-base font-semibold text-tt-royal">
                  10. How much can TripTiles change?
                </h3>
                <select
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-royal/20 px-3 py-2"
                  value={changePermission}
                  onChange={(e) =>
                    setChangePermission(e.target.value as DayPlanningChangePermission)
                  }
                >
                  <option value="fill_gaps_only">Fill empty gaps only</option>
                  <option value="add_around_existing">
                    Add suggestions around what is already there
                  </option>
                  <option value="reorder_unlocked">Reorder unlocked items</option>
                  <option value="replace_ai_only">Replace AI-generated items only</option>
                  <option value="start_again">Start again for this day</option>
                </select>
              </section>

              <section className="rounded-xl border border-gold/30 bg-cream/70 p-4">
                <h3 className="font-heading text-base font-semibold text-tt-royal">
                  Additional planning details
                </h3>
                <div className="mt-3 space-y-4">
                <label className="font-sans text-sm font-semibold text-tt-royal">
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
                    <label key={i} className="block font-sans text-sm text-tt-royal">
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
                  <p className="font-sans text-sm font-semibold text-tt-royal">
                    Disney — queues
                  </p>
                  <p className="mt-2 font-sans text-xs text-tt-royal/70">
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
                  <p className="mt-2 font-sans text-xs text-tt-royal/70">
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
                  <p className="mt-2 font-sans text-xs text-tt-royal/70">
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
                  <p className="font-sans text-sm font-semibold text-tt-royal">
                    Universal — Express &amp; Single Rider
                  </p>
                  <p className="mt-2 font-sans text-xs text-tt-royal/70">Express</p>
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
                  <p className="mt-2 font-sans text-xs text-tt-royal/70">
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
              </section>
            </div>

            {validationError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-900">
                {validationError}
              </p>
            ) : null}

            <div className="mt-6 flex gap-2 border-t border-tt-line-soft pt-6">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-h-11 flex-1"
                disabled={busy}
                loading={busy}
                loadingLabel="Saving…"
                onClick={() => void save()}
              >
                Save & continue
              </Button>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) {
    return <div className="w-full max-w-lg">{panel}</div>;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-tt-royal/50 backdrop-blur-[1px] sm:items-center sm:p-4">
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
