"use client";

import { generateDaySequenceAction } from "@/actions/day-sequencer";
import {
  saveTripPlanningProfileAction,
  updateTripPlanningPreferencesAction,
} from "@/actions/trips";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { daysBetween, parseDate } from "@/lib/date-helpers";
import {
  collectAssignmentParkIdsForDay,
  dayShowsTouringPlanModeToggle,
  defaultDayPlannerMode,
} from "@/lib/day-touring-plan";
import type { ParkDaySequenceOutput } from "@/lib/day-sequencer";
import { planningPaceToSequencerPace } from "@/lib/day-sequencer";
import type { SequencerPace } from "@/lib/day-sequencer";
import { showToast } from "@/lib/toast";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import type { Park, PlanningPace, Trip, TripPlanningPreferences } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { SequenceTimeline } from "@/components/planner/SequenceTimeline";
import {
  SmartPlanHolidayWizardSteps,
  holidayWizardStepCount,
} from "@/components/planner/SmartPlanHolidayWizardSteps";
import {
  buildHolidayWizardSupplementPrompt,
  buildTripPlanningProfileFromHolidayWizard,
  computeHolidayAssignmentsPreview,
  holidayWizardDefaults,
  hydrateHolidayWizardFromTripPreferences,
  mapWizardToPlanningPreferences,
  smartPlanOverwriteFromScope,
  type HolidaySmartWizardState,
} from "@/lib/smart-plan-holiday-wizard";
import { readTripPlanningProfile } from "@/lib/trip-intelligence";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

const MAX_CHARS = 2000;
const DEFAULT_FREE_CAP = 5;

const SEQUENCER_STATUS_LINES = [
  "Crunching wait times…",
  "Routing around dining reservations…",
  "Working out rope drop priority…",
  "Sequencing your day…",
] as const;

function touringFailureUserMessage(code: string, serverMessage: string): string {
  switch (code) {
    case "NO_PARKS_FOR_DAY":
      return "Assign at least one park to this day before generating a touring plan.";
    case "ANCHORS_OVERLAP":
      return "Your scheduled events overlap. Please adjust your dining or Lightning Lane times before generating.";
    case "ANCHOR_ATTRACTION_WRONG_PARK":
      return "One of your anchored events isn't at a park you're visiting today. Please remove it or assign the matching park.";
    case "EMPTY_PRIORITIES":
      return "Pick at least one must-ride from your priorities list before generating a touring plan.";
    case "ENGINE_CRASH":
      return "Something went wrong generating the plan. We've logged it — please try again in a moment.";
    default:
      return serverMessage || "Something went wrong. Please try again.";
  }
}

export type SmartPlanGeneratePayload = {
  mode: "smart" | "custom";
  userPrompt: string;
  /** When true, Smart Plan overwrites existing calendar tiles where it outputs a slot. */
  replaceExistingTiles: boolean;
  /** Optional day scope for day-detail "Plan my day". */
  dateKey?: string;
  /** Smart mode only — saved to the trip before generation. */
  planningPreferences?: TripPlanningPreferences | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Trip used for Smart mode preview (dates, party size). */
  trip: Trip | null;
  /** Built-in parks for the trip region (for must-do chips). */
  parks: Park[];
  /** Region label e.g. short_name for copy. */
  regionLabel: string;
  generationsUsedThisTrip: number;
  freeTierCap?: number;
  showFreeTierNote?: boolean;
  isGenerating: boolean;
  submitError: string | null;
  scope?: "trip" | "day";
  dayDateKey?: string | null;
  /** When the day already has a saved `ai_day_timeline`, show Regenerate. */
  dayHasAiTimeline?: boolean;
  canRetryPartial?: boolean;
  onRetryPartial?: () => void;
  onGenerate: (payload: SmartPlanGeneratePayload) => Promise<void>;
  onCancelGeneration?: () => void;
  /** Keep trip.planning_preferences in sync when skip-line toggles change (avoids stale local state). */
  onTripPatch?: (patch: Partial<Trip>) => void;
  /** Day-detail ride priorities for this date (for touring summaries and names). */
  ridePrioritiesForDay?: TripRidePriority[];
};

