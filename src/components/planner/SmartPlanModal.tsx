"use client";

import { daysBetween, parseDate } from "@/lib/date-helpers";
import {
  PACE_OPTIONS,
  PRIORITY_OPTIONS,
} from "@/lib/planning-preference-options";
import type {
  Park,
  PlanningPace,
  Trip,
  TripPlanningPreferences,
} from "@/lib/types";
import { useEffect, useMemo, useState, type FormEvent } from "react";

const MAX_CHARS = 500;
const DEFAULT_FREE_CAP = 5;

export type SmartPlanGeneratePayload = {
  mode: "smart" | "custom";
  userPrompt: string;
  /** When true, Smart Plan overwrites existing calendar tiles where it outputs a slot. */
  replaceExistingTiles: boolean;
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
  onGenerate: (payload: SmartPlanGeneratePayload) => Promise<void>;
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
  onGenerate,
}: Props) {
  const [mode, setMode] = useState<"smart" | "custom">("smart");
  const [pace, setPace] = useState<PlanningPace>("balanced");
  const [mustDoParks, setMustDoParks] = useState<Set<string>>(new Set());
  const [priorities, setPriorities] = useState<Set<string>>(new Set());
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [customText, setCustomText] = useState("");
  const [replaceExistingTiles, setReplaceExistingTiles] = useState(false);

  const prefsSerial = useMemo(() => {
    if (!trip?.planning_preferences) return "";
    return JSON.stringify(trip.planning_preferences);
  }, [trip?.planning_preferences]);

  useEffect(() => {
    if (!isOpen || !trip) return;
    const p = trip.planning_preferences;
    if (p) {
      setPace(p.pace);
      setMustDoParks(new Set(p.mustDoParks ?? []));
      setPriorities(new Set(p.priorities ?? []));
      setAdditionalNotes(p.additionalNotes ?? "");
    } else {
      setPace("balanced");
      setMustDoParks(new Set());
      setPriorities(new Set());
      setAdditionalNotes("");
    }
    setCustomText("");
    setMode("smart");
    setReplaceExistingTiles(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `prefsSerial` tracks planning_preferences; omitting `trip` avoids wiping in-progress edits on parent re-renders.
  }, [isOpen, trip?.id, prefsSerial]);

  if (!isOpen || !trip) return null;

  const tripDays =
    trip.start_date && trip.end_date
      ? daysBetween(parseDate(trip.start_date), parseDate(trip.end_date)) + 1
      : 0;

  const smartSummary =
    tripDays > 0
      ? `I'll build a ${tripDays}-day plan for ${trip.adults} adult${trip.adults === 1 ? "" : "s"}${trip.children ? ` and ${trip.children} child${trip.children === 1 ? "" : "ren"}` : ""} in ${regionLabel}, optimising park days using historical crowd patterns for your dates.`
      : `I'll build a plan for ${regionLabel} using historical crowd patterns for your trip dates.`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trip) return;
    if (isGenerating) return;
    if (mode === "custom" && !customText.trim()) return;
    const planningPreferences: TripPlanningPreferences | undefined =
      mode === "smart"
        ? {
            pace,
            mustDoParks: Array.from(mustDoParks),
            priorities: Array.from(priorities).slice(0, 3),
            additionalNotes: additionalNotes.trim() || null,
            adults: trip.adults,
            children: trip.children,
            childAges: trip.child_ages ?? [],
          }
        : undefined;
    await onGenerate({
      mode,
      userPrompt: mode === "smart" ? "" : customText.trim(),
      replaceExistingTiles,
      planningPreferences,
    });
  }

  const customOver = customText.length > MAX_CHARS;
  const canSubmit =
    mode === "smart" ? true : Boolean(customText.trim()) && !customOver;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-royal/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-plan-title"
    >
      <div className="max-h-[min(92vh,48rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold/40 bg-cream p-6 shadow-xl sm:max-w-xl sm:p-8">
        <h2
          id="smart-plan-title"
          className="font-serif text-xl font-semibold text-royal"
        >
          Let Trip build your itinerary
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
          Tell Trip your priorities — Trip will fill your calendar with
          the best parks, dining, and activities for your family.
        </p>
        <p className="mt-1 font-sans text-xs leading-relaxed text-royal/60">
          Crowd-aware scheduling uses patterns we ship in-app — not live park
          data.
        </p>

        <div
          className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 font-sans text-xs leading-relaxed text-royal/90"
          role="note"
        >
          <strong className="font-semibold text-royal">Smart Plan disclaimer:</strong>{" "}
          Smart Plan is a draft. It can make mistakes — always verify park
          hours, refurbishments, and reservations with official sources before
          you travel.
        </div>
        <p className="mt-2 font-sans text-[0.7rem] leading-snug text-royal/55">
          <strong className="text-royal/70">Tip:</strong> leave &quot;Overwrite
          existing tiles&quot; off to keep what you&apos;ve placed; use{" "}
          <strong>↶ Undo Smart Plan</strong> after a run if you want to revert.
        </p>

        <div
          className="mt-4 flex rounded-lg border border-royal/20 bg-white p-1"
          role="radiogroup"
          aria-label="Plan mode"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "smart"}
            onClick={() => setMode("smart")}
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

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          {mode === "smart" ? (
            <>
              <div className="rounded-lg border border-gold/40 bg-white/80 px-4 py-3 font-sans text-sm leading-relaxed text-royal">
                {smartSummary}
              </div>

              <div className="max-h-[min(52vh,22rem)] space-y-4 overflow-y-auto pr-1">
                <section>
                  <h3 className="font-sans text-sm font-semibold text-royal">
                    What&apos;s your pace?
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {PACE_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPace(p.id)}
                        className={`min-h-[44px] rounded-xl border p-3 text-left text-sm transition ${
                          pace === p.id
                            ? "border-royal bg-white ring-2 ring-royal/20"
                            : "border-royal/15 bg-white hover:border-royal/30"
                        }`}
                        disabled={isGenerating}
                      >
                        <span className="text-lg">{p.emoji}</span>
                        <div className="mt-1 font-semibold text-royal">
                          {p.title}
                        </div>
                        <div className="mt-1 text-xs text-royal/70">
                          {p.body}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-sans text-sm font-semibold text-royal">
                    Any must-do parks?
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMustDoParks(new Set())}
                      className={`min-h-[40px] rounded-full border px-3 py-2 font-sans text-xs ${
                        mustDoParks.size === 0
                          ? "border-royal bg-royal text-cream"
                          : "border-royal/25 bg-white"
                      }`}
                      disabled={isGenerating}
                    >
                      No preference — surprise me!
                    </button>
                    {parks.map((pk) => (
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
                        disabled={isGenerating}
                      >
                        {pk.icon ? `${pk.icon} ` : ""}
                        {pk.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-sans text-sm font-semibold text-royal">
                    What matters most? (pick up to 3)
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map((p) => {
                      const on = priorities.has(p.id);
                      const disabled = !on && priorities.size >= 3;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={disabled || isGenerating}
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
                  <h3 className="font-sans text-sm font-semibold text-royal">
                    Anything else Trip should know? (optional)
                  </h3>
                  <textarea
                    className="mt-2 min-h-[88px] w-full resize-y rounded-lg border border-royal/25 px-3 py-2 font-sans text-sm text-royal placeholder:text-royal/35"
                    maxLength={MAX_CHARS}
                    value={additionalNotes}
                    onChange={(e) =>
                      setAdditionalNotes(e.target.value.slice(0, MAX_CHARS))
                    }
                    placeholder="e.g. My daughter loves Frozen, we need a rest day mid-trip, we are staying at Reunion Resort…"
                    disabled={isGenerating}
                  />
                  <p className="mt-1 text-right font-sans text-xs text-royal/50">
                    {additionalNotes.length} / {MAX_CHARS}
                  </p>
                </section>
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
              Your plan includes higher Smart Plan limits.
            </p>
          )}

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
                  Enable this for a full redo: any slot the model outputs can
                  replace what you had. Leave unchecked to protect your manual
                  plan.
                </span>
              </span>
            </label>
          </div>

          <p className="font-sans text-[0.7rem] leading-snug text-royal/55">
            Crowd predictions are based on historical patterns and general
            industry knowledge, not real-time data. Actual crowds vary with
            weather, school holidays, and events. Always confirm official park
            hours before you travel.
          </p>

          {submitError ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-900"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-lg border border-royal/30 bg-white px-4 py-2.5 font-sans text-sm font-medium text-royal disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !canSubmit}
              className="min-h-[44px] min-w-[12rem] flex-1 rounded-lg bg-[color:var(--tt-ring)] px-4 py-3 font-serif text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
            >
              {isGenerating ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                    aria-hidden
                  />
                  Generating your plan…
                </span>
              ) : (
                "Generate plan ✨"
              )}
            </button>
          </div>
          <p className="mt-4 text-left font-sans text-sm leading-relaxed text-gray-400">
            Prefer to plan manually? Close this and drag parks onto your
            calendar instead — Smart Plan is always optional.
          </p>
        </form>
      </div>
    </div>
  );
}
