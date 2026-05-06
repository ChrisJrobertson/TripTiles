"use client";

import { createTripAction, touchTripAction } from "@/actions/trips";
import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_AUTH_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InlineLoadingOverlay } from "@/components/ui/InlineLoadingOverlay";
import { WizardProgress } from "@/components/ui/WizardProgress";
import { TrippMascotImg } from "@/components/mascot/TrippMascotImg";
import { TrippSpeechBubble } from "@/components/mascot/TrippSpeechBubble";
import { eachDateKeyInRange } from "@/lib/date-helpers";
import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import {
  PACE_OPTIONS,
  PRIORITY_OPTIONS,
} from "@/lib/planning-preference-options";
import {
  regionHasDisneyQueueParks,
  regionHasUniversalQueueParks,
} from "@/lib/wizard-queue-step-region";
import type { ThemeKey } from "@/lib/themes";
import { normaliseThemeKey } from "@/lib/themes";
import type {
  Park,
  PlanningDisneyLightningLane,
  PlanningMobility,
  PlanningMustDoExperience,
  PlanningPace,
  PlanningTripType,
  PlanningUniversalExpress,
  Region,
  TripPlanningPreferences,
} from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TripThemePicker } from "./TripThemePicker";

export type TripCreationWizardProps = {
  regions: Region[];
  parks: Park[];
  includeWelcome: boolean;
  firstName?: string;
  onCancel: () => void;
  onTripCreated?: () => void;
  onTripTierLimit?: () => void;
  variant?: "page" | "modal";
};

const MOBILITY_OPTIONS: { id: PlanningMobility; label: string }[] = [
  { id: "none", label: "None" },
  { id: "stroller", label: "We'll have a stroller" },
  { id: "wheelchair", label: "We'll have a wheelchair" },
  { id: "prefer_shorter_walks", label: "Prefer shorter walking distances" },
];

const TRIP_TYPE_OPTIONS: { id: PlanningTripType; label: string }[] = [
  { id: "first_timer", label: "First time at this destination" },
  { id: "repeat_visitor", label: "We've been before — repeat visitors" },
  { id: "milestone", label: "Special milestone (birthday, first big trip…)" },
  { id: "honeymoon", label: "Honeymoon or anniversary" },
  { id: "multi_generational", label: "Multi-generational (grandparents joining)" },
  { id: "unsure", label: "Not sure yet" },
];

const MUST_DO_EXPERIENCES: {
  id: PlanningMustDoExperience;
  label: string;
  emoji: string;
  tip: string;
}[] = [
  {
    id: "fireworks",
    label: "Fireworks show one evening",
    emoji: "🎆",
    tip: "We&apos;ll treat an evening around the big fireworks as a highlight.",
  },
  {
    id: "character_meals",
    label: "A character meal",
    emoji: "🎭",
    tip: "We'll prioritise seating and timing for a sit-down with characters.",
  },
  {
    id: "rope_drop",
    label: "Rope drop at least once (early starts)",
    emoji: "🚪",
    tip: "Early entry and first-hour strategy for shorter queues.",
  },
  {
    id: "parades",
    label: "A parade",
    emoji: "🎉",
    tip: "We’ll carve out time and viewing spots for daytime or evening parades.",
  },
  {
    id: "dessert_party",
    label: "Dessert party or special dining experience",
    emoji: "🍰",
    tip: "Premium dining or dessert events that need booking awareness.",
  },
  {
    id: "evening_extra",
    label: "Evening Extra hours / After-hours event",
    emoji: "🌙",
    tip: "Late-night ticketed hours when crowds drop — we’ll factor stamina.",
  },
];

function parseChildAges(raw: string, expected: number): number[] {
  if (expected <= 0) return [];
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const n = Math.floor(Number(p));
    if (!Number.isNaN(n) && n >= 0 && n <= 17) out.push(n);
    if (out.length >= expected) break;
  }
  return out;
}

function cmToInRounded(cm: number): number {
  return Math.round(cm / 2.54);
}

function inToCmRounded(inches: number): number {
  return Math.round(inches * 2.54);
}

