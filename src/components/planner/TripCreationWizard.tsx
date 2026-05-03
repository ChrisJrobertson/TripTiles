"use client";

import { createTripAction, touchTripAction } from "@/actions/trips";
import { TripTilesLogoLink } from "@/components/brand/TripTilesLogoLink";
import { TRIP_TILES_LOGO_AUTH_IMG_CLASS } from "@/components/brand/triptiles-logo-sizes";
import { InlineLoadingOverlay } from "@/components/ui/InlineLoadingOverlay";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { TrippMascotImg } from "@/components/mascot/TrippMascotImg";
import { TrippSpeechBubble } from "@/components/mascot/TrippSpeechBubble";
import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import type { ThemeKey } from "@/lib/themes";
import { normaliseThemeKey } from "@/lib/themes";
import {
  PACE_OPTIONS,
  PRIORITY_OPTIONS,
} from "@/lib/planning-preference-options";
import type {
  Park,
  PlanningPace,
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
  /** Called after the trip is created successfully (closes planner overlay). */
  onTripCreated?: () => void;
  /** Server hit active-trip cap (Free vs paid). */
  onTripTierLimit?: () => void;
  /** Full-page onboarding vs modal overlay from planner. */
  variant?: "page" | "modal";
};

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
  const [step, setStep] = useState(includeWelcome ? 0 : 1);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [includesCruise, setIncludesCruise] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAgesText, setChildAgesText] = useState("");
  const [adventureName, setAdventureName] = useState("");
  const [planPath, setPlanPath] = useState<"manual" | "ai" | null>(null);
  const [pace, setPace] = useState<PlanningPace>("balanced");
  const [mustDoParks, setMustDoParks] = useState<Set<string>>(new Set());
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [colourTheme, setColourTheme] = useState<ThemeKey>("classic");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === regionId) ?? null,
    [regions, regionId],
  );

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

  const maxStep = 7;
  const progressLabel = includeWelcome
    ? `Step ${step + 1} of ${maxStep + 1}`
    : `Step ${step} of ${maxStep}`;

  const goNext = useCallback(() => {
    setErr(null);
    if (step === 5 && planPath === "manual") {
      setStep(7);
      return;
    }
    if (step === 5 && planPath === "ai") {
      setStep(6);
      return;
    }
    if (step < maxStep) setStep((s) => s + 1);
  }, [step, planPath]);

  const goBack = useCallback(() => {
    setErr(null);
    if (step === 0) return;
    if (step === 7 && planPath === "manual") {
      setStep(5);
      return;
    }
    setStep((s) => Math.max(includeWelcome ? 0 : 1, s - 1));
  }, [step, planPath, includeWelcome]);

  const canNext = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return Boolean(regionId);
    if (step === 2) return Boolean(startDate && endDate && startDate < endDate);
    if (step === 3) return adults >= 1 && adults <= 10 && children >= 0 && children <= 10;
    if (step === 4) return true;
    if (step === 5) return planPath !== null;
    if (step === 6) return true;
    if (step === 7) return true;
    return false;
  }, [
    step,
    regionId,
    startDate,
    endDate,
    adults,
    children,
    planPath,
  ]);

  const submit = useCallback(async () => {
    if (!regionId || !startDate || !endDate || !planPath) return;
    const name = adventureName.trim() || defaultAdventure;
    const childAges = parseChildAges(childAgesText, children);
    const planningPreferences: TripPlanningPreferences | null =
      planPath === "ai"
        ? {
            pace,
            mustDoParks: Array.from(mustDoParks),
            priorities: Array.from(priorities).slice(0, 3),
            additionalNotes: additionalNotes.trim() || null,
            adults,
            children,
            childAges,
          }
        : null;

    setBusy(true);
    setErr(null);
    try {
      const hasCruise = regionId === "cruise" || includesCruise;
      const res = await createTripAction({
        familyName: "My family",
        adventureName: name,
        regionId,
        startDate,
        endDate,
        hasCruise,
        adults,
        children,
        childAges,
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
    adventureName,
    defaultAdventure,
    childAgesText,
    children,
    pace,
    mustDoParks,
    priorities,
    additionalNotes,
    adults,
    colourTheme,
    router,
    onTripCreated,
    onTripTierLimit,
    includesCruise,
  ]);

  const featured = useMemo(
    () => regions.filter((r) => r.is_featured).slice(0, 24),
    [regions],
  );
  const grid = featured.length > 0 ? featured : regions.slice(0, 24);

  const shell =
    variant === "modal"
      ? "px-2 py-4 sm:px-4"
      : "min-h-screen bg-transparent px-4 py-10";

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
            : "absolute right-4 top-4 flex gap-4"
        }
      >
        <button
          type="button"
          onClick={onCancel}
          className="font-sans text-sm font-medium text-royal/70 underline-offset-2 hover:text-royal"
        >
          Cancel
        </button>
      </div>

      <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-6 shadow-lg sm:p-8">
        {variant === "page" ? (
          <div className="mb-5 flex justify-center">
            <TripTilesLogoLink
              href="/planner"
              height={200}
              imgClassName={TRIP_TILES_LOGO_AUTH_IMG_CLASS}
              className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
            />
          </div>
        ) : null}
        <p className="font-sans text-xs font-semibold uppercase tracking-wider text-gold">
          {progressLabel}
        </p>
        {err ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800">
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
            <h1 className="mt-8 font-serif text-2xl font-semibold text-royal md:text-3xl">
              Welcome{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
              Let&apos;s set up your first adventure — it only takes a minute.
            </p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Where are you going?
            </h1>
            <div className="mt-4 grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {grid.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRegionId(r.id);
                    setAdventureName("");
                  }}
                  className={`min-h-[44px] rounded-xl border px-3 py-3 text-left font-sans text-sm transition ${
                    regionId === r.id
                      ? "border-gold bg-gold/15"
                      : "border-royal/15 bg-cream hover:border-gold/40"
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {r.flag_emoji ?? "🌍"}
                  </span>
                  <p className="mt-1 font-semibold text-royal">
                    {r.short_name?.trim() || r.name}
                  </p>
                </button>
              ))}
            </div>
            {regionId ? (
              <div className="mt-5 rounded-xl border border-royal/15 bg-cream/80 p-4">
                <p className="font-sans text-sm font-semibold text-royal">
                  Does your trip include a cruise?
                </p>
                {regionId === "cruise" ? (
                  <p className="mt-2 font-sans text-sm text-royal/75">
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
                          ? "border-royal bg-royal text-cream"
                          : "border-royal/25 bg-white text-royal"
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncludesCruise(true)}
                      className={`min-h-[44px] flex-1 rounded-lg border px-3 py-2 font-sans text-sm font-semibold transition ${
                        includesCruise
                          ? "border-royal bg-royal text-cream"
                          : "border-royal/25 bg-white text-royal"
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
            <h1 className="font-serif text-xl font-semibold text-royal">
              When&apos;s your trip?
            </h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-sans text-sm text-royal">
                Start date
                <input
                  type="date"
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block font-sans text-sm text-royal">
                End date
                <input
                  type="date"
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Who&apos;s coming?
            </h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-sans text-sm text-royal">
                Adults
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                />
              </label>
              <label className="block font-sans text-sm text-royal">
                Children
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                />
              </label>
            </div>
            {children > 0 ? (
              <label className="block font-sans text-sm text-royal">
                Children&apos;s ages (years, comma-separated)
                <input
                  className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={childAgesText}
                  onChange={(e) => setChildAgesText(e.target.value)}
                  placeholder="e.g. 5, 8"
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-6 space-y-3">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Give your trip a name
            </h1>
            <label className="block font-sans text-sm text-royal">
              Trip name
              <input
                className="mt-1 min-h-[44px] w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                value={adventureName}
                onChange={(e) => setAdventureName(e.target.value)}
                placeholder="e.g. Robertson Orlando 2026"
              />
            </label>
            <p className="font-sans text-xs text-royal/55">
              Suggested:{" "}
              <button
                type="button"
                className="font-medium text-gold underline"
                onClick={() => setAdventureName(defaultAdventure)}
              >
                {defaultAdventure}
              </button>
            </p>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-serif text-xl font-semibold text-royal">
              How do you want to plan?
            </h1>
            <p className="font-sans text-sm text-royal/75">
              Both choices are equally good — pick what suits your family.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPlanPath("manual")}
                className={`flex min-h-[180px] flex-col rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ${
                  planPath === "manual"
                    ? "border-royal ring-2 ring-royal/30"
                    : "border-royal/20 bg-cream hover:border-royal/35"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  📅
                </span>
                <span className="mt-2 font-serif text-lg font-semibold text-royal">
                  I&apos;ll plan it myself
                </span>
                <p className="mt-2 flex-1 font-sans text-sm text-royal/80">
                  Start with a blank calendar and drag parks, restaurants, and
                  activities into each day. Full control, your way.
                </p>
                <span className="mt-2 inline-block rounded-full border border-royal/20 px-2 py-0.5 font-sans text-[0.65rem] font-semibold text-royal/80">
                  Free to use
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPlanPath("ai")}
                className={`flex min-h-[180px] flex-col rounded-2xl border border-royal/20 border-l-4 border-l-gold p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                  planPath === "ai"
                    ? "border-gold ring-2 ring-gold/35"
                    : "border-royal/20 bg-cream hover:border-gold/40"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  ✨
                </span>
                <span className="mt-2 font-serif text-lg font-semibold text-royal">
                  Let Trip build my plan
                </span>
                <p className="mt-2 flex-1 font-sans text-sm text-royal/80">
                  Answer a few questions about your trip and Trip will create a
                  complete day-by-day itinerary in seconds. Tweak everything
                  afterwards.
                </p>
                <span className="mt-2 inline-block rounded-full border border-gold/40 px-2 py-0.5 font-sans text-[0.65rem] font-semibold text-royal">
                  Smart Plan ✨
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {step === 6 && planPath === "ai" ? (
          <div className="mt-6 max-h-[min(72vh,36rem)] space-y-6 overflow-y-auto pr-1">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Tell us about your ideal trip
            </h1>

            <section>
              <h2 className="font-sans text-sm font-semibold text-royal">
                What&apos;s your pace?
              </h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {PACE_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id)}
                    className={`min-h-[44px] rounded-xl border p-3 text-left text-sm transition ${
                      pace === p.id
                        ? "border-royal bg-white ring-2 ring-royal/20"
                        : "border-royal/15 bg-cream hover:border-royal/30"
                    }`}
                  >
                    <span className="text-lg">{p.emoji}</span>
                    <div className="mt-1 font-semibold text-royal">{p.title}</div>
                    <div className="mt-1 text-xs text-royal/70">{p.body}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-sans text-sm font-semibold text-royal">
                Any must-do parks?
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMustDoParks(new Set())}
                  className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs ${
                    mustDoParks.size === 0
                      ? "border-royal bg-royal text-cream"
                      : "border-royal/25 bg-white"
                  }`}
                >
                  No preference — surprise me!
                </button>
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
                        ? "border-royal bg-royal text-cream"
                        : "border-royal/25 bg-white"
                    }`}
                  >
                    {pk.icon ? `${pk.icon} ` : ""}
                    {pk.name}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-sans text-sm font-semibold text-royal">
                What matters most? (pick up to 3)
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((p) => {
                  const on = priorities.has(p.id);
                  const disabled = !on && priorities.size >= 3;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setPriorities((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else if (n.size < 3) n.add(p.id);
                          return n;
                        });
                      }}
                      className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs disabled:opacity-40 ${
                        on
                          ? "border-royal bg-royal text-cream"
                          : "border-royal/25 bg-white"
                      }`}
                    >
                      {p.emoji} {p.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="font-sans text-sm font-semibold text-royal">
                Anything else Trip should know? (optional)
              </h2>
              <textarea
                className="mt-2 min-h-[100px] w-full rounded-lg border-2 border-royal/20 px-3 py-2 font-sans text-sm"
                maxLength={500}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value.slice(0, 500))}
                placeholder="e.g. My daughter loves Frozen, we need a rest day mid-trip, we are staying at Reunion Resort…"
              />
              <p className="mt-1 text-right font-sans text-xs text-royal/50">
                {additionalNotes.length} / 500
              </p>
            </section>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="mt-6 space-y-4">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Choose your colours
            </h1>
            <p className="font-sans text-sm text-royal/75">
              Pick a planner theme — you can change this anytime in the trip
              menu.
            </p>
            <TripThemePicker value={colourTheme} onChange={setColourTheme} />
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-2">
          {step > (includeWelcome ? 0 : 1) ? (
            <button
              type="button"
              onClick={goBack}
              className="min-h-[44px] rounded-lg border border-royal/30 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] rounded-lg border border-royal/30 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Cancel
            </button>
          )}
          {step < maxStep ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={goNext}
              className="min-h-[44px] flex-1 rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="min-h-[44px] flex-1 rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 py-2 font-serif text-sm font-semibold text-royal disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <LogoSpinner size="sm" decorative className="shrink-0" />
                  <span>Creating your trip</span>
                </span>
              ) : (
                "Finish"
              )}
            </button>
          )}
        </div>

        <p className="mt-8 text-center font-sans text-xs text-royal/45">
          <Link href="/" className="underline">
            Home
          </Link>
        </p>
      </div>
    </InlineLoadingOverlay>
  );
}
