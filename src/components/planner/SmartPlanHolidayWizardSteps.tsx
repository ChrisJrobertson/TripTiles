"use client";

import type {
  HolidaySmartPreview,
  HolidaySmartWizardState,
  SmartParkPriorityToken,
} from "@/lib/smart-plan-holiday-wizard";
import {
  resolveParkPriorityIds,
} from "@/lib/smart-plan-holiday-wizard";
import type {
  Park,
  SmartPlanHolidayStyle,
  SmartPlanPaceStyle,
  SmartPlanRestRhythm,
  SmartPlanScopeChoice,
  SmartPlanWizardParty,
  Trip,
} from "@/lib/types";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export const WIZARD_STEPS_TRIP = [
  "scope",
  "holidayStyle",
  "groupPace",
  "ridesAvoid",
  "mealsPaid",
  "rest",
  "parks",
  "preview",
] as const;

export type HolidayWizardStepId = (typeof WIZARD_STEPS_TRIP)[number];

export const WIZARD_STEPS_DAY: readonly Exclude<HolidayWizardStepId, "scope">[] =
  WIZARD_STEPS_TRIP.filter(
    (x): x is Exclude<HolidayWizardStepId, "scope"> => x !== "scope",
  );

function stepOrder(isDayScope: boolean): readonly HolidayWizardStepId[] {
  return isDayScope ? WIZARD_STEPS_DAY : WIZARD_STEPS_TRIP;
}

export function holidayWizardStepCount(isDayScope: boolean): number {
  return stepOrder(isDayScope).length;
}

export function holidayWizardStepIdAt(
  isDayScope: boolean,
  stepIndex: number,
): HolidayWizardStepId | null {
  const order = stepOrder(isDayScope);
  return order[stepIndex] ?? null;
}

const SCOPE_OPTIONS: {
  id: SmartPlanScopeChoice;
  title: string;
  body: string;
}[] = [
  {
    id: "plan_this_day_only",
    title: "Fill this day only",
    body: "Focus on the day you opened Smart Plan from — leave the rest of the trip as-is unless slots are empty.",
  },
  {
    id: "fill_empty_days_only",
    title: "Fill empty days only",
    body: "Keep every tile you’ve placed. Smart Plan only fills blank AM, PM, and meal slots.",
  },
  {
    id: "improve_whole_trip",
    title: "Improve the whole trip",
    body: "Allow Smart Plan to replace slots where it suggests a new idea — your flights and cruise anchors stay locked.",
  },
  {
    id: "suggest_changes_first",
    title: "Suggest changes first",
    body: "Stand on the side of caution: fill gaps and refine copy, but don’t rip out what you’ve already scheduled.",
  },
];

function scopeChoicesForUi(isDayScope: boolean) {
  return isDayScope
    ? SCOPE_OPTIONS
    : SCOPE_OPTIONS.filter((o) => o.id !== "plan_this_day_only");
}

const HOLIDAY_STYLE_OPTIONS: { id: SmartPlanHolidayStyle; title: string; body: string }[] = [
  {
    id: "first_time_theme_park_trip",
    title: "First-time theme park trip",
    body: "Iconic hits without feeling overwhelming.",
  },
  {
    id: "big_rides_and_headlines",
    title: "Big rides & headline attractions",
    body: "Thrill-focused days with efficiency in mind.",
  },
  {
    id: "balanced_family_holiday",
    title: "Balanced family holiday",
    body: "A little of everything — pace, favourites, downtime.",
  },
  {
    id: "food_shows_and_atmosphere",
    title: "Food, shows & atmosphere",
    body: "Dining, entertainment, and lands over raw ride count.",
  },
  {
    id: "relaxed_with_some_parks",
    title: "Relaxed holiday with some parks",
    body: "Pool, shopping, and shorter park bursts.",
  },
  {
    id: "special_occasion",
    title: "Special occasion",
    body: "Celebrate — allow a little extra sparkle in the schedule.",
  },
  { id: "unknown", title: "Not sure yet", body: "TripTiles will stay flexible." },
];