export function SmartPlanModal({
  isOpen,
  onClose,
  trip,
  parks,
  regionLabel,
  generationsUsedThisTrip,
  freeTierCap = DEFAULT_FREE_CAP,
  showFreeTierNote = true,
  isGenerating,
  submitError,
  scope = "trip",
  dayDateKey = null,
  dayHasAiTimeline = false,
  canRetryPartial = false,
  onRetryPartial,
  onGenerate,
  onCancelGeneration,
  onTripPatch,
  ridePrioritiesForDay = [],
}: Props) {
  const [mode, setMode] = useState<"smart" | "custom">("smart");
  const [replaceExistingTiles, setReplaceExistingTiles] = useState(false);
  const [skipPrefsSaving, setSkipPrefsSaving] = useState(false);
  const [holidayWizard, setHolidayWizard] = useState<HolidaySmartWizardState>(
    () => holidayWizardDefaults(),
  );
  const [holidayStep, setHolidayStep] = useState(0);
  const [profileSaving, setProfileSaving] = useState(false);
  const [customText, setCustomText] = useState("");

  const [dayPlannerSource, setDayPlannerSource] = useState<"touring" | "ai">(
    "ai",
  );
  const [touringPace, setTouringPace] = useState<SequencerPace>("balanced");
  const [entMultiLl, setEntMultiLl] = useState(false);
  const [entSingleLl, setEntSingleLl] = useState(false);
  const [entUx, setEntUx] = useState(false);
  const [entEarly, setEntEarly] = useState(false);
  const [sequencerBusy, setSequencerBusy] = useState(false);
  const [sequencerStatusIdx, setSequencerStatusIdx] = useState(0);
  const [touringSequence, setTouringSequence] =
    useState<ParkDaySequenceOutput | null>(null);
  const [touringError, setTouringError] = useState<string | null>(null);
  const touringRunRef = useRef(0);

  const plannerProfileSeed = useMemo(() => {
    if (!trip?.preferences) return "";
    return (
      readTripPlanningProfile(trip.preferences)?.updatedAt ?? "__noprofile__"
    );
  }, [trip?.preferences]);

  useEffect(() => {
    if (!isOpen || !trip) return;
    const p = trip.planning_preferences;
    const savedProfile = readTripPlanningProfile(trip.preferences ?? {});
    const hw = hydrateHolidayWizardFromTripPreferences({
      trip,
      profile: savedProfile,
    });
    if (scope === "day" && dayDateKey) {
      hw.scope = "plan_this_day_only";
    }
    setHolidayWizard(hw);
    setHolidayStep(0);

    setCustomText("");
    setMode("smart");
    setReplaceExistingTiles(false);
    setTouringSequence(null);
    setTouringError(null);
    setSequencerBusy(false);
    setEntMultiLl(false);
    setEntSingleLl(false);
    setEntUx(false);
    setEntEarly(false);
    const seqPace = planningPaceToSequencerPace(
      (p?.pace ?? "balanced") as PlanningPace,
    );
    setTouringPace(seqPace);
    if (scope === "day" && dayDateKey) {
      setDayPlannerSource(defaultDayPlannerMode(trip, dayDateKey));
    } else {
      setDayPlannerSource("ai");
    }
    // Re-seed when the modal opens, trip changes, or saved trip_planning_profile updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, trip?.id, plannerProfileSeed, scope, dayDateKey]);

  const persistSkipLinePrefs = useCallback(
    async (nextDisney: boolean, nextUniversal: boolean) => {
      if (!trip) return;
      setSkipPrefsSaving(true);
      try {
        const base = trip.planning_preferences;
        const next: TripPlanningPreferences = base
          ? {
              ...base,
              includeDisneySkipTips: nextDisney,
              includeUniversalSkipTips: nextUniversal,
            }
          : {
              pace: "balanced",
              mustDoParks: [],
              priorities: [],
              additionalNotes: null,
              adults: trip.adults,
              children: trip.children,
              childAges: trip.child_ages ?? [],
              includeDisneySkipTips: nextDisney,
              includeUniversalSkipTips: nextUniversal,
            };
        const res = await updateTripPlanningPreferencesAction({
          tripId: trip.id,
          planningPreferences: next,
        });
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        onTripPatch?.({ planning_preferences: next });
      } finally {
        setSkipPrefsSaving(false);
      }
    },
    [trip, onTripPatch],
  );

  const isDayScope = scope === "day" && Boolean(dayDateKey);

  const dayHasCalendarTiles = useMemo(() => {
    if (!trip || !isDayScope || !dayDateKey) return false;
    const d = trip.assignments[dayDateKey];
    if (!d) return false;
    return Boolean(
      getParkIdFromSlotValue(d.am) ||
        getParkIdFromSlotValue(d.pm) ||
        getParkIdFromSlotValue(d.lunch) ||
        getParkIdFromSlotValue(d.dinner),
    );
  }, [trip, isDayScope, dayDateKey]);

  const showTouringPlanToggle = useMemo(() => {
    if (!trip || !isDayScope || !dayDateKey) return false;
    return dayShowsTouringPlanModeToggle(trip, dayDateKey);
  }, [trip, isDayScope, dayDateKey]);

  const dayParkIds = useMemo(() => {
    if (!trip || !dayDateKey) return [];
    return collectAssignmentParkIdsForDay(trip, dayDateKey);
  }, [trip, dayDateKey]);

  const prioritiesOnDayParks = useMemo(() => {
    const set = new Set(dayParkIds);
    return sortPrioritiesForDay(
      ridePrioritiesForDay.filter(
        (r) => r.attraction && set.has(r.attraction.park_id),
      ),
    );
  }, [ridePrioritiesForDay, dayParkIds]);

  const attractionNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of ridePrioritiesForDay) {
      if (r.attraction) m[r.attraction_id] = r.attraction.name;
    }
    return m;
  }, [ridePrioritiesForDay]);

  const mergedAttractionNames = useMemo(() => {
    const base = { ...attractionNameById };
    if (!touringSequence) return base;
    for (const it of touringSequence.sequence) {
      if (it.type === "ride" && !base[it.attraction_id]) {
        base[it.attraction_id] = "Ride";
      }
    }
    return base;
  }, [attractionNameById, touringSequence]);

  const runTouringGenerate = useCallback(async () => {
    if (!trip || !dayDateKey) return;
    const runId = ++touringRunRef.current;
    setTouringError(null);
    setSequencerBusy(true);
    try {
      const res = await generateDaySequenceAction({
        tripId: trip.id,
        dateKey: dayDateKey,
        entitlements: {
          has_lightning_lane_multi_pass: entMultiLl,
          has_lightning_lane_single_pass: entSingleLl,
          has_universal_express: entUx,
          has_early_entry: entEarly,
        },
        pace: touringPace,
      });
      if (touringRunRef.current !== runId) return;
      if (!res.ok) {
        setTouringError(touringFailureUserMessage(res.code, res.message));
        return;
      }
      setTouringSequence(res.sequence);
    } catch (err) {
      if (touringRunRef.current === runId) {
        setTouringError(
          touringFailureUserMessage(
            "ENGINE_CRASH",
            err instanceof Error ? err.message : "Error",
          ),
        );
      }
    } finally {
      if (touringRunRef.current === runId) setSequencerBusy(false);
    }
  }, [
    trip,
    dayDateKey,
    entMultiLl,
    entSingleLl,
    entUx,
    entEarly,
    touringPace,
  ]);

  useEffect(() => {
    if (dayPlannerSource === "ai") {
      setTouringSequence(null);
      setTouringError(null);
    }
  }, [dayPlannerSource]);

  useEffect(() => {
    if (!sequencerBusy) return;
    setSequencerStatusIdx(0);
    const id = window.setInterval(() => {
      setSequencerStatusIdx((i) => (i + 1) % SEQUENCER_STATUS_LINES.length);
    }, 1500);
    return () => window.clearInterval(id);
  }, [sequencerBusy]);

  const holidayPreview = useMemo(
    () => (trip ? computeHolidayAssignmentsPreview(trip) : null),
    [trip],
  );

  const holidayLastIndex = holidayWizardStepCount(isDayScope) - 1;

  const handleWizardNext = useCallback(() => {
    if (!isDayScope && holidayStep === 0 && holidayWizard.scope === null) {
      showToast("Choose what Smart Plan should do first.");
      return;
    }
    setHolidayStep((s) => Math.min(holidayLastIndex, s + 1));
  }, [
    isDayScope,
    holidayStep,
    holidayWizard.scope,
    holidayLastIndex,
  ]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!trip) return;
      if (isGenerating || sequencerBusy || profileSaving) return;
      if (showTouringPlanToggle && dayPlannerSource === "touring") {
        await runTouringGenerate();
        return;
      }
      if (mode === "custom" && !customText.trim()) return;

      const touringAiPath =
        !(showTouringPlanToggle && dayPlannerSource === "touring");
      const smartUsingWizard = mode === "smart" && touringAiPath;
      if (smartUsingWizard && holidayStep < holidayLastIndex) return;

      const base = trip.planning_preferences;
      const skipDisney =
        trip.planning_preferences?.includeDisneySkipTips !== false;
      const skipUniversal =
        trip.planning_preferences?.includeUniversalSkipTips !== false;

      if (mode === "smart" && smartUsingWizard) {
        setProfileSaving(true);
        try {
          const profile = buildTripPlanningProfileFromHolidayWizard({
            wizard: holidayWizard,
            tripParks: parks,
            trip,
          });
          const profRes = await saveTripPlanningProfileAction({
            tripId: trip.id,
            profile,
          });
          if (!profRes.ok) {
            showToast(profRes.error);
            return;
          }
          const prevPrefs = (trip.preferences ?? {}) as Record<string, unknown>;
          onTripPatch?.({
            preferences: {
              ...prevPrefs,
              trip_planning_profile: profile,
            },
          });
          const planningPreferences = mapWizardToPlanningPreferences({
            trip,
            wizard: holidayWizard,
            tripParks: parks,
          });
          const supplement = buildHolidayWizardSupplementPrompt(holidayWizard);
          const userPrompt = [supplement, holidayWizard.freeText.trim()]
            .filter(Boolean)
            .join("\n\n");
          const scopeForTiles =
            holidayWizard.scope ?? "fill_empty_days_only";
          const replaceTiles = smartPlanOverwriteFromScope(scopeForTiles);
          await onGenerate({
            mode: "smart",
            userPrompt,
            replaceExistingTiles: replaceTiles,
            dateKey: isDayScope ? (dayDateKey ?? undefined) : undefined,
            planningPreferences,
          });
        } finally {
          setProfileSaving(false);
        }
        return;
      }

      const planningPreferences: TripPlanningPreferences = base
        ? {
            ...base,
            includeDisneySkipTips: skipDisney,
            includeUniversalSkipTips: skipUniversal,
          }
        : {
            pace: "balanced",
            mustDoParks: [],
            priorities: [],
            additionalNotes: null,
            adults: trip.adults,
            children: trip.children,
            childAges: trip.child_ages ?? [],
            includeDisneySkipTips: skipDisney,
            includeUniversalSkipTips: skipUniversal,
          };

      await onGenerate({
        mode,
        userPrompt: customText.trim(),
        replaceExistingTiles,
        dateKey: isDayScope ? (dayDateKey ?? undefined) : undefined,
        planningPreferences,
      });
    },
    [
      trip,
      isGenerating,
      sequencerBusy,
      profileSaving,
      showTouringPlanToggle,
      dayPlannerSource,
      runTouringGenerate,
      mode,
      customText,
      holidayStep,
      holidayLastIndex,
      holidayWizard,
      parks,
      onTripPatch,
      onGenerate,
      isDayScope,
      dayDateKey,
      replaceExistingTiles,
    ],
  );

  if (!isOpen || !trip) return null;

  const dayLabel = isDayScope
    ? parseDate(`${dayDateKey}T12:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
      })
    : null;

  const tripDays =
    trip.start_date && trip.end_date
      ? daysBetween(parseDate(trip.start_date), parseDate(trip.end_date)) + 1
      : 0;

  const touringSubmitReady =
    showTouringPlanToggle && dayPlannerSource === "touring";

  const smartUsingWizard = mode === "smart" && !touringSubmitReady;
  const smartOnPreviewStep =
    smartUsingWizard && holidayStep === holidayLastIndex;

  const smartWillOverwriteWholeTrip =
    smartOnPreviewStep && holidayWizard.scope === "improve_whole_trip";

  const smartSummary = isDayScope
    ? `You’re shaping how TripTiles plans ${dayLabel ?? "this day"} — park days, rest rhythm, and meal posture, not ride-by-ride micromanagement.${
        dayHasCalendarTiles
          ? " Your calendar already has tiles for this day — the scope you pick on step 1 decides how much can change."
          : ""
      }`
    : tripDays > 0
      ? `TripTiles will use your answers to structure all ${tripDays} days in ${regionLabel} — parks, rest days, meal windows, and day notes — while detailed ride order still comes from AI Day Strategy later.`
      : `TripTiles will use your answers to structure this trip in ${regionLabel}.`;

  const skipTheLineSection = (
    <section className="rounded-lg border border-royal/15 bg-white/80 px-4 py-3">
      <h3 className="font-sans text-sm font-semibold text-royal">
        Skip-the-line passes
      </h3>
      <p className="mt-1 font-sans text-xs leading-relaxed text-royal/65">
        Turn off what you don&apos;t use so Smart Plan doesn&apos;t assume paid
        queue-skipping products.
      </p>
      <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-royal/10 bg-white/90 p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
          checked={trip.planning_preferences?.includeDisneySkipTips !== false}
          onChange={(e) =>
            void persistSkipLinePrefs(
              e.target.checked,
              trip.planning_preferences?.includeUniversalSkipTips !== false,
            )
          }
          disabled={isGenerating || skipPrefsSaving}
        />
        <span className="min-w-0 font-sans text-xs leading-relaxed text-royal/85">
          <span className="font-semibold text-royal">
            Disney Lightning Lane / Genie+ style tips
          </span>{" "}
          — rope-drop and general queue advice still applies when unchecked.
        </span>
      </label>
      <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-royal/10 bg-white/90 p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
          checked={
            trip.planning_preferences?.includeUniversalSkipTips !== false
          }
          onChange={(e) =>
            void persistSkipLinePrefs(
              trip.planning_preferences?.includeDisneySkipTips !== false,
              e.target.checked,
            )
          }
          disabled={isGenerating || skipPrefsSaving}
        />
        <span className="min-w-0 font-sans text-xs leading-relaxed text-royal/85">
          <span className="font-semibold text-royal">
            Universal Express-style tips
          </span>{" "}
          — off if you don&apos;t hold Express on your tickets.
        </span>
      </label>
    </section>
  );

  const customOver = customText.length > MAX_CHARS;
  const canSubmit = touringSubmitReady
    ? true
    : mode === "custom"
      ? Boolean(customText.trim()) && !customOver
      : smartOnPreviewStep;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-royal/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-plan-title"
    >
      <div className="max-h-[min(92vh,48rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold/40 bg-cream p-6 shadow-xl sm:max-w-xl sm:p-8">
        <h2
          id="smart-plan-title"
          className="font-serif text-xl font-semibold text-royal"
        >
        {isDayScope
          ? dayLabel
            ? `Smart Plan · ${dayLabel}`
            : "Smart Plan this day"
          : "Smart Plan your holiday"}
        </h2>

        {showTouringPlanToggle ? (
          <div
            className="mt-4 flex min-w-0 flex-col gap-2 rounded-lg border border-royal/20 bg-white p-1 sm:flex-row"
            role="tablist"
            aria-label="Day planner mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={dayPlannerSource === "touring"}
              onClick={() => setDayPlannerSource("touring")}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-center font-sans text-sm font-medium transition ${
                dayPlannerSource === "touring"
                  ? "bg-royal text-cream"
                  : "text-royal/80 hover:bg-cream"
              }`}
            >
              Touring Plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dayPlannerSource === "ai"}
              onClick={() => setDayPlannerSource("ai")}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-center font-sans text-sm font-medium transition ${
                dayPlannerSource === "ai"
                  ? "bg-royal text-cream"
                  : "text-royal/80 hover:bg-cream"
              }`}
            >
              Smart Plan (AI)
            </button>
          </div>
        ) : null}

        {touringSubmitReady && touringSequence ? (
          <div className="mt-4 min-w-0">
            <SequenceTimeline
              sequence={touringSequence}
              attractionNameById={mergedAttractionNames}
              onRegenerate={() => void runTouringGenerate()}
            />
          </div>
        ) : null}

        {touringSubmitReady && !touringSequence ? (
          <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
            Choose your pace and passes for today. Trip sequences your priority
            rides using typical waits — dining reservations and Lightning Lane
            windows will slot in automatically once they are linked.
          </p>
        ) : !touringSubmitReady ? (
          <>
            <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
              {smartSummary}
            </p>
            <p className="mt-1 font-sans text-xs leading-relaxed text-royal/60">
              Crowd-aware scheduling uses patterns we ship in-app — not live park
              data. Smart Plan shapes days and intents; AI Day Strategy still
              builds ride-level detail when you open a day.
            </p>
          </>
        ) : null}

        {touringSubmitReady ? (
          <div
            className="mt-4 rounded-xl border border-royal/15 bg-white/90 px-3 py-2.5 font-sans text-xs leading-relaxed text-royal/85"
            role="note"
          >
            <strong className="font-semibold text-royal">Touring Plan:</strong>{" "}
            This is a draft sequence from historic averages — always check
            posted waits and showtimes in-park.
          </div>
        ) : (
          <div
            className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 font-sans text-xs leading-relaxed text-royal/90"
            role="note"
          >
            <strong className="font-semibold text-royal">
              Smart Plan disclaimer:
            </strong>{" "}
            Smart Plan is a draft. It can make mistakes — always verify park
            hours, refurbishments, and reservations with official sources before
            you travel.
          </div>
        )}
        {!touringSubmitReady && mode === "custom" ? (
          <p className="mt-2 font-sans text-[0.7rem] leading-snug text-royal/55">
            <strong className="text-royal/70">Tip:</strong> leave &quot;Overwrite
            existing tiles&quot; off to keep what you&apos;ve placed; use{" "}
            <strong>↶ Undo Smart Plan</strong> after a run if you want to revert.
          </p>
        ) : !touringSubmitReady && smartUsingWizard && smartOnPreviewStep ? (
          <p className="mt-2 font-sans text-[0.7rem] leading-snug text-royal/55">
            <strong className="text-royal/70">Ready:</strong> applying saves your{" "}
            <strong className="text-royal/80">trip planning profile</strong> and runs
            Smart Plan with the scope you chose.
          </p>
        ) : !touringSubmitReady && smartUsingWizard ? (
          <p className="mt-2 font-sans text-[0.7rem] leading-snug text-royal/55">
            Use <strong className="text-royal/80">Next</strong> — you&apos;ll confirm
            everything on the preview step before TripTiles changes the calendar.
          </p>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-4 min-w-0 space-y-4"
        >
          {!touringSubmitReady && mode === "custom" ? (
            <div className="space-y-3">{skipTheLineSection}</div>
          ) : touringSubmitReady ? (
            <div className="space-y-4 rounded-lg border border-royal/15 bg-white/85 px-4 py-4">
              <section>
                <h3 className="font-sans text-sm font-semibold text-royal">
                  Pace today
                </h3>
                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { id: "relaxed" as const, label: "Relaxed" },
                      { id: "balanced" as const, label: "Balanced" },
                      { id: "go-go-go" as const, label: "Go-go-go" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTouringPace(opt.id)}
                      disabled={sequencerBusy || isGenerating}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-left font-sans text-sm font-medium transition ${
                        touringPace === opt.id
                          ? "border-royal bg-white ring-2 ring-royal/20"
                          : "border-royal/15 bg-white hover:border-royal/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="font-sans text-sm font-semibold text-royal">
                  Passes today
                </h3>
                <p className="mt-1 font-sans text-xs leading-relaxed text-royal/65">
                  These change the wait times the plan assumes. Lightning Lane
                  turns your must-dos into ~10&nbsp;min waits; Universal Express
                  turns Express-eligible rides into ~15&nbsp;min waits.
                </p>
                <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-royal/10 bg-cream/50 px-2 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
                    checked={entMultiLl}
                    onChange={(e) => setEntMultiLl(e.target.checked)}
                    disabled={sequencerBusy || isGenerating}
                  />
                  <span className="font-sans text-xs text-royal/85">
                    We have Lightning Lane Multi Pass today
                  </span>
                </label>
                <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-royal/10 bg-cream/50 px-2 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
                    checked={entSingleLl}
                    onChange={(e) => setEntSingleLl(e.target.checked)}
                    disabled={sequencerBusy || isGenerating}
                  />
                  <span className="font-sans text-xs text-royal/85">
                    We have Lightning Lane Single Pass today
                  </span>
                </label>
                <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-royal/10 bg-cream/50 px-2 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
                    checked={entUx}
                    onChange={(e) => setEntUx(e.target.checked)}
                    disabled={sequencerBusy || isGenerating}
                  />
                  <span className="font-sans text-xs text-royal/85">
                    We have Universal Express today
                  </span>
                </label>
                <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-royal/10 bg-cream/50 px-2 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
                    checked={entEarly}
                    onChange={(e) => setEntEarly(e.target.checked)}
                    disabled={sequencerBusy || isGenerating}
                  />
                  <span className="font-sans text-xs text-royal/85">
                    We have Early Entry today
                  </span>
                </label>
              </section>
              <section className="font-sans text-xs leading-relaxed text-royal/80">
                <p>
                  <span className="font-semibold text-royal">Respecting:</span>{" "}
                  {/* TODO(V1.1): Replace with live anchors when the anchor store exists. */}
                  No dining reservations or Lightning Lane windows are linked
                  for this day yet.
                </p>
                <p className="mt-2">
                  <span className="font-semibold text-royal">
                    Routing around your top {prioritiesOnDayParks.length} rides:
                  </span>{" "}
                  {prioritiesOnDayParks.length === 0
                    ? "none picked for these parks yet."
                    : prioritiesOnDayParks
                        .map((r) => r.attraction?.name ?? "Ride")
                        .join(", ")}
                </p>
              </section>
            </div>
          ) : null}

          {!touringSubmitReady ? (
            <>
              <div
                className="flex rounded-lg border border-royal/20 bg-white p-1"
                role="radiogroup"
                aria-label="Plan mode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "smart"}
                  onClick={() => {
                    setMode("smart");
                    setHolidayStep(0);
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-center font-sans text-sm font-medium transition ${
                    mode === "smart"
                      ? "bg-royal text-cream"
                      : "text-royal/80 hover:bg-cream"
                  }`}
                >
                  Smart Plan
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "custom"}
                  onClick={() => setMode("custom")}
                  className={`flex-1 rounded-md px-3 py-2 text-center font-sans text-sm font-medium transition ${
                    mode === "custom"
                      ? "bg-royal text-cream"
                      : "text-royal/80 hover:bg-cream"
                  }`}
                >
                  Custom prompt
                </button>
              </div>

              {mode === "smart" ? (
                <>
                  <div className="rounded-lg border border-gold/40 bg-white/80 px-4 py-3 font-sans text-sm leading-relaxed text-royal">
                    {smartSummary}
                  </div>
                  <div className="max-h-[min(58vh,28rem)] min-h-[12rem] overflow-y-auto pr-1">
                    <SmartPlanHolidayWizardSteps
                      trip={trip}
                      parks={parks}
                      wizard={holidayWizard}
                      setWizard={setHolidayWizard}
                      stepIndex={holidayStep}
                      isDayScope={isDayScope}
                      preview={
                        holidayPreview ?? {
                          totalTripNights: 0,
                          calendarDays: 0,
                          daysWithFilledSlots: 0,
                          fullyEmptyDays: 0,
                        }
                      }
                      isSubmitting={isGenerating || profileSaving}
                    />
                  </div>
                </>
              ) : (
            <label className="block">
              <span className="font-sans text-sm font-medium text-royal">
                Your trip style &amp; priorities
              </span>
              <textarea
                value={customText}
                onChange={(e) =>
                  setCustomText(e.target.value.slice(0, MAX_CHARS))
                }
                rows={6}
                maxLength={MAX_CHARS}
                placeholder={`We're a family of 4 with two kids aged 8 and 10. The kids love roller coasters and Star Wars. My wife hates queueing. We want one rest day in the middle. Budget is moderate.`}
                className="mt-2 w-full resize-y rounded-lg border border-royal/25 px-3 py-3 font-sans text-sm text-royal placeholder:text-royal/35"
                disabled={isGenerating}
              />
              <span
                className={`mt-1 block text-right font-sans text-xs ${
                  customOver ? "text-red-600" : "text-royal/50"
                }`}
              >
                {customText.length} / {MAX_CHARS}
              </span>
            </label>
          )}

          {showFreeTierNote ? (
            <p className="font-sans text-xs text-royal/65">
              Free plan:{" "}
              <strong className="font-semibold text-royal">
                {Math.min(generationsUsedThisTrip, freeTierCap)} of{" "}
                {freeTierCap}
              </strong>{" "}
              generations used for this trip
            </p>
          ) : (
            <p className="font-sans text-xs text-royal/60">
              Paid plans include higher Smart Plan limits and full-day AI tools.
            </p>
          )}

          {mode === "custom" ? (
          <div className="rounded-xl border-2 border-gold/30 bg-gradient-to-b from-white to-cream/90 p-4 shadow-sm">
            <p className="font-serif text-sm font-semibold tracking-tight text-royal">
              Your existing calendar
            </p>
            <p className="mt-1.5 font-sans text-xs leading-relaxed text-royal/70">
              <strong className="font-semibold text-royal/85">Default:</strong>{" "}
              we only fill <strong>empty</strong> AM, PM, lunch, and dinner
              slots. Tiles you&apos;ve already set are left as-is — nothing is
              overwritten unless you choose otherwise below.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-royal/15 bg-white/95 p-3 transition hover:border-gold/40">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
                checked={replaceExistingTiles}
                onChange={(e) => setReplaceExistingTiles(e.target.checked)}
                disabled={isGenerating}
              />
              <span className="min-w-0">
                <span className="block font-sans text-sm font-semibold text-royal">
                  Overwrite my existing tiles where Smart Plan suggests something
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-royal/65">
                  Enable this for a full redo: any slot Smart Plan suggests can
                  replace what you had. Leave unchecked to protect your manual
                  plan.
                </span>
              </span>
            </label>
            {replaceExistingTiles ? (
              <p className="mt-2 rounded-md border border-gold/40 bg-cream/85 px-3 py-2 font-sans text-xs leading-relaxed text-royal">
                <span aria-hidden="true">✓</span>{" "}
                <strong className="font-semibold">Fresh plan:</strong>{" "}
                Smart Plan will design a new itinerary based on your priorities,
                ignoring any existing rest/pool slots. Flights and cruise
                embark/disembark dates stay put.
              </p>
            ) : null}
          </div>
          ) : null}

          <p className="font-sans text-[0.7rem] leading-snug text-royal/55">
            Crowd predictions are based on historical patterns and general
            industry knowledge, not real-time data. Actual crowds vary with
            weather, school holidays, and events. Always confirm official park
            hours before you travel.
          </p>
            </>
          ) : null}

          {submitError ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-900"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          {touringError ? (
            <p
              className="rounded-lg border-2 border-red-300 bg-red-50/95 px-3 py-2 font-sans text-sm text-red-950"
              role="alert"
            >
              {touringError}
            </p>
          ) : null}

          {sequencerBusy ? (
            <div className="rounded-lg border border-royal/20 bg-white/85 px-3 py-2">
              <span className="inline-flex items-center gap-2 font-sans text-sm text-royal/85">
                <LogoSpinner size="sm" className="shrink-0" decorative />
                {SEQUENCER_STATUS_LINES[sequencerStatusIdx]}
              </span>
            </div>
          ) : null}

          {isGenerating ? (
            <div className="rounded-lg border border-royal/20 bg-white/85 px-3 py-2">
              <span className="inline-flex items-center gap-2 font-sans text-sm text-royal/85">
                <LogoSpinner size="sm" className="shrink-0" decorative />
                Smart Plan is thinking — this usually takes 5-10 seconds.
              </span>
            </div>
          ) : null}
          {canRetryPartial ? (
            <button
              type="button"
              onClick={onRetryPartial}
              className="rounded-md border border-royal/30 bg-white px-2.5 py-1.5 font-sans text-xs font-semibold text-royal hover:bg-cream"
            >
              Stopped early — retry?
            </button>
          ) : null}

          <div className="flex flex-wrap items-stretch gap-2 pt-2 sm:items-center">
            <button
              type="button"
              onClick={isGenerating ? onCancelGeneration : onClose}
              disabled={sequencerBusy || profileSaving}
              className="min-h-[44px] rounded-lg border border-royal/30 bg-white px-4 py-2.5 font-sans text-sm font-medium text-royal disabled:opacity-60"
            >
              {isGenerating ? "Stop generating" : "Cancel"}
            </button>
            {smartUsingWizard && holidayStep > 0 ? (
              <button
                type="button"
                onClick={() => setHolidayStep((s) => Math.max(0, s - 1))}
                disabled={isGenerating || sequencerBusy || profileSaving}
                className="min-h-[44px] rounded-lg border border-royal/30 bg-white px-4 py-2.5 font-sans text-sm font-medium text-royal disabled:opacity-60"
              >
                Back
              </button>
            ) : null}
            {smartUsingWizard && !smartOnPreviewStep ? (
              <button
                type="button"
                onClick={handleWizardNext}
                disabled={isGenerating || sequencerBusy || profileSaving}
                className="min-h-[44px] min-w-[10rem] flex-1 rounded-lg px-4 py-3 font-serif text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 sm:min-w-[12rem] bg-[color:var(--tt-ring)]"
              >
                Next
              </button>
            ) : null}
            {!(smartUsingWizard && !smartOnPreviewStep) ? (
            <button
              type="submit"
              disabled={
                isGenerating || sequencerBusy || profileSaving || !canSubmit
              }
              className={`min-h-[44px] min-w-[12rem] flex-1 rounded-lg px-4 py-3 font-serif text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 ${
                (replaceExistingTiles &&
                  mode === "custom" &&
                  !touringSubmitReady) ||
                smartWillOverwriteWholeTrip
                  ? "bg-amber-600"
                  : "bg-[color:var(--tt-ring)]"
              }`}
            >
              {profileSaving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LogoSpinner
                    size="sm"
                    className="shrink-0"
                    variant="onDark"
                    decorative
                  />
                  Saving profile…
                </span>
              ) : isGenerating ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LogoSpinner size="sm" className="shrink-0" variant="onDark" decorative />
                  Generating your plan…
                </span>
              ) : sequencerBusy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LogoSpinner size="sm" className="shrink-0" variant="onDark" decorative />
                  {SEQUENCER_STATUS_LINES[sequencerStatusIdx]}
                </span>
              ) : touringSubmitReady ? (
                "Generate touring plan ✨"
              ) : smartUsingWizard ? (
                isDayScope && dayHasAiTimeline ? (
                  "Apply Smart Plan · Regenerate day ✨"
                ) : (
                  "Apply Smart Plan ✨"
                )
              ) : isDayScope && dayHasAiTimeline ? (
                "Regenerate ✨"
              ) : replaceExistingTiles &&
                  mode === "custom" &&
                  !touringSubmitReady ? (
                "Generate (will overwrite existing tiles)"
              ) : (
                "Generate"
              )}
            </button>
            ) : null}
          </div>
          {!isDayScope ? (
            <p className="mt-3 text-left font-sans text-sm leading-relaxed text-gray-400">
              Just want to tweak one day?{" "}
              <button
                type="button"
                onClick={onClose}
                className="font-semibold text-gold underline decoration-gold/40 underline-offset-2"
              >
                Close and open day view
              </button>
            </p>
          ) : null}
          <p className="mt-4 text-left font-sans text-sm leading-relaxed text-gray-400">
            Prefer to plan manually? Close this and drag parks onto your
            calendar instead — Smart Plan is always optional.
          </p>
        </form>
      </div>
    </div>
  );
}
