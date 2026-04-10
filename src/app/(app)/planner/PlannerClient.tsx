"use client";

import {
  createTripFromWizard,
  deleteTrip,
  type TripUpdateInput,
  updateTrip,
  updateTripFromWizard,
} from "@/actions/trips";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Calendar } from "@/components/planner/Calendar";
import { Countdown } from "@/components/planner/Countdown";
import { EditableTitle } from "@/components/planner/EditableTitle";
import { Palette } from "@/components/planner/Palette";
import { SmartPlanModal } from "@/components/planner/SmartPlanModal";
import { TripSelector } from "@/components/planner/TripSelector";
import { Wizard } from "@/components/planner/Wizard";
import type { Assignments, Park, SlotType, Trip } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";
import "./planner.css";

type Props = {
  initialTrips: Trip[];
  parks: Park[];
  userEmail: string;
};

const ASSIGN_SAVE_MS = 450;

export function PlannerClient({
  initialTrips,
  parks,
  userEmail,
}: Props) {
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [activeTripId, setActiveTripId] = useState(
    () => initialTrips[0]?.id ?? "",
  );
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(() => initialTrips.length === 0);
  const [wizardFirstRun, setWizardFirstRun] = useState(
    () => initialTrips.length === 0,
  );
  const [wizardEditId, setWizardEditId] = useState<string | null>(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const hintRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  const showHint = useCallback((msg: string) => {
    setHint(msg);
    if (hintRef.current) clearTimeout(hintRef.current);
    hintRef.current = setTimeout(() => setHint(null), 2200);
  }, []);

  const clearAssignTimer = useCallback(() => {
    if (assignSaveTimerRef.current) {
      clearTimeout(assignSaveTimerRef.current);
      assignSaveTimerRef.current = null;
    }
  }, []);

  const persistPatch = useCallback(async (tripId: string, patch: TripUpdateInput) => {
    setSaveError(null);
    const res = await updateTrip(tripId, patch);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setTrips((prev) => prev.map((t) => (t.id === res.trip.id ? res.trip : t)));
  }, []);

  const scheduleAssignmentsSave = useCallback(
    (tripId: string, assignments: Assignments) => {
      clearAssignTimer();
      assignSaveTimerRef.current = setTimeout(() => {
        assignSaveTimerRef.current = null;
        void persistPatch(tripId, { assignments });
      }, ASSIGN_SAVE_MS);
    },
    [clearAssignTimer, persistPatch],
  );

  useEffect(() => {
    return () => {
      clearAssignTimer();
    };
  }, [clearAssignTimer]);

  const applyLocalPatch = useCallback(
    (tripId: string, patch: Partial<Trip>) => {
      const ts = new Date().toISOString();
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId ? { ...t, ...patch, updated_at: ts } : t,
        ),
      );
    },
    [],
  );

  const updateActiveTrip = useCallback(
    (patch: Partial<Trip>, opts?: { skipServer?: boolean }) => {
      if (!activeTripId) return;
      applyLocalPatch(activeTripId, patch);
      if (opts?.skipServer) return;

      const serverPatch: TripUpdateInput = {};
      if ("family_name" in patch && patch.family_name !== undefined) {
        serverPatch.family_name = patch.family_name;
      }
      if ("adventure_name" in patch && patch.adventure_name !== undefined) {
        serverPatch.adventure_name = patch.adventure_name;
      }
      if ("has_cruise" in patch) serverPatch.has_cruise = patch.has_cruise;
      if ("cruise_embark" in patch) serverPatch.cruise_embark = patch.cruise_embark ?? null;
      if ("cruise_disembark" in patch) {
        serverPatch.cruise_disembark = patch.cruise_disembark ?? null;
      }
      if ("assignments" in patch) {
        serverPatch.assignments = patch.assignments ?? {};
      }

      const hasKeys = Object.keys(serverPatch).length > 0;
      if (hasKeys) void persistPatch(activeTripId, serverPatch);
    },
    [activeTripId, applyLocalPatch, persistPatch],
  );

  const onAssign = useCallback(
    (dateKey: string, slot: SlotType, parkId: string) => {
      if (!activeTripId) return;
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const nextAss: Assignments = { ...t.assignments };
          const day = { ...(nextAss[dateKey] ?? {}) };
          day[slot] = parkId;
          nextAss[dateKey] = day;
          const next = {
            ...t,
            assignments: nextAss,
            updated_at: new Date().toISOString(),
          };
          scheduleAssignmentsSave(t.id, nextAss);
          return next;
        }),
      );
    },
    [activeTripId, scheduleAssignmentsSave],
  );

  const onClear = useCallback(
    (dateKey: string, slot: SlotType) => {
      if (!activeTripId) return;
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const nextAss: Assignments = { ...t.assignments };
          const day = { ...(nextAss[dateKey] ?? {}) };
          delete day[slot];
          if (Object.keys(day).length === 0) delete nextAss[dateKey];
          else nextAss[dateKey] = day;
          const next = {
            ...t,
            assignments: nextAss,
            updated_at: new Date().toISOString(),
          };
          scheduleAssignmentsSave(t.id, nextAss);
          return next;
        }),
      );
    },
    [activeTripId, scheduleAssignmentsSave],
  );

  const wizardInitial = (): Partial<Trip> => {
    if (wizardEditId) {
      const t = trips.find((x) => x.id === wizardEditId);
      return t ?? {};
    }
    return {};
  };

  return (
    <div className="min-h-screen bg-cream pb-16 pt-4">
      <header className="sticky top-0 z-30 border-b border-royal/10 bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-serif text-lg font-semibold text-gold">
              TripTiles
            </span>
            <span className="font-sans text-sm text-royal/70">{userEmail}</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      {activeTrip ? (
        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-semibold text-royal sm:text-3xl">
              <EditableTitle
                key={`${activeTrip.id}-fam`}
                value={activeTrip.family_name}
                onSave={(v) => {
                  const trimmed = v.trim();
                  applyLocalPatch(activeTrip.id, { family_name: trimmed });
                  void persistPatch(activeTrip.id, { family_name: trimmed });
                }}
                className="inline-block min-w-[4ch]"
              />
              <span className="text-royal/50"> — </span>
              <EditableTitle
                key={`${activeTrip.id}-adv`}
                value={activeTrip.adventure_name}
                onSave={(v) => {
                  const trimmed = v.trim();
                  applyLocalPatch(activeTrip.id, { adventure_name: trimmed });
                  void persistPatch(activeTrip.id, { adventure_name: trimmed });
                }}
                className="inline-block min-w-[6ch]"
              />
            </h1>
            <div className="mt-3">
              <Countdown
                startDate={activeTrip.start_date}
                endDate={activeTrip.end_date}
              />
            </div>
          </div>

          <div className="mt-8">
            <TripSelector
              trips={trips}
              activeTripId={activeTripId}
              onSwitch={setActiveTripId}
              onNew={() => {
                setWizardEditId(null);
                setWizardFirstRun(false);
                setWizardOpen(true);
              }}
              onRename={() => {
                setWizardEditId(activeTripId);
                setWizardFirstRun(false);
                setWizardOpen(true);
              }}
              onDelete={() => {
                if (trips.length <= 1) return;
                if (
                  !confirm(
                    "Delete this trip? This cannot be undone.",
                  )
                )
                  return;
                clearAssignTimer();
                const idToDelete = activeTripId;
                void (async () => {
                  const res = await deleteTrip(idToDelete);
                  if (!res.ok) {
                    setSaveError(res.error);
                    return;
                  }
                  let nextTrips: Trip[] = [];
                  setTrips((prev) => {
                    nextTrips = prev.filter((t) => t.id !== idToDelete);
                    return nextTrips;
                  });
                  setActiveTripId((aid) => {
                    if (aid !== idToDelete) return aid;
                    return nextTrips[0]?.id ?? "";
                  });
                })();
              }}
            />
          </div>

          {saveError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center font-sans text-sm text-red-900"
            >
              Couldn’t save: {saveError}
            </div>
          ) : null}

          {hint ? (
            <p className="mt-2 text-center font-sans text-sm font-medium text-royal">
              {hint}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWizardEditId(activeTripId);
                setWizardFirstRun(false);
                setWizardOpen(true);
              }}
              className="rounded-lg bg-royal px-4 py-2 font-sans text-sm font-medium text-cream"
            >
              Edit Trip
            </button>
            <button
              type="button"
              onClick={() => setSmartOpen(true)}
              className="rounded-lg border border-gold bg-white px-4 py-2 font-sans text-sm font-medium text-royal"
            >
              Smart Plan ✨
            </button>
            <button
              type="button"
              onClick={() =>
                updateActiveTrip({
                  has_cruise: false,
                  cruise_embark: null,
                  cruise_disembark: null,
                })
              }
              className="rounded-lg border border-royal/20 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Reset Cruise
            </button>
            <button
              type="button"
              onClick={() => updateActiveTrip({ assignments: {} })}
              className="rounded-lg border border-royal/20 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-royal/20 bg-white px-4 py-2 font-sans text-sm text-royal print:hidden"
            >
              Print Calendar
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,17rem)_1fr]">
            <Palette
              parks={parks}
              destination={activeTrip.destination}
              selectedParkId={selectedParkId}
              onSelectPark={setSelectedParkId}
            />
            <Calendar
              trip={activeTrip}
              parks={parks}
              selectedParkId={selectedParkId}
              onAssign={onAssign}
              onClear={onClear}
              onNeedParkFirst={() => showHint("Pick a park first")}
            />
          </div>
        </main>
      ) : (
        <div className="px-4 py-16 text-center">
          <p className="font-sans text-royal">
            Create your first trip to see your calendar.
          </p>
          {!wizardOpen ? (
            <button
              type="button"
              onClick={() => {
                setWizardFirstRun(true);
                setWizardOpen(true);
              }}
              className="mt-6 rounded-lg bg-royal px-6 py-3 font-serif text-sm font-semibold text-cream"
            >
              Open trip wizard
            </button>
          ) : null}
        </div>
      )}

      <Wizard
        isOpen={wizardOpen}
        isFirstRun={wizardFirstRun}
        initialData={wizardInitial()}
        onClose={() => {
          setWizardOpen(false);
          setWizardEditId(null);
        }}
        onComplete={async (data) => {
          if (wizardEditId) {
            const res = await updateTripFromWizard(wizardEditId, data);
            if (!res.ok) throw new Error(res.error);
            setTrips((prev) =>
              prev.map((t) => (t.id === res.trip.id ? res.trip : t)),
            );
          } else {
            const res = await createTripFromWizard(data);
            if (!res.ok) throw new Error(res.error);
            setTrips((prev) => [res.trip, ...prev]);
            setActiveTripId(res.trip.id);
          }
        }}
      />

      <SmartPlanModal isOpen={smartOpen} onClose={() => setSmartOpen(false)} />
    </div>
  );
}