const PARTY_OPTIONS: { id: SmartPlanWizardParty; title: string }[] = [
  { id: "adults_only", title: "Adults only" },
  { id: "family_with_small_children", title: "Family with small children" },
  { id: "family_with_teens", title: "Family with teens" },
  { id: "mixed_family", title: "Mixed family / generations" },
  { id: "accessibility_sensitive", title: "Accessibility-sensitive group" },
  { id: "unknown", title: "Prefer not to say" },
];

const PACE_OPTIONS: { id: SmartPlanPaceStyle; title: string; body: string }[] = [
  { id: "relaxed", title: "Relaxed", body: "Breathing room between blocks." },
  { id: "balanced", title: "Balanced", body: "Busy but humane." },
  { id: "packed", title: "Packed", body: "Maximise park time." },
  { id: "half_day", title: "Half-day focused", body: "Shorter park windows, more recovery." },
  { id: "unknown", title: "Not sure", body: "Default to balanced pacing." },
];

const RIDE_COMFORT_OPTIONS: {
  id: HolidaySmartWizardState["rideComfort"];
  title: string;
}[] = [
  { id: "big_thrills", title: "Big thrills" },
  { id: "some_thrills", title: "Some thrills" },
  { id: "gentle", title: "Mostly gentle" },
  { id: "shows_lands_food", title: "Shows, lands & food" },
  { id: "unknown", title: "Not sure" },
];

const AVOID_OPTIONS: { id: HolidaySmartWizardState["avoidances"][number]; label: string }[] =
  [
    { id: "big_drops", label: "Big drops" },
    { id: "spinning", label: "Spinning" },
    { id: "water_rides", label: "Water rides" },
    { id: "scary_rides", label: "Scary / dark rides" },
    { id: "simulators", label: "Screen / simulators" },
    { id: "long_walking_days", label: "Long walking days" },
    { id: "early_starts", label: "Early starts" },
    { id: "late_nights", label: "Late nights" },
  ];

const MEAL_OPTIONS: { id: HolidaySmartWizardState["mealChoice"]; title: string; body: string }[] =
  [
    {
      id: "do_not_assume",
      title: "Do not plan meals unless I add them",
      body: "Structure park time only.",
    },
    {
      id: "quick_service",
      title: "Suggest quick-service breaks",
      body: "Light dining windows, no ADR assumptions.",
    },
    {
      id: "table_service",
      title: "Suggest table-service meals",
      body: "Plan for sit-down meals where it fits.",
    },
    {
      id: "mixed",
      title: "Mix of both",
      body: "Quick service + occasional table service.",
    },
    { id: "snacks", title: "Snacks only", body: "Grazing style." },
    {
      id: "existing_only",
      title: "Use existing reservations only",
      body: "Never invent bookings — honour what is on the calendar.",
    },
    { id: "unknown", title: "Not sure", body: "Stay flexible." },
  ];

const PAID_OPTIONS: {
  id: NonNullable<HolidaySmartWizardState["paidAccessDefault"]>;
  title: string;
  body: string;
}[] = [
  {
    id: "yes",
    title: "Yes — we have paid queue access",
    body: "Lightning Lane / Express-style products may be referenced.",
  },
  {
    id: "no",
    title: "No",
    body: "Standby-first planning only.",
  },
  {
    id: "not_sure",
    title: "Not sure",
    body: "Assume standby; mention paid access only as optional advice.",
  },
  {
    id: "decide_later",
    title: "Decide later",
    body: "Same as “not sure” — no reliance on paid products.",
  },
];

const REST_OPTIONS: { id: SmartPlanRestRhythm; title: string }[] = [
  { id: "rest_every_2_days", title: "Rest every 2 days" },
  { id: "rest_every_3_to_4_days", title: "Rest every 3–4 days" },
  { id: "weekends_lighter", title: "Keep weekends lighter" },
  { id: "first_and_last_day_light", title: "Light first & last day" },
  { id: "no_preference", title: "No preference" },
];

const PARK_TOKEN_LABEL: Record<SmartParkPriorityToken, string> = {
  mk: "Magic Kingdom",
  ep: "EPCOT",
  hs: "Hollywood Studios",
  ak: "Animal Kingdom",
  uf: "Universal Studios Florida",
  ia: "Islands of Adventure",
  eu: "Epic Universe",
  water_parks: "Water parks",
  shopping_downtime: "Shopping / downtime",
};