function HintDetails({ label, children }: { label: string; children: string }) {
  return (
    <details className="mt-1 rounded-tt-md border border-tt-line bg-tt-bg-soft px-3 py-2 font-sans text-xs text-tt-ink-soft">
      <summary className="cursor-pointer font-semibold text-tt-royal outline-none marker:text-tt-gold">
        {label}
      </summary>
      <p className="mt-2 leading-relaxed text-tt-ink-muted">{children}</p>
    </details>
  );
}

export function TripCreationWizard({
  regions,
  parks,
  includeWelcome,
  firstName,
  onCancel,
  onTripCreated,
  onTripTierLimit,
  variant = "page",
}: TripCreationWizardProps) {
  const router = useRouter();
  const minStep = includeWelcome ? 0 : 1;
  const [step, setStep] = useState(minStep);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [includesCruise, setIncludesCruise] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAgesText, setChildAgesText] = useState("");
  const [childHeightsCm, setChildHeightsCm] = useState<number[]>([]);
  const [heightUseInches, setHeightUseInches] = useState<boolean[]>([]);
  const [mobility, setMobility] = useState<PlanningMobility>("none");
  const [pace, setPace] = useState<PlanningPace>("balanced");
  const [tripType, setTripType] = useState<PlanningTripType | null>(null);
  const [mustDoParks, setMustDoParks] = useState<Set<string>>(new Set());
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [mustDoExperiences, setMustDoExperiences] = useState<
    Set<PlanningMustDoExperience>
  >(new Set());
  const [disneyLL, setDisneyLL] = useState<PlanningDisneyLightningLane>({
    multiPassStatus: "not_sure",
    singlePassWillingToPay: "not_sure",
    memoryMaker: "not_sure",
  });
  const [univEx, setUnivEx] = useState<PlanningUniversalExpress>({
    status: "not_sure",
    singleRiderOk: "sometimes",
  });
  const [parkHopping, setParkHopping] = useState<"yes" | "no" | "undecided">(
    "undecided",
  );
  const [expectedFullParkDays, setExpectedFullParkDays] = useState(1);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [planPath, setPlanPath] = useState<"manual" | "ai" | null>(null);
  const [colourTheme, setColourTheme] = useState<ThemeKey>("classic");

  const [llMultiExplainOpen, setLlMultiExplainOpen] = useState(false);
  const [llSingleExplainOpen, setLlSingleExplainOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === regionId) ?? null,
    [regions, regionId],
  );

  const tripDayCount = useMemo(() => {
    if (!startDate || !endDate || startDate >= endDate) return 1;
    return eachDateKeyInRange(startDate, endDate).length;
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate || !endDate || startDate >= endDate) return;
    const cap = Math.max(1, tripDayCount);
    const def = Math.max(1, tripDayCount - 2);
    setExpectedFullParkDays(Math.min(def, cap));
  }, [startDate, endDate, tripDayCount]);

  useEffect(() => {
    setChildHeightsCm((prev) => {
      const next = [...prev];
      while (next.length < children) next.push(100);
      if (next.length > children) return next.slice(0, children);
      return next;
    });
    setHeightUseInches((prev) => {
      const next = [...prev];
      while (next.length < children) next.push(false);
      if (next.length > children) return next.slice(0, children);
      return next;
    });
  }, [children]);

  const defaultAdventure = useMemo(() => {
    const n =
      selectedRegion?.short_name?.trim() ||
      selectedRegion?.name?.trim() ||
      "theme park";
    const y = startDate
      ? String(new Date(startDate + "T12:00:00").getFullYear())
      : String(new Date().getFullYear());
    return `${n} ${y}`;
  }, [selectedRegion, startDate]);

  const parksForRegion = useMemo(() => {
    if (!regionId) return [];
    return parks.filter(
      (p) => !p.is_custom && parkMatchesPlannerRegion(p, regionId),
    );
  }, [parks, regionId]);

  useEffect(() => {
    if (regionId === "cruise") setIncludesCruise(true);
  }, [regionId]);

  const showQueueStep = useMemo(
    () =>
      regionHasDisneyQueueParks(parks, regionId) ||
      regionHasUniversalQueueParks(parks, regionId),
    [parks, regionId],
  );

  const showDisneyBlock = regionHasDisneyQueueParks(parks, regionId);
  const showUniversalBlock = regionHasUniversalQueueParks(parks, regionId);

  const progressCurrent = step === 0 ? 0 : step;
  const PROGRESS_TOTAL = 8;

  const goNext = useCallback(() => {
    setErr(null);
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 5 && !showQueueStep) {
      setStep(7);
      return;
    }
    if (step < 8) setStep((s) => s + 1);
  }, [step, showQueueStep]);

  const goBack = useCallback(() => {
    setErr(null);
    if (step <= minStep) return;
    if (step === 7 && !showQueueStep) {
      setStep(5);
      return;
    }
    setStep((s) => Math.max(minStep, s - 1));
  }, [step, minStep, showQueueStep]);

  const canNext = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return Boolean(regionId);
    if (step === 2) return Boolean(startDate && endDate && startDate < endDate);
    if (step === 3) return adults >= 1 && adults <= 10 && children >= 0 && children <= 10;
    if (step >= 4 && step <= 7) return true;
    if (step === 8) return planPath !== null;
    return false;
  }, [step, regionId, startDate, endDate, adults, children, planPath]);

  const skipStep3 = () => {
    setAdults(2);
    setChildren(0);
    setChildAgesText("");
    setChildHeightsCm([]);
    setHeightUseInches([]);
    setMobility("none");
    goNext();
  };

  const buildPlanningPreferences = (): TripPlanningPreferences | null => {
    const childAges = parseChildAges(childAgesText, children);
    const childHeights =
      children > 0
        ? childHeightsCm.slice(0, children).map((heightCm, i) => ({
            ageOrIndex: childAges[i] ?? i,
            heightCm,
          }))
        : undefined;

    const base: TripPlanningPreferences = {
      pace,
      mustDoParks: Array.from(mustDoParks),
      priorities: Array.from(priorities),
      additionalNotes: additionalNotes.trim() || null,
      adults,
      children,
      childAges,
      mobility,
      ...(tripType ? { tripType } : {}),
      ...(mustDoExperiences.size > 0
        ? { mustDoExperiences: Array.from(mustDoExperiences) }
        : {}),
      ...(childHeights && childHeights.length > 0 ? { childHeights } : {}),
      ...(showDisneyBlock
        ? { disneyLightningLane: { ...disneyLL } }
        : {}),
      ...(showUniversalBlock ? { universalExpress: { ...univEx } } : {}),
      ...(parkHopping !== "undecided" ? { parkHopping } : {}),
      ...(expectedFullParkDays > 0 ? { expectedFullParkDays } : {}),
    };

    return base;
  };

  const submit = useCallback(async () => {
    if (!regionId || !startDate || !endDate || !planPath) return;
    const planningPreferences = buildPlanningPreferences();

    setBusy(true);
    setErr(null);
    try {
      const hasCruise = regionId === "cruise" || includesCruise;
      const res = await createTripAction({
        familyName: "My family",
        adventureName: defaultAdventure.trim(),
        regionId,
        startDate,
        endDate,
        hasCruise,
        adults,
        children,
        childAges: parseChildAges(childAgesText, children),
        planningPreferences,
        colourTheme: normaliseThemeKey(colourTheme),
      });
      if (!res.ok) {
        if (res.code === "TIER_LIMIT_TRIPS") {
          onTripTierLimit?.();
          setErr(null);
        } else if (res.error === "TIER_LIMIT") {
          onTripTierLimit?.();
          setErr(null);
        } else {
          setErr(res.error);
        }
        setBusy(false);
        return;
      }
      await touchTripAction(res.tripId);
      onTripCreated?.();
      if (planPath === "ai") {
        router.replace(`/trip/${res.tripId}?autoGenerate=true`);
        router.refresh();
        return;
      }
      router.replace(`/trip/${res.tripId}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [
    regionId,
    startDate,
    endDate,
    planPath,
    defaultAdventure,
    includesCruise,
    adults,
    children,
    childAgesText,
    colourTheme,
    router,
    onTripCreated,
    onTripTierLimit,
  ]);

  const featured = useMemo(
    () => regions.filter((r) => r.is_featured).slice(0, 24),
    [regions],
  );
  const grid = featured.length > 0 ? featured : regions.slice(0, 24);

  const shell =
    variant === "modal"
      ? "px-2 py-4 sm:px-4"
      : "min-h-screen bg-tt-bg-soft/50 px-4 py-10";

  const skipVisible = step >= 3 && step <= 7 && step !== 6;
  const step6Skippable = step === 6;

  return (
    <InlineLoadingOverlay
      isLoading={busy}
      label="Creating your trip"
      className={shell}
    >
      <div
        className={
          variant === "modal"
            ? "mb-4 flex justify-end gap-4"
            : "absolute right-4 top-4 z-10 flex gap-4"
        }
      >
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <Card
        variant="warm"
        className="mx-auto max-w-lg border-tt-line p-6 shadow-tt-md sm:p-8"
      >
        {variant === "page" ? (
          <div className="mb-5 flex justify-center">
            <TripTilesLogoLink
              href="/planner"
              height={200}
              imgClassName={TRIP_TILES_LOGO_AUTH_IMG_CLASS}
              className="inline-flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tt-surface"
            />
          </div>
        ) : null}

        {step > 0 ? (
          <div className="mb-5">
            <WizardProgress current={progressCurrent} total={PROGRESS_TOTAL} />
          </div>
        ) : (
          <p className="mb-3 text-center font-meta text-xs font-semibold uppercase tracking-wider text-tt-gold">
            Welcome
          </p>
        )}

        {err ? (
          <p
            className="mt-3 rounded-tt-md border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800"
            role="alert"
          >
            {err}
          </p>
        ) : null}

        {step === 0 ? (
          <div className="mt-6 text-center">
            <div className="flex flex-col items-center">
              <TrippMascotImg
                width={80}
                height={80}
                className="h-20 w-20 object-contain"
              />
              <TrippSpeechBubble maxWidthClass="max-w-sm">
                Hi! I&apos;m Tripp. Let&apos;s build your perfect adventure. 🐾
              </TrippSpeechBubble>
            </div>
            <h1 className="mt-8 font-heading text-2xl font-semibold text-tt-royal md:text-3xl">
              Welcome{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-3 font-sans text-sm leading-relaxed text-tt-royal/75">
              Let&apos;s set up your first adventure — it only takes a minute.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              Where are you going?
            </h1>
            <div className="mt-4 grid max-h-[min(360px,50vh)] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {grid.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegionId(r.id)}
                  className={`min-h-[44px] rounded-xl border px-3 py-3 text-left font-sans text-sm transition ${
                    regionId === r.id
                      ? "border-tt-gold bg-tt-gold-soft"
                      : "border-tt-royal/15 bg-cream hover:border-tt-gold/40"
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {r.flag_emoji ?? "🌍"}
                  </span>
                  <p className="mt-1 font-semibold text-tt-royal">
                    {r.short_name?.trim() || r.name}
                  </p>
                </button>
              ))}
            </div>
            {regionId ? (
              <div className="mt-5 rounded-xl border border-tt-royal/15 bg-cream/80 p-4">
                <p className="font-sans text-sm font-semibold text-tt-royal">
                  Does your trip include a cruise?
                </p>
                {regionId === "cruise" ? (
                  <p className="mt-2 font-sans text-sm text-tt-royal/75">
                    You&apos;ve picked a cruise-focused region — ship and port
                    tiles stay available in your drawer.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIncludesCruise(false)}
                      className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 font-sans text-sm font-semibold transition ${
                        !includesCruise
                          ? "border-tt-royal bg-tt-royal text-white"
                          : "border-tt-royal/25 bg-white text-tt-royal"
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncludesCruise(true)}
                      className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 font-sans text-sm font-semibold transition ${
                        includesCruise
                          ? "border-tt-royal bg-tt-royal text-white"
                          : "border-tt-royal/25 bg-white text-tt-royal"
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              When are you going?
            </h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-sans text-sm text-tt-royal">
                Start date
                <input
                  type="date"
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block font-sans text-sm text-tt-royal">
                End date
                <input
                  type="date"
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              Who&apos;s going?
            </h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-sans text-sm text-tt-royal">
                Adults
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2"
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                />
              </label>
              <label className="block font-sans text-sm text-tt-royal">
                Children
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2"
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                />
              </label>
            </div>
            {children > 0 ? (
              <>
                <label className="block font-sans text-sm text-tt-royal">
                  Children&apos;s ages (years, comma-separated)
                  <input
                    className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2"
                    value={childAgesText}
                    onChange={(e) => setChildAgesText(e.target.value)}
                    placeholder="e.g. 5, 8"
                  />
                </label>
                {childHeightsCm.slice(0, children).map((cm, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-tt-royal/10 bg-cream/50 p-3"
                  >
                    <p className="font-sans text-sm font-semibold text-tt-royal">
                      Child {idx + 1} height
                    </p>
                    <label className="mt-2 flex min-h-[44px] items-center gap-2 font-sans text-xs text-tt-royal/80">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-tt-royal"
                        checked={heightUseInches[idx] ?? false}
                        onChange={(e) => {
                          setHeightUseInches((prev) => {
                            const n = [...prev];
                            n[idx] = e.target.checked;
                            return n;
                          });
                        }}
                      />
                      Use inches
                    </label>
                    <input
                      type="number"
                      min={heightUseInches[idx] ? 20 : 40}
                      max={heightUseInches[idx] ? 78 : 200}
                      className="mt-2 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2"
                      value={
                        heightUseInches[idx]
                          ? cmToInRounded(cm)
                          : cm
                      }
                      onChange={(e) => {
                        const v = Math.floor(Number(e.target.value));
                        if (Number.isNaN(v)) return;
                        setChildHeightsCm((prev) => {
                          const n = [...prev];
                          const inches = heightUseInches[idx] ?? false;
                          n[idx] = inches ? inToCmRounded(v) : v;
                          return n;
                        });
                      }}
                    />
                    <HintDetails label="Why we ask (?)" >
                      We use this to flag rides your child can&apos;t ride. Disney rides often require 38, 40, 44, or 48 inches; we&apos;ll warn you automatically.
                    </HintDetails>
                  </div>
                ))}
              </>
            ) : null}
            <div>
              <label className="font-sans text-sm font-semibold text-tt-royal">
                Mobility considerations
              </label>
              <select
                className="mt-2 min-h-[44px] w-full rounded-lg border-2 border-tt-royal/20 bg-white px-3 py-2 font-sans text-sm"
                value={mobility}
                onChange={(e) =>
                  setMobility(e.target.value as PlanningMobility)
                }
              >
                {MOBILITY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <HintDetails label="What this means (?)" >
                We&apos;ll factor walking distance and stroller parking into your day plans.
              </HintDetails>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-6 space-y-5">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              What kind of holiday is this?
            </h1>
            <section>
              <h2 className="font-sans text-sm font-semibold text-tt-royal">
                Pace
              </h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {PACE_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id)}
                    className={`min-h-[44px] rounded-xl border p-3 text-left text-sm transition ${
                      pace === p.id
                        ? "border-tt-gold bg-tt-gold-soft ring-2 ring-tt-gold/35"
                        : "border-tt-royal/15 bg-cream hover:border-tt-royal/30"
                    }`}
                  >
                    <span className="text-lg">{p.emoji}</span>
                    <div className="mt-1 font-semibold text-tt-royal">{p.title}</div>
                    <div className="mt-1 text-xs text-tt-royal/70">{p.body}</div>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-sans text-sm font-semibold text-tt-royal">
                Trip type
              </h2>
              <HintDetails label="Why we ask (?)" >
                We&apos;ll tailor your plan — first-timers get crowd-strategy tips, milestones get reservation timing, and so on.
              </HintDetails>
              <div className="mt-2 flex flex-col gap-2">
                {TRIP_TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTripType(t.id)}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-left font-sans text-sm ${
                      tripType === t.id
                        ? "border-tt-royal bg-tt-royal text-white"
                        : "border-tt-royal/20 bg-white text-tt-royal"
                    }`}
                  >
                    {t.label.replace(/&apos;/g, "'")}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="mt-6 max-h-[min(72vh,40rem)] space-y-5 overflow-y-auto pr-1">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              What do you want from the trip?
            </h1>
            <section>
              <h2 className="font-sans text-sm font-semibold text-tt-royal">
                Priorities
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((p) => {
                  const on = priorities.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPriorities((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        });
                      }}
                      className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs ${
                        on
                          ? "border-tt-royal bg-tt-royal text-white"
                          : "border-tt-royal/25 bg-white"
                      }`}
                    >
                      {p.emoji} {p.label}
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="font-sans text-sm font-semibold text-tt-royal">
                Must-do experiences
              </h2>
              <div className="mt-2 flex flex-col gap-2">
                {MUST_DO_EXPERIENCES.map((x) => {
                  const on = mustDoExperiences.has(x.id);
                  return (
                    <div key={x.id} className="rounded-lg border border-tt-royal/10 bg-cream/60 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMustDoExperiences((prev) => {
                            const n = new Set(prev);
                            if (n.has(x.id)) n.delete(x.id);
                            else n.add(x.id);
                            return n;
                          });
                        }}
                        className={`flex min-h-[44px] w-full items-center gap-2 rounded-md px-2 text-left font-sans text-sm ${
                          on ? "font-semibold text-tt-royal" : "text-tt-royal/85"
                        }`}
                      >
                        <span>{x.emoji}</span>
                        {x.label}
                      </button>
                      <p className="px-2 pb-2 font-sans text-[11px] text-tt-royal/65">
                        {x.tip.replace(/&apos;/g, "'")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="font-sans text-sm font-semibold text-tt-royal">
                Must-visit parks (optional)
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {parksForRegion.map((pk) => (
                  <button
                    key={pk.id}
                    type="button"
                    onClick={() => {
                      setMustDoParks((prev) => {
                        const n = new Set(prev);
                        if (n.has(pk.id)) n.delete(pk.id);
                        else n.add(pk.id);
                        return n;
                      });
                    }}
                    className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs ${
                      mustDoParks.has(pk.id)
                        ? "border-tt-royal bg-tt-royal text-white"
                        : "border-tt-royal/25 bg-white"
                    }`}
                  >
                    {pk.icon ? `${pk.icon} ` : ""}
                    {pk.name}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="mt-6 max-h-[min(72vh,42rem)] space-y-5 overflow-y-auto pr-1">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              How are you handling the queues?
            </h1>
            <p className="font-sans text-sm text-tt-royal/75">
              These help us suggest the best ride order. Don&apos;t worry if you
              don&apos;t know — pick Not sure and we&apos;ll explain on each day.
            </p>
            {!showQueueStep ? (
              <div className="rounded-xl border border-tt-royal/15 bg-cream p-4 font-sans text-sm text-tt-royal/80">
                Skip-the-line details aren&apos;t required for this destination.
              </div>
            ) : null}
            {showDisneyBlock ? (
              <section className="rounded-xl border border-tt-royal/10 bg-cream/60 p-4">
                <h2 className="font-heading text-lg font-semibold text-tt-royal">
                  Disney — Lightning Lane
                </h2>
                <p className="mt-1 font-sans text-xs text-tt-royal/70">
                  Lightning Lane Multi Pass
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {(
                    [
                      ["all_park_days", "Yes — for all park days"],
                      ["some_park_days", "Yes — for some park days"],
                      ["none", "No"],
                      ["not_sure", "Not sure"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDisneyLL((d) => ({ ...d, multiPassStatus: id }))
                      }
                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-left font-sans text-sm ${
                        disneyLL.multiPassStatus === id
                          ? "border-tt-gold bg-white"
                          : "border-tt-royal/15 bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 font-sans text-xs font-semibold text-gold underline"
                  onClick={() => setLlMultiExplainOpen((v) => !v)}
                >
                  What&apos;s Multi Pass?
                </button>
                {llMultiExplainOpen ? (
                  <p className="mt-2 rounded-lg bg-cream px-3 py-2 font-sans text-xs leading-relaxed text-tt-royal/85">
                    Lightning Lane Multi Pass lets you skip the standby queue at one
                    ride per booking. You book up to three rides per day in advance
                    via the My Disney Experience app. Free with Multi Pass tickets,
                    otherwise costs extra.
                  </p>
                ) : null}

                <p className="mt-4 font-sans text-xs font-semibold text-tt-royal/70">
                  Single Pass — willing to pay for one or two headliners?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["yes", "no", "not_sure"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDisneyLL((d) => ({
                          ...d,
                          singlePassWillingToPay: id,
                        }))
                      }
                      className={`min-h-[44px] flex-1 rounded-lg border px-2 py-2 font-sans text-xs ${
                        disneyLL.singlePassWillingToPay === id
                          ? "border-tt-royal bg-tt-royal text-white"
                          : "border-tt-royal/20 bg-white"
                      }`}
                    >
                      {id === "not_sure" ? "Not sure" : id[0]!.toUpperCase() + id.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 font-sans text-xs font-semibold text-gold underline"
                  onClick={() => setLlSingleExplainOpen((v) => !v)}
                >
                  What&apos;s Single Pass?
                </button>
                {llSingleExplainOpen ? (
                  <p className="mt-2 rounded-lg bg-cream px-3 py-2 font-sans text-xs leading-relaxed text-tt-royal/85">
                    Single Pass is a separate paid pass for the most popular rides
                    — for example Rise of the Resistance or Tron. Often roughly
                    £15–25 per person per ride.
                  </p>
                ) : null}

                <p className="mt-4 font-sans text-xs font-semibold text-tt-royal/70">
                  Memory Maker / PhotoPass?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["yes", "no", "not_sure"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDisneyLL((d) => ({ ...d, memoryMaker: id }))
                      }
                      className={`min-h-[44px] flex-1 rounded-lg border px-2 py-2 font-sans text-xs ${
                        disneyLL.memoryMaker === id
                          ? "border-tt-royal bg-tt-royal text-white"
                          : "border-tt-royal/20 bg-white"
                      }`}
                    >
                      {id === "not_sure" ? "Not sure" : id[0]!.toUpperCase() + id.slice(1)}
                    </button>
                  ))}
                </div>
                <HintDetails label="What is Memory Maker? (?)" >
                  Disney photographers in the parks who upload photos to your account.
                </HintDetails>
              </section>
            ) : null}

            {showUniversalBlock ? (
              <section className="rounded-xl border border-tt-royal/10 bg-cream/60 p-4">
                <h2 className="font-heading text-lg font-semibold text-tt-royal">
                  Universal — Express &amp; Single Rider
                </h2>
                <HintDetails label="About Express Pass (?)" >
                  Universal Express Pass lets you skip the standby queue. Free at
                  deluxe Universal hotels (for example Hard Rock, Royal Pacific,
                  Portofino). Often around £90–200 per day otherwise.
                </HintDetails>
                <p className="mt-3 font-sans text-xs font-semibold text-tt-royal/70">
                  Express Pass status
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {(
                    [
                      ["included_with_hotel", "Included with our hotel"],
                      ["paid", "Paid extra"],
                      ["no", "No Express Pass"],
                      ["not_sure", "Not sure"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setUnivEx((u) => ({ ...u, status: id }))}
                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-left font-sans text-sm ${
                        univEx.status === id
                          ? "border-tt-gold bg-white"
                          : "border-tt-royal/15 bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 font-sans text-xs font-semibold text-tt-royal/70">
                  Single Rider lanes — happy to use them?
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {(
                    [
                      ["yes", "Yes — splitting up is fine"],
                      ["sometimes", "Sometimes — depends on the ride"],
                      ["no", "No — we want to ride together"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setUnivEx((u) => ({ ...u, singleRiderOk: id }))
                      }
                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-left font-sans text-sm ${
                        univEx.singleRiderOk === id
                          ? "border-tt-gold bg-white"
                          : "border-tt-royal/15 bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <HintDetails label="What is Single Rider? (?)" >
                  Many Universal rides fill empty seats from a separate queue —
                  often much shorter, but your party may be split across vehicles.
                </HintDetails>
              </section>
            ) : null}
          </div>
        ) : null}

        {step === 7 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              Park days vs rest days?
            </h1>
            <HintDetails label="About park hopping (?)" >
              Hopping needs Park Hopper tickets. Most plans don&apos;t need it,
              but it&apos;s useful on short trips.
            </HintDetails>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["yes", "Yes — happy to do multiple parks per day"],
                  ["no", "No — one park per day max"],
                  ["undecided", "Haven&apos;t decided"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setParkHopping(id)}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-left font-sans text-sm ${
                    parkHopping === id
                      ? "border-tt-royal bg-tt-royal text-white"
                      : "border-tt-royal/20 bg-white text-tt-royal"
                  }`}
                >
                  {label.replace(/&apos;/g, "'")}
                </button>
              ))}
            </div>
            <div>
              <label className="font-sans text-sm font-semibold text-tt-royal">
                Roughly how many full park days? ({expectedFullParkDays} of max{" "}
                {Math.max(1, tripDayCount)})
              </label>
              <input
                type="range"
                min={1}
                max={Math.max(1, tripDayCount)}
                value={Math.min(expectedFullParkDays, Math.max(1, tripDayCount))}
                onChange={(e) =>
                  setExpectedFullParkDays(Number(e.target.value))
                }
                className="mt-2 w-full accent-tt-gold"
              />
            </div>
            <div>
              <h2 className="font-sans text-sm font-semibold text-tt-royal">
                Colours
              </h2>
              <p className="mt-1 font-sans text-xs text-tt-royal/65">
                Pick a planner theme — you can change this anytime from the trip
                menu.
              </p>
              <TripThemePicker value={colourTheme} onChange={setColourTheme} />
            </div>
          </div>
        ) : null}

        {step === 8 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-heading text-xl font-semibold text-tt-royal">
              Anything we should know?
            </h1>
            <p className="font-sans text-sm text-tt-royal/75">
              How should we build your calendar to start?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPlanPath("manual")}
                className={`min-h-[120px] rounded-2xl border p-4 text-left transition ${
                  planPath === "manual"
                    ? "border-tt-royal ring-2 ring-tt-royal/30"
                    : "border-tt-royal/20 bg-cream"
                }`}
              >
                <span className="font-heading font-semibold text-tt-royal">
                  I&apos;ll plan it myself
                </span>
                <p className="mt-2 font-sans text-xs text-tt-royal/75">
                  Blank calendar — your answers still save for AI features later.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPlanPath("ai")}
                className={`min-h-[120px] rounded-2xl border border-l-4 border-l-gold p-4 text-left transition ${
                  planPath === "ai"
                    ? "border-tt-gold ring-2 ring-tt-gold/35"
                    : "border-tt-royal/20 bg-cream"
                }`}
              >
                <span className="font-heading font-semibold text-tt-royal">
                  Let Trip build my plan
                </span>
                <p className="mt-2 font-sans text-xs text-tt-royal/75">
                  Smart Plan fills your trip after you finish.
                </p>
              </button>
            </div>
            <label className="block font-sans text-sm text-tt-royal">
              Notes for Trip (optional)
              <textarea
                className="mt-2 min-h-[120px] w-full rounded-lg border-2 border-tt-royal/20 px-3 py-2 font-sans text-sm"
                maxLength={2000}
                value={additionalNotes}
                onChange={(e) =>
                  setAdditionalNotes(e.target.value.slice(0, 2000))
                }
                placeholder='e.g. "We&apos;re staying at Reunion Resort", "My daughter loves Frozen", "Need a rest day mid-trip"'
              />
              <span className="mt-1 block text-right text-xs text-tt-royal/50">
                {additionalNotes.length} / 2000
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 border-t border-tt-line-soft pt-6 sm:flex-row sm:flex-wrap">
          {step > minStep ? (
            <Button type="button" variant="secondary" size="md" onClick={goBack}>
              ← Back
            </Button>
          ) : step === 1 ? (
            <Button type="button" variant="secondary" size="md" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}

          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            {skipVisible ? (
              <Button
                type="button"
                variant="accent"
                size="md"
                className="border border-tt-gold/40 bg-tt-gold-soft text-tt-royal shadow-none hover:bg-tt-gold-soft/90"
                onClick={() => {
                  if (step === 3) skipStep3();
                  else goNext();
                }}
              >
                Skip — I&apos;ll add this later
              </Button>
            ) : null}
            {step6Skippable && showQueueStep ? (
              <Button
                type="button"
                variant="accent"
                size="md"
                className="border border-tt-gold/40 bg-tt-gold-soft text-tt-royal shadow-none hover:bg-tt-gold-soft/90"
                onClick={goNext}
              >
                Skip — I&apos;ll add this later
              </Button>
            ) : null}
            {step < 8 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!canNext}
                onClick={goNext}
                className="sm:max-w-[14rem] sm:flex-none"
              >
                Next →
              </Button>
            ) : (
              <Button
                type="button"
                variant="accent"
                size="md"
                disabled={busy || !canNext}
                loading={busy}
                loadingLabel="Creating your trip"
                onClick={() => void submit()}
                className="sm:max-w-[14rem] sm:flex-none"
              >
                Finish ✨
              </Button>
            )}
          </div>
        </div>

        {!includeWelcome && step === 1 ? null : (
          <p className="mt-8 text-center font-sans text-xs text-tt-ink-soft">
            <Link href="/" className="text-tt-royal underline underline-offset-2">
              Home
            </Link>
          </p>
        )}
      </Card>
    </InlineLoadingOverlay>
  );
}
