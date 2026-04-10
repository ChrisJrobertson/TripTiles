"use client";

import {
  createTripAction,
  deleteTripAction,
  touchTripAction,
  updateAssignmentsAction,
  updateTripFromWizardAction,
  updateTripMetadataAction,
} from "@/actions/trips";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Calendar } from "@/components/planner/Calendar";
import { Countdown } from "@/components/planner/Countdown";
import { EditableTitle } from "@/components/planner/EditableTitle";
import { Palette } from "@/components/planner/Palette";
import { SavingIndicator } from "@/components/planner/SavingIndicator";
import { SmartPlanModal } from "@/components/planner/SmartPlanModal";
import { TripSelector } from "@/components/planner/TripSelector";
import { Wizard } from "@/components/planner/Wizard";
import { TierLimitModal } from "@/components/paywall/TierLimitModal";
import { useToast } from "@/lib/toast";
import type { Assignments, Park, SlotType, Trip } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import "./planner.css";

type Props = {
  initialTrips: Trip[];
  parks: Park[];
  initialActiveTripId: string | null;
  userEmail: string;
};

const ASSIGN_DEBOUNCE_MS = 450;
const SAVE_FLASH_MS = 500;

export function PlannerClient({
  initialTrips,
  parks,
  initialActiveTripId,
  userEmail,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { message: toastMessage, show: showToast } = useToast();

  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [activeTripId, setActiveTripId] = useState(() => {
    if (
      initialActiveTripId &&
      initialTrips.some((t) => t.id === initialActiveTripId)
    ) {
      return initialActiveTripId;
    }
    return initialTrips[0]?.id ?? "";
  });
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tierLimitOpen, setTierLimitOpen] = useState(false);

  const [wizardOpen, setWizardOpen] = useState(() => initialTrips.length === 0);
  const [wizardFirstRun, setWizardFirstRun] = useState(
    () => initialTrips.length === 0,
  );
  const [wizardEditId, setWizardEditId] = useState<string | null>(null);
  const [smartOpen, setSmartOpen] = useState(false);

  const hintRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  const beginSaving = useCallback(() => {
    if (saveHideTimerRef.current) {
      clearTimeout(saveHideTimerRef.current);
      saveHideTimerRef.current = null;
    }
    setIsSaving(true);
  }, []);

  const endSaving = useCallback(() => {
    saveHideTimerRef.current = setTimeout(() => {
      setIsSaving(false);
      saveHideTimerRef.current = null;
    }, SAVE_FLASH_MS);
  }, []);

  const withSaving = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      beginSaving();
      try {
        return await fn();
      } finally {
        endSaving();
      }
    },
    [beginSaving, endSaving],
  );

  useEffect(() => {
    setTrips(initialTrips);
    const valid =
      initialActiveTripId &&
      initialTrips.some((t) => t.id === initialActiveTripId)
        ? initialActiveTripId
        : initialTrips[0]?.id ?? "";
    setActiveTripId(valid);
    if (initialTrips.length === 0) {
      setWizardFirstRun(true);
      setWizardOpen(true);
    } else {
      setWizardOpen(false);
      setWizardEditId(null);
    }
  }, [initialTrips, initialActiveTripId]);

  const showHint = useCallback((msg: string) => {
    setHint(msg);
    if (hintRef.current) clearTimeout(hintRef.current);
    hintRef.current = setTimeout(() => setHint(null), 2200);
  }, []);

  const clearAssignTimer = useCallback(() => {
    if (assignTimerRef.current) {
      clearTimeout(assignTimerRef.current);
      assignTimerRef.current = null;
    }
  }, []);

  const scheduleAssignmentsSave = useCallback(
    (tripId: string, assignments: Assignments) => {
      clearAssignTimer();
      assignTimerRef.current = setTimeout(() => {
        assignTimerRef.current = null;
        void (async () => {
          await withSaving(async () => {
            const res = await updateAssignmentsAction({
              tripId,
              assignments,
            });
            if (!res.ok) {
              showToast("Couldn't save — please try again");
              startTransition(() => router.refresh());
              return;
            }
            startTransition(() => router.refresh());
          });
        })();
      }, ASSIGN_DEBOUNCE_MS);
    },
    [clearAssignTimer, router, showToast, withSaving],
  );

  useEffect(() => {
    return () => clearAssignTimer();
  }, [clearAssignTimer]);

  const applyLocalPatch = useCallback((tripId: string, patch: Partial<Trip>) => {
    const ts = new Date().toISOString();
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, ...patch, updated_at: ts } : t,
      ),
    );
  }, []);

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

  const savingVisible = isSaving || isPending;

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
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h1 className="font-serif text-2xl font-semibold text-royal sm:text-3xl">
                <EditableTitle
                  key={`${activeTrip.id}-fam`}
                  value={activeTrip.family_name}
                  onSave={(v) => {
                    const trimmed = v.trim();
                    applyLocalPatch(activeTrip.id, { family_name: trimmed });
                    void withSaving(async () => {
                      setSaveError(null);
                      const res = await updateTripMetadataAction({
                        tripId: activeTrip.id,
                        familyName: trimmed,
                      });
                      if (!res.ok) setSaveError(res.error);
                    });
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
                    void withSaving(async () => {
                      setSaveError(null);
                      const res = await updateTripMetadataAction({
                        tripId: activeTrip.id,
                        adventureName: trimmed,
                      });
                      if (!res.ok) setSaveError(res.error);
                    });
                  }}
                  className="inline-block min-w-[6ch]"
                />
              </h1>
              <SavingIndicator isSaving={savingVisible} />
            </div>
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
              onSwitch={(id) => {
                setActiveTripId(id);
                void touchTripAction(id);
              }}
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
                  !confirm("Are you sure? This can't be undone.")
                )
                  return;
                clearAssignTimer();
                const idToDelete = activeTripId;
                void withSaving(async () => {
                  const res = await deleteTripAction(idToDelete);
                  if (!res.ok) {
                    setSaveError(res.error);
                    showToast("Couldn't delete trip — please try again");
                    return;
                  }
                  startTransition(() => router.refresh());
                });
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
              onClick={() => {
                if (!activeTripId) return;
                applyLocalPatch(activeTripId, {
                  has_cruise: false,
                  cruise_embark: null,
                  cruise_disembark: null,
                });
                void withSaving(async () => {
                  setSaveError(null);
                  const res = await updateTripMetadataAction({
                    tripId: activeTripId,
                    hasCruise: false,
                    cruiseEmbark: null,
                    cruiseDisembark: null,
                  });
                  if (!res.ok) setSaveError(res.error);
                  else startTransition(() => router.refresh());
                });
              }}
              className="rounded-lg border border-royal/20 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Reset Cruise
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeTripId) return;
                applyLocalPatch(activeTripId, { assignments: {} });
                void withSaving(async () => {
                  setSaveError(null);
                  const res = await updateAssignmentsAction({
                    tripId: activeTripId,
                    assignments: {},
                  });
                  if (!res.ok) {
                    setSaveError(res.error);
                    showToast("Couldn't save — please try again");
                    startTransition(() => router.refresh());
                  } else startTransition(() => router.refresh());
                });
              }}
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
            await withSaving(async () => {
              const res = await updateTripFromWizardAction({
                tripId: wizardEditId,
                familyName: data.family_name,
                adventureName: data.adventure_name,
                destination: data.destination,
                startDate: data.start_date,
                endDate: data.end_date,
                hasCruise: data.has_cruise,
                cruiseEmbark: data.cruise_embark,
                cruiseDisembark: data.cruise_disembark,
              });
              if (!res.ok) throw new Error(res.error);
            });
            startTransition(() => router.refresh());
            return;
          }

          return await withSaving(async () => {
            const res = await createTripAction({
              familyName: data.family_name,
              adventureName: data.adventure_name,
              destination: data.destination,
              startDate: data.start_date,
              endDate: data.end_date,
              hasCruise: data.has_cruise,
              cruiseEmbark: data.cruise_embark,
              cruiseDisembark: data.cruise_disembark,
            });

            if (!res.ok) {
              if (res.error === "TIER_LIMIT") {
                setTierLimitOpen(true);
                return false;
              }
              throw new Error(res.error);
            }
            startTransition(() => router.refresh());
            return undefined;
          });
        }}
      />

      <SmartPlanModal isOpen={smartOpen} onClose={() => setSmartOpen(false)} />

      <TierLimitModal
        isOpen={tierLimitOpen}
        onClose={() => setTierLimitOpen(false)}
        reason="You already have a trip on the free plan."
      />

      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 z-[80] max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-full bg-royal px-4 py-2 text-center font-sans text-sm text-cream shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