function toggleAvoidance(
  prev: HolidaySmartWizardState,
  key: HolidaySmartWizardState["avoidances"][number],
): HolidaySmartWizardState {
  const has = prev.avoidances.includes(key);
  return {
    ...prev,
    avoidances: has
      ? prev.avoidances.filter((x) => x !== key)
      : [...prev.avoidances, key],
  };
}

function toggleParkToken(
  prev: HolidaySmartWizardState,
  token: SmartParkPriorityToken,
): HolidaySmartWizardState {
  if (token === "shopping_downtime" || token === "water_parks") {
    const has = prev.parkPriorities.includes(token);
    return {
      ...prev,
      parkPriorities: has
        ? prev.parkPriorities.filter((t) => t !== token)
        : [...prev.parkPriorities, token],
    };
  }
  const has = prev.parkPriorities.includes(token);
  return {
    ...prev,
    parkPriorities: has
      ? prev.parkPriorities.filter((t) => t !== token)
      : [...prev.parkPriorities, token],
  };
}

type TileButtonProps = {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

function TileButton({
  selected,
  onClick,
  disabled,
  children,
  className = "",
}: TileButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] rounded-xl border p-3 text-left text-sm transition ${
        selected
          ? "border-royal bg-white ring-2 ring-royal/20"
          : "border-royal/15 bg-white hover:border-royal/30"
      } ${className}`}
    >
      {children}
    </button>
  );
}

type Props = {
  trip: Trip;
  parks: Park[];
  wizard: HolidaySmartWizardState;
  setWizard: Dispatch<SetStateAction<HolidaySmartWizardState>>;
  stepIndex: number;
  isDayScope: boolean;
  preview: HolidaySmartPreview;
  isSubmitting: boolean;
};

export function SmartPlanHolidayWizardSteps({
  trip,
  parks,
  wizard,
  setWizard,
  stepIndex,
  isDayScope,
  preview,
  isSubmitting,
}: Props) {
  const order = stepOrder(isDayScope);
  const stepId = order[stepIndex];
  const stepHuman = stepIndex + 1;
  const total = order.length;

  if (!stepId) return null;

  const parkNamesForPreview = resolveParkPriorityIds(wizard.parkPriorities, parks)
    .map((id) => parks.find((p) => p.id === id)?.name ?? id)
    .filter(Boolean);

  const scopeLabel =
    wizard.scope === "plan_this_day_only"
      ? "This day only"
      : wizard.scope === "fill_empty_days_only"
        ? "Empty days only"
        : wizard.scope === "improve_whole_trip"
          ? "Whole trip refresh"
          : wizard.scope === "suggest_changes_first"
            ? "Suggest first"
            : "—";

  const tilesLine =
    wizard.scope === "improve_whole_trip"
      ? "May replace slots where Smart Plan outputs a suggestion (anchors like flights stay put)."
      : "Existing tiles stay unless a slot is empty — Smart Plan fills gaps and aligns structure.";

  const paidLine =
    wizard.paidAccessDefault === "yes"
      ? "Paid queue products may be referenced."
      : "Standby-first — paid access is optional advice only.";

  const header = (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/55">
        Step {stepHuman} of {total}
      </p>
      <p className="text-right font-sans text-xs text-royal/50">
        Holiday planning brain — not ride-by-ride sequencing
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}

      {stepId === "scope" ? (
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-royal">
            What should Smart Plan do?
          </h3>
          <p className="font-sans text-xs leading-relaxed text-royal/65">
            This sets how aggressive the next run is. You&apos;ll see a recap on
            the last step before anything changes.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {scopeChoicesForUi(isDayScope).map((opt) => (
              <TileButton
                key={opt.id}
                selected={wizard.scope === opt.id}
                disabled={isSubmitting}
                onClick={() =>
                  setWizard((w) => ({ ...w, scope: opt.id }))
                }
              >
                <div className="font-semibold text-royal">{opt.title}</div>
                <div className="mt-1 text-xs text-royal/70">{opt.body}</div>
              </TileButton>
            ))}
          </div>
        </section>
      ) : null}

      {stepId === "holidayStyle" ? (
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-royal">
            What kind of trip is this?
          </h3>
          <div className="grid max-h-[min(48vh,20rem)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {HOLIDAY_STYLE_OPTIONS.map((opt) => (
              <TileButton
                key={opt.id}
                selected={wizard.holidayStyle === opt.id}
                disabled={isSubmitting}
                onClick={() =>
                  setWizard((w) => ({ ...w, holidayStyle: opt.id }))
                }
              >
                <div className="font-semibold text-royal">{opt.title}</div>
                <div className="mt-1 text-xs text-royal/70">{opt.body}</div>
              </TileButton>
            ))}
          </div>
        </section>
      ) : null}

      {stepId === "groupPace" ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-sans text-sm font-semibold text-royal">
              Who is travelling?
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {PARTY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setWizard((w) => ({ ...w, wizardParty: opt.id }))
                  }
                  className={`min-h-10 rounded-full border px-3 py-2 font-sans text-xs ${
                    wizard.wizardParty === opt.id
                      ? "border-royal bg-royal text-cream"
                      : "border-royal/25 bg-white"
                  }`}
                >
                  {opt.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-royal">
              What pace suits you?
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PACE_OPTIONS.map((opt) => (
                <TileButton
                  key={opt.id}
                  selected={wizard.paceStyle === opt.id}
                  disabled={isSubmitting}
                  onClick={() => setWizard((w) => ({ ...w, paceStyle: opt.id }))}
                >
                  <div className="font-semibold text-royal">{opt.title}</div>
                  <div className="mt-1 text-xs text-royal/70">{opt.body}</div>
                </TileButton>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {stepId === "ridesAvoid" ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-sans text-sm font-semibold text-royal">
              What ride level suits your group?
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {RIDE_COMFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setWizard((w) => ({ ...w, rideComfort: opt.id }))
                  }
                  className={`min-h-10 rounded-full border px-3 py-2 font-sans text-xs ${
                    wizard.rideComfort === opt.id
                      ? "border-royal bg-royal text-cream"
                      : "border-royal/25 bg-white"
                  }`}
                >
                  {opt.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-royal">
              Avoid (optional)
            </h3>
            <p className="mt-1 font-sans text-xs text-royal/60">
              TripTiles will steer day structure around these where possible.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVOID_OPTIONS.map((opt) => {
                const on = wizard.avoidances.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setWizard((w) => toggleAvoidance(w, opt.id))}
                    className={`min-h-10 rounded-full border px-3 py-2 font-sans text-xs ${
                      on ? "border-royal bg-royal text-cream" : "border-royal/25 bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {stepId === "mealsPaid" ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-sans text-sm font-semibold text-royal">
              How should TripTiles handle meals?
            </h3>
            <div className="mt-2 grid max-h-[min(40vh,16rem)] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {MEAL_OPTIONS.map((opt) => (
                <TileButton
                  key={opt.id}
                  selected={wizard.mealChoice === opt.id}
                  disabled={isSubmitting}
                  onClick={() =>
                    setWizard((w) => ({ ...w, mealChoice: opt.id }))
                  }
                >
                  <div className="font-semibold text-royal">{opt.title}</div>
                  <div className="mt-1 text-xs text-royal/70">{opt.body}</div>
                </TileButton>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-royal">
              Should Smart Plan rely on paid queue access?
            </h3>
            <p className="mt-1 font-sans text-xs leading-relaxed text-royal/60">
              If you choose{" "}
              <strong className="font-semibold text-royal/80">Not sure</strong>{" "}
              or{" "}
              <strong className="font-semibold text-royal/80">Decide later</strong>
              , Smart Plan uses standby assumptions and only mentions paid access
              as optional advice.
            </p>
            <div className="mt-2 grid gap-2">
              {PAID_OPTIONS.map((opt) => (
                <TileButton
                  key={opt.id}
                  selected={wizard.paidAccessDefault === opt.id}
                  disabled={isSubmitting}
                  onClick={() =>
                    setWizard((w) => ({ ...w, paidAccessDefault: opt.id }))
                  }
                >
                  <div className="font-semibold text-royal">{opt.title}</div>
                  <div className="mt-1 text-xs text-royal/70">{opt.body}</div>
                </TileButton>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {stepId === "rest" ? (
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-royal">
            How should the holiday be balanced?
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {REST_OPTIONS.map((opt) => (
              <TileButton
                key={opt.id}
                selected={wizard.restRhythm === opt.id}
                disabled={isSubmitting}
                onClick={() =>
                  setWizard((w) => ({ ...w, restRhythm: opt.id }))
                }
              >
                <div className="font-semibold text-royal">{opt.title}</div>
              </TileButton>
            ))}
          </div>
        </section>
      ) : null}

      {stepId === "parks" ? (
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-semibold text-royal">
            Must-do parks or focus areas?
          </h3>
          <p className="font-sans text-xs text-royal/60">
            Pick what matters — TripTiles maps this to parks in{" "}
            {trip.region_id ? "your region" : "your trip"} when it can.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setWizard((w) => ({ ...w, parkPriorities: [] }))}
              className={`min-h-10 rounded-full border px-3 py-2 font-sans text-xs ${
                wizard.parkPriorities.length === 0
                  ? "border-royal bg-royal text-cream"
                  : "border-royal/25 bg-white"
              }`}
            >
              No preference — surprise me
            </button>
            {(Object.keys(PARK_TOKEN_LABEL) as SmartParkPriorityToken[]).map(
              (token) => {
                const on = wizard.parkPriorities.includes(token);
                return (
                  <button
                    key={token}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setWizard((w) => toggleParkToken(w, token))}
                    className={`min-h-10 rounded-full border px-3 py-2 font-sans text-xs ${
                      on ? "border-royal bg-royal text-cream" : "border-royal/25 bg-white"
                    }`}
                  >
                    {PARK_TOKEN_LABEL[token]}
                  </button>
                );
              },
            )}
          </div>
        </section>
      ) : null}

      {stepId === "preview" ? (
        <section className="space-y-3 rounded-xl border border-gold/35 bg-white/90 p-4">
          <h3 className="font-serif text-base font-semibold text-royal">
            Preview before applying
          </h3>
          <ul className="space-y-2 font-sans text-sm leading-relaxed text-royal/85">
            <li>
              <span className="font-semibold text-royal">Scope:</span>{" "}
              {scopeLabel}
            </li>
            <li>
              <span className="font-semibold text-royal">Calendar tiles:</span>{" "}
              {tilesLine}
            </li>
            <li>
              <span className="font-semibold text-royal">Trip shape:</span>{" "}
              {preview.calendarDays} calendar day
              {preview.calendarDays === 1 ? "" : "s"},{" "}
              {preview.fullyEmptyDays} fully empty, {preview.daysWithFilledSlots}{" "}
              with something already placed.
            </li>
            <li>
              <span className="font-semibold text-royal">Meals:</span>{" "}
              {wizard.mealChoice.replace(/_/g, " ")}
            </li>
            <li>
              <span className="font-semibold text-royal">Paid access:</span>{" "}
              {paidLine}
            </li>
            <li>
              <span className="font-semibold text-royal">Pace:</span>{" "}
              {wizard.paceStyle.replace(/_/g, " ")}
            </li>
            <li>
              <span className="font-semibold text-royal">Rest rhythm:</span>{" "}
              {wizard.restRhythm.replace(/_/g, " ")}
            </li>
            <li>
              <span className="font-semibold text-royal">Park focus:</span>{" "}
              {wizard.parkPriorities.length === 0
                ? "No preference"
                : wizard.parkPriorities
                    .map((t) => PARK_TOKEN_LABEL[t])
                    .concat(
                      parkNamesForPreview.length
                        ? [`Resolved: ${parkNamesForPreview.join(", ")}`]
                        : [],
                    )
                    .join(" · ")}
            </li>
          </ul>
          <label className="block">
            <span className="font-sans text-xs font-medium text-royal">
              Anything else? (optional)
            </span>
            <textarea
              className="mt-1 min-h-[72px] w-full resize-y rounded-lg border border-royal/25 px-3 py-2 font-sans text-sm text-royal placeholder:text-royal/35"
              maxLength={2000}
              value={wizard.freeText}
              onChange={(e) =>
                setWizard((w) => ({
                  ...w,
                  freeText: e.target.value.slice(0, 2000),
                }))
              }
              placeholder="Dietary needs, celebrations, must-see shows…"
              disabled={isSubmitting}
            />
          </label>
        </section>
      ) : null}
    </div>
  );
}
