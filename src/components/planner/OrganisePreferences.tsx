"use client";

import { updateTripPlanningPreferencesAction } from "@/actions/trips";
import { Button } from "@/components/ui/Button";
import { PRIORITY_OPTIONS } from "@/lib/planning-preference-options";
import {
  isPlanningPace,
  PLANNING_PACES,
  planningPaceLabel,
} from "@/lib/planning-preferences-load";
import { showToast } from "@/lib/toast";
import type { Park, Trip, TripPlanningPreferences } from "@/lib/types";
import { useEffect, useState } from "react";

type Props = {
  trip: Trip;
  parks: Park[];
  onTripPatch: (patch: Partial<Trip>) => void;
};

const FIELD =
  "min-h-11 w-full max-w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-sm text-tt-ink";

function priorityLabel(id: string): string {
  return PRIORITY_OPTIONS.find((option) => option.id === id)?.label ?? id.replaceAll("_", " ");
}

export function OrganisePreferences({ trip, parks, onTripPatch }: Props) {
  const saved = trip.planning_preferences;
  const issue = trip.planning_preferences_issue ?? null;
  const fields = saved ?? issue?.fields ?? null;
  const [pace, setPace] = useState(saved?.pace ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPace(saved?.pace ?? "");
  }, [saved?.pace, trip.id]);

  const parkName = new Map(parks.map((park) => [park.id, park.name]));
  const musts = fields?.mustDoParks ?? [];
  const priorities = fields?.priorities ?? [];
  const canSave = isPlanningPace(pace) && pace !== saved?.pace;

  const save = async () => {
    if (!isPlanningPace(pace)) return;
    const base: Omit<TripPlanningPreferences, "pace"> = fields ?? {
      mustDoParks: [],
      priorities: [],
      additionalNotes: null,
      adults: Math.max(1, trip.adults || 1),
      children: trip.children,
      childAges: trip.child_ages,
    };
    const next: TripPlanningPreferences = { ...base, pace };
    setBusy(true);
    const result = await updateTripPlanningPreferencesAction({
      tripId: trip.id,
      planningPreferences: next,
    });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, { type: "error" });
      return;
    }
    onTripPatch({
      planning_preferences: next,
      planning_preferences_issue: null,
    });
    showToast("Planning pace saved", { type: "success" });
  };

  return (
    <div className="space-y-4">
      {issue?.unsupportedPace ? (
        <div>
          <p className="font-sans text-sm font-semibold text-tt-ink">Choose a planning pace</p>
          <p className="mt-1 font-sans text-sm text-tt-ink-muted">
            {`“${issue.unsupportedPace}” is saved, and it isn’t a pace TripTiles can use. Pick a supported pace to replace it.`}
          </p>
        </div>
      ) : saved ? null : (
        <div>
          <p className="font-sans text-sm font-semibold text-tt-ink">Choose a planning pace</p>
          <p className="mt-1 font-sans text-sm text-tt-ink-muted">
            Pace is what TripTiles needs before this counts as ready.
          </p>
        </div>
      )}

      <label className="flex max-w-sm flex-col gap-1 font-sans text-sm">
        <span className="font-medium text-tt-ink-muted">Pace</span>
        <select
          value={isPlanningPace(pace) ? pace : ""}
          onChange={(event) => setPace(event.target.value)}
          className={FIELD}
        >
          <option value="">Choose a pace</option>
          {PLANNING_PACES.map((id) => (
            <option key={id} value={id}>
              {planningPaceLabel(id)}
            </option>
          ))}
        </select>
      </label>

      {fields ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-sans text-xs font-medium text-tt-ink-muted">Must-do parks</dt>
            <dd className="mt-1 font-sans text-sm text-tt-ink">
              {musts.length
                ? musts.map((id) => parkName.get(id) ?? id).join(", ")
                : "None saved"}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-xs font-medium text-tt-ink-muted">Priorities</dt>
            <dd className="mt-1 font-sans text-sm text-tt-ink">
              {priorities.length ? priorities.map(priorityLabel).join(", ") : "None saved"}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-xs font-medium text-tt-ink-muted">Party on the profile</dt>
            <dd className="mt-1 font-sans text-sm text-tt-ink">
              {`${fields.adults} adult${fields.adults === 1 ? "" : "s"}`}
              {fields.children > 0
                ? `, ${fields.children} child${fields.children === 1 ? "" : "ren"}`
                : ""}
            </dd>
          </div>
          {fields.additionalNotes ? (
            <div className="sm:col-span-2">
              <dt className="font-sans text-xs font-medium text-tt-ink-muted">Notes</dt>
              <dd className="mt-1 font-sans text-sm text-tt-ink">{fields.additionalNotes}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {canSave ? (
        <Button type="button" variant="accent" disabled={busy} onClick={() => void save()}>
          Save pace
        </Button>
      ) : null}
    </div>
  );
}
