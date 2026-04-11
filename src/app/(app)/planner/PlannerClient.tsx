"use client";

import { generateAIPlanAction } from "@/actions/ai";
import {
  createTripAction,
  deleteTripAction,
  touchTripAction,
  updateAssignmentsAction,
  updateTripFromWizardAction,
  updateTripMetadataAction,
} from "@/actions/trips";
import { AppNavHeader } from "@/components/app/AppNavHeader";
import { AchievementToast } from "@/components/gamification/AchievementToast";
import { deleteCustomTileAction } from "@/actions/custom-tiles";
import { Calendar } from "@/components/planner/Calendar";
import { CrowdStrategyBanner } from "@/components/planner/CrowdStrategyBanner";
import { MobileDayView } from "@/components/planner/MobileDayView";
import { Countdown } from "@/components/planner/Countdown";
import { CustomTileModal } from "@/components/planner/CustomTileModal";
import { DayNotesPanel } from "@/components/planner/DayNotesPanel";
import { EditableTitle } from "@/components/planner/EditableTitle";
import { MobilePlannerDock } from "@/components/planner/MobilePlannerDock";
import { Palette } from "@/components/planner/Palette";
import { PlannerActionsMenu } from "@/components/planner/PlannerActionsMenu";
import { PlannerTopNotices } from "@/components/planner/PlannerTopNotices";
import { SavingIndicator } from "@/components/planner/SavingIndicator";
import { FamilyInvitePanel } from "@/components/planner/FamilyInvitePanel";
import { ShareTripPanel } from "@/components/planner/ShareTripPanel";
import {
  SmartPlanModal,
  type SmartPlanGeneratePayload,
} from "@/components/planner/SmartPlanModal";
import { TripSelector } from "@/components/planner/TripSelector";
import { BookTripAffiliatePanel } from "@/components/planner/BookTripAffiliatePanel";
import { hasAnyAffiliatePartner } from "@/lib/affiliates";
import { PdfExportButton } from "@/components/planner/PdfExportButton";
import { TripTimeline } from "@/components/planner/TripTimeline";
import { Wizard } from "@/components/planner/Wizard";
import { TierLimitModal } from "@/components/paywall/TierLimitModal";
import { trackEvent } from "@/lib/analytics/client";
import {
  plannerAiDayCrowdNotes,
  plannerUserDayNotes,
} from "@/lib/planner-note-maps";
import { getTierConfig } from "@/lib/tiers";
import { useToast } from "@/lib/toast";
import type {
  AchievementDefinition,
  Assignments,
  CustomTile,
  Park,
  Region,
  SlotType,
  Trip,
  UserTier,
} from "@/lib/types";
import { customTileToPark } from "@/lib/types";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import "./planner.css";

type Props = {
  initialTrips: Trip[];
  parks: Park[];
  regions: Region[];
  initialActiveTripId: string | null;
  userEmail: string;
  /** From `profiles.tier`; null if missing (treated like free for trip limit UX). */
  userTier: UserTier | null;
  achievementDefs: AchievementDefinition[];
  /** Successful AI generations per trip id (for free-tier UX). */
  aiGenerationCountsByTrip: Record<string, number>;
  /** Absolute site URL for share links (no trailing slash). */
  siteUrl: string;
  /** Show post-checkout help (URL param from marketing). */
  purchaseHighlight: boolean;
  /** After cloning a public plan: custom tiles removed from source (from `?tile_scrubbed=`). */
  initialTileScrubNotice: number | null;
  initialCustomTiles: CustomTile[];
  /** From `user_custom_tile_limit` RPC. */
  customTileLimit: number;
};

const ASSIGN_DEBOUNCE_MS = 450;
const SAVE_FLASH_MS = 500;
/** Must match server-side enforcement via `getTierConfig("free")`. */
const FREE_TIER_TRIP_LIMIT = getTierConfig("free").features.max_trips ?? 1;

function isFreeTierForTripLimit(tier: UserTier | null): boolean {
  return tier === null || tier === "free";
}

function shouldBlockNewTripWizard(
  tripsLength: number,
  tier: UserTier | null,
): boolean {
  return (
    isFreeTierForTripLimit(tier) && tripsLength >= FREE_TIER_TRIP_LIMIT
  );
}

function resolvePaletteRegionId(trip: Trip | null): string | null {
  if (!trip) return null;
  if (trip.region_id) return trip.region_id;
  if (trip.destination !== "custom") return trip.destination;
  return null;
}

type AchievementToastItem = { id: string; def: AchievementDefinition };

export function PlannerClient({
  initialTrips,
  parks,
  regions,
  initialActiveTripId,
  userEmail,
  userTier,
  achievementDefs,
  aiGenerationCountsByTrip: initialAiCounts,
  siteUrl,
  purchaseHighlight,
  initialTileScrubNotice,
  initialCustomTiles,
  customTileLimit,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { message: toastMessage, show: showToast } = useToast();

  const achievementDefByKey = useMemo(
    () => new Map(achievementDefs.map((d) => [d.key, d])),
    [achievementDefs],
  );

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
  const [smartError, setSmartError] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiGenByTrip, setAiGenByTrip] = useState(initialAiCounts);
  const [achievementToasts, setAchievementToasts] = useState<
    AchievementToastItem[]
  >([]);
  const [tierLimitVariant, setTierLimitVariant] = useState<
    "trips" | "ai" | "custom"
  >("trips");
  const [tierLimitReason, setTierLimitReason] = useState(
    "You already have a trip on the free plan.",
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [customTiles, setCustomTiles] = useState<CustomTile[]>(
    initialCustomTiles,
  );
  const [customTileModalOpen, setCustomTileModalOpen] = useState(false);
  const [customTileModalGroup, setCustomTileModalGroup] =
    useState<string>("dining");
  const [editingCustomTile, setEditingCustomTile] =
    useState<CustomTile | null>(null);

  const hintRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileScrubToastShown = useRef(false);

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  const hasAnyAssignment = useMemo(() => {
    if (!activeTrip) return false;
    return Object.values(activeTrip.assignments).some(
      (a) => a && Object.keys(a).length > 0,
    );
  }, [activeTrip]);

  const regionLabel = useMemo(() => {
    if (!activeTrip?.region_id) return "your destination";
    const r = regions.find((x) => x.id === activeTrip.region_id);
    return r?.short_name ?? r?.name ?? "your destination";
  }, [activeTrip?.region_id, regions]);

  const calendarParks = useMemo(
    () => [...parks, ...customTiles.map(customTileToPark)],
    [parks, customTiles],
  );

  const mobilePlannerNoteMaps = useMemo(() => {
    if (!activeTrip) {
      return {
        ai: {} as Record<string, string>,
        user: {} as Record<string, string>,
      };
    }
    return {
      ai: plannerAiDayCrowdNotes(activeTrip),
      user: plannerUserDayNotes(activeTrip),
    };
  }, [activeTrip]);

  const mobileCrowdSummaryText = useMemo(() => {
    if (!activeTrip?.preferences) return null;
    const s = activeTrip.preferences.ai_crowd_summary;
    return typeof s === "string" && s.trim() ? s.trim() : null;
  }, [activeTrip?.preferences]);

  const activeRegionLabel = useMemo(() => {
    const rid = activeTrip?.region_id;
    if (!rid) return "Orlando";
    const r = regions.find((x) => x.id === rid);
    return r?.short_name?.trim() || r?.name?.trim() || "Orlando";
  }, [activeTrip?.region_id, regions]);

  const customTilesForPalette = useMemo(() => {
    const rid = resolvePaletteRegionId(activeTrip);
    if (!rid) return [];
    return customTiles.filter(
      (t) =>
        t.save_to_library || (t.region_ids?.includes(rid) ?? false),
    );
  }, [customTiles, activeTrip]);

  const remainingCustomCreates = useMemo(() => {
    if (customTileLimit >= 1000) return 999999;
    return Math.max(0, customTileLimit - customTiles.length);
  }, [customTileLimit, customTiles.length]);

  const enqueueAchievementKeys = useCallback(
    (keys: string[]) => {
      const next: AchievementToastItem[] = [];
      for (const key of keys) {
        const def = achievementDefByKey.get(key);
        if (def) {
          next.push({ id: `${key}-${Date.now()}-${Math.random()}`, def });
        }
      }
      if (next.length === 0) return;
      setAchievementToasts((prev) => [...prev, ...next]);
    },
    [achievementDefByKey],
  );

  const dismissAchievementToast = useCallback((id: string) => {
    setAchievementToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    if (
      tileScrubToastShown.current ||
      initialTileScrubNotice == null ||
      initialTileScrubNotice <= 0
    ) {
      return;
    }
    tileScrubToastShown.current = true;
    const n = initialTileScrubNotice;
    showToast(
      `${n} custom tile${n === 1 ? "" : "s"} were removed because they belonged to the original planner. You can add your own!`,
    );
    router.replace("/planner");
    router.refresh();
  }, [initialTileScrubNotice, router, showToast]);

  /** Merge server counts with local state so refresh never drops below optimistic totals. */
  useEffect(() => {
    setAiGenByTrip((prev) => {
      const ids = new Set([
        ...Object.keys(initialAiCounts),
        ...Object.keys(prev),
      ]);
      const out: Record<string, number> = {};
      for (const id of ids) {
        out[id] = Math.max(
          initialAiCounts[id] ?? 0,
          prev[id] ?? 0,
        );
      }
      return out;
    });
  }, [initialAiCounts]);

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
        const r = await fn();
        setLastSavedAt(new Date());
        return r;
      } finally {
        endSaving();
      }
    },
    [beginSaving, endSaving],
  );

  useEffect(() => {
    setCustomTiles(initialCustomTiles);
  }, [initialCustomTiles]);

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

  const handleMobileMenuShare = useCallback(() => {
    const t = trips.find((x) => x.id === activeTripId);
    const slug = t?.public_slug?.trim();
    const base = siteUrl.replace(/\/$/, "");
    const url = slug ? `${base}/plans/${slug}` : window.location.href;
    void navigator.clipboard?.writeText(url);
    showToast("Link copied");
  }, [activeTripId, trips, siteUrl, showToast]);

  const handleAddCustom = useCallback(
    (group: string) => {
      const rid = resolvePaletteRegionId(activeTrip);
      if (!rid) {
        showHint("Set a destination region on this trip first.");
        return;
      }
      setEditingCustomTile(null);
      setCustomTileModalGroup(group);
      setCustomTileModalOpen(true);
    },
    [activeTrip, showHint],
  );

  const handleEditCustom = useCallback((tile: CustomTile) => {
    setEditingCustomTile(tile);
    setCustomTileModalGroup(tile.park_group);
    setCustomTileModalOpen(true);
  }, []);

  const handleDeleteCustom = useCallback(
    async (tileId: string) => {
      const res = await deleteCustomTileAction(tileId);
      if (!res.ok) {
        showToast("Couldn't delete tile — try again");
        return;
      }
      setCustomTiles((prev) => prev.filter((t) => t.id !== tileId));
      startTransition(() => router.refresh());
    },
    [router, showToast],
  );

  const handleCustomTileSuccess = useCallback(
    (tile: CustomTile, newAchievements: string[]) => {
      setCustomTiles((prev) => {
        const i = prev.findIndex((t) => t.id === tile.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = tile;
          return next;
        }
        return [tile, ...prev];
      });
      enqueueAchievementKeys(newAchievements);
      startTransition(() => router.refresh());
    },
    [enqueueAchievementKeys, router],
  );

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

  const handleSmartPlanGenerate = useCallback(
    async (payload: SmartPlanGeneratePayload) => {
      if (!activeTripId) return;
      setSmartError(null);
      setIsAiGenerating(true);
      try {
        const t = trips.find((x) => x.id === activeTripId);
        const res = await generateAIPlanAction({
          tripId: activeTripId,
          mode: payload.mode,
          userPrompt: payload.userPrompt,
          preserveExistingSlots: !payload.replaceExistingTiles,
        });
        if (!res.ok) {
          if (res.error === "TIER_LIMIT") {
            setTierLimitVariant("ai");
            setTierLimitReason(
              "You've used all 5 AI plans for this trip. Upgrade to Pro for unlimited AI.",
            );
            setTierLimitOpen(true);
            return;
          }
          setSmartError(res.message);
          showToast(res.message);
          return;
        }
        const prefPatch: Record<string, unknown> = {
          ...(t?.preferences ?? {}),
          ai_crowd_updated_at: new Date().toISOString(),
        };
        if (res.crowdSummary != null) {
          prefPatch.ai_crowd_summary = res.crowdSummary;
        }
        if (res.dayCrowdNotes != null) {
          prefPatch.ai_day_crowd_notes = res.dayCrowdNotes;
        }
        applyLocalPatch(activeTripId, {
          assignments: res.assignments,
          preferences: prefPatch,
        });
        setAiGenByTrip((prev) => ({
          ...prev,
          [activeTripId]: Math.max(
            res.generationsUsedForTrip,
            prev[activeTripId] ?? 0,
          ),
        }));
        showToast("✨ Plan generated!");
        trackEvent("smart_plan_success", { mode: payload.mode });
        enqueueAchievementKeys(res.newAchievements);
        setSmartOpen(false);
        startTransition(() => router.refresh());
      } finally {
        setIsAiGenerating(false);
      }
    },
    [
      activeTripId,
      applyLocalPatch,
      enqueueAchievementKeys,
      router,
      showToast,
      trips,
    ],
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

  const savingVisible = isSaving || isPending;

  return (
    <div className="min-h-screen bg-cream pb-28 pt-2 lg:pb-16">
      <AppNavHeader
        userEmail={userEmail}
        userTier={userTier}
        tripCount={trips.length}
        freeTripLimit={FREE_TIER_TRIP_LIMIT}
      />

      <div className="mx-auto max-w-7xl px-4 pt-2">
        <PlannerTopNotices
          purchaseHighlight={purchaseHighlight}
          hasTrip={trips.length > 0}
          hasAnyAssignment={hasAnyAssignment}
        />
      </div>

      {activeTrip ? (
        <main className="mx-auto max-w-7xl px-4 py-4 sm:py-6">
          <header className="border-b border-royal/10 pb-5">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-balance font-serif text-2xl font-semibold tracking-tight text-royal sm:text-3xl">
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
                  <span className="text-royal/40"> — </span>
                  <EditableTitle
                    key={`${activeTrip.id}-adv`}
                    value={activeTrip.adventure_name}
                    onSave={(v) => {
                      const trimmed = v.trim();
                      applyLocalPatch(activeTrip.id, {
                        adventure_name: trimmed,
                      });
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
                <SavingIndicator
                  isSaving={savingVisible}
                  lastSavedAt={lastSavedAt}
                />
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <Countdown
                  startDate={activeTrip.start_date}
                  endDate={activeTrip.end_date}
                />
                <TripTimeline trip={activeTrip} variant="inline" />
              </div>
            </div>
          </header>

          <div className="mt-5">
            <TripSelector
              className="w-full"
              trips={trips}
              activeTripId={activeTripId}
              onSwitch={(id) => {
                setActiveTripId(id);
                void touchTripAction(id);
              }}
              onNew={() => {
                if (shouldBlockNewTripWizard(trips.length, userTier)) {
                  setTierLimitVariant("trips");
                  setTierLimitReason(
                    "You've used your 1 free trip. Upgrade to Pro for unlimited trips.",
                  );
                  setTierLimitOpen(true);
                  return;
                }
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
            <p className="mt-2 text-center font-sans text-sm font-medium text-royal sm:text-left">
              {hint}
            </p>
          ) : null}

          <section
            className="mt-5 flex flex-wrap items-center gap-2"
            aria-label="Trip actions"
          >
            <button
              type="button"
              onClick={() => {
                setWizardEditId(activeTripId);
                setWizardFirstRun(false);
                setWizardOpen(true);
              }}
              className="rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream shadow-sm transition hover:bg-royal/90"
            >
              Edit trip
            </button>
            <button
              type="button"
              onClick={() => {
                setSmartError(null);
                setSmartOpen(true);
              }}
              className="rounded-lg border-2 border-gold bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/10"
            >
              Smart Plan ✨
            </button>
            <PdfExportButton
              tripId={activeTripId}
              disabled={!activeTripId}
              buttonId="planner-pdf-export-btn"
              onAchievementKeys={(keys) => enqueueAchievementKeys(keys)}
            />
            <PlannerActionsMenu
              onResetCruise={() => {
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
              onClearAll={() => {
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
              onPrint={() => window.print()}
              onExportPdf={() =>
                document.getElementById("planner-pdf-export-btn")?.click()
              }
            />
          </section>

          {typeof activeTrip.preferences?.ai_crowd_summary === "string" &&
          (activeTrip.preferences.ai_crowd_summary as string).trim() ? (
            <CrowdStrategyBanner
              text={(activeTrip.preferences.ai_crowd_summary as string).trim()}
            />
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ShareTripPanel
              tripId={activeTrip.id}
              isPublic={activeTrip.is_public}
              publicSlug={activeTrip.public_slug}
              siteUrl={siteUrl}
              cloneCount={activeTrip.clone_count ?? 0}
              viewCount={activeTrip.view_count ?? 0}
            />
            <FamilyInvitePanel tripId={activeTrip.id} userTier={userTier} />
            <DayNotesPanel trip={activeTrip} tripId={activeTrip.id} />
          </div>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8">
            <div className="hidden space-y-4 md:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
              {hasAnyAffiliatePartner() ? (
                <BookTripAffiliatePanel
                  destinationLabel={activeRegionLabel}
                  tripId={activeTrip.id}
                  startDate={activeTrip.start_date}
                  endDate={activeTrip.end_date}
                  siteUrl={siteUrl}
                />
              ) : null}
              <Palette
                parks={parks}
                customTiles={customTilesForPalette}
                regionId={resolvePaletteRegionId(activeTrip)}
                selectedParkId={selectedParkId}
                onSelectPark={setSelectedParkId}
                onAddCustom={handleAddCustom}
                onEditCustom={handleEditCustom}
                onDeleteCustom={handleDeleteCustom}
              />
            </div>
            <div className="min-w-0 w-full">
              <div className="hidden md:block">
                <Calendar
                  trip={activeTrip}
                  parks={calendarParks}
                  selectedParkId={selectedParkId}
                  onAssign={onAssign}
                  onClear={onClear}
                  onNeedParkFirst={() => showHint("Pick a park first")}
                  onAfterSlotClear={() => showToast("Slot cleared")}
                />
              </div>
              <MobileDayView
                trip={activeTrip}
                parks={calendarParks}
                assignments={activeTrip.assignments ?? {}}
                dayNotes={mobilePlannerNoteMaps.ai}
                userDayNotes={mobilePlannerNoteMaps.user}
                onAssign={onAssign}
                onClear={onClear}
                crowdSummary={mobileCrowdSummaryText}
                readOnly={false}
                onSelectPark={setSelectedParkId}
                onMenuExportPdf={() =>
                  document.getElementById("planner-pdf-export-btn")?.click()
                }
                onMenuShare={handleMobileMenuShare}
                onMenuSettings={() => undefined}
              />
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="font-serif text-2xl font-semibold text-royal">
            Let&apos;s plan your adventure
          </p>
          <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
            Add dates and destination in the wizard, then drag parks onto your
            calendar. Your plan saves automatically — open Trip Passport anytime
            to see stamps you&apos;ve earned.
          </p>
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left font-sans text-sm text-royal/80">
            <li className="flex gap-2">
              <span className="text-gold" aria-hidden>
                ✓
              </span>
              <span>One free trip to try everything</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold" aria-hidden>
                ✓
              </span>
              <span>Smart Plan suggests a draft itinerary (optional)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold" aria-hidden>
                ✓
              </span>
              <span>Print or tweak days whenever you like</span>
            </li>
          </ul>
          {!wizardOpen ? (
            <button
              type="button"
              onClick={() => {
                setWizardFirstRun(true);
                setWizardOpen(true);
              }}
              className="mt-8 rounded-lg bg-royal px-8 py-3 font-serif text-base font-semibold text-cream shadow-md transition hover:bg-royal/90"
            >
              Open trip wizard
            </button>
          ) : null}
        </main>
      )}

      <Wizard
        isOpen={wizardOpen}
        isFirstRun={wizardFirstRun}
        regions={regions}
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
                regionId: data.region_id,
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
              regionId: data.region_id,
              startDate: data.start_date,
              endDate: data.end_date,
              hasCruise: data.has_cruise,
              cruiseEmbark: data.cruise_embark,
              cruiseDisembark: data.cruise_disembark,
            });

            if (!res.ok) {
              if (res.error === "TIER_LIMIT") {
                setTierLimitVariant("trips");
                setTierLimitReason(
                  "You've used your 1 free trip. Upgrade to Pro for unlimited trips.",
                );
                setTierLimitOpen(true);
                return false;
              }
              throw new Error(res.error);
            }
            enqueueAchievementKeys(res.newAchievements);
            trackEvent("trip_created");
            startTransition(() => router.refresh());
            return undefined;
          });
        }}
      />

      {activeTrip ? (
        <MobilePlannerDock
          trip={activeTrip}
          selectedParkId={selectedParkId}
          onAssign={onAssign}
          onNeedParkFirst={() => showHint("Pick a park first")}
        />
      ) : null}

      <SmartPlanModal
        isOpen={smartOpen}
        onClose={() => {
          setSmartOpen(false);
          setSmartError(null);
        }}
        trip={activeTrip}
        regionLabel={regionLabel}
        generationsUsedThisTrip={aiGenByTrip[activeTripId] ?? 0}
        showFreeTierNote={isFreeTierForTripLimit(userTier)}
        isGenerating={isAiGenerating}
        submitError={smartError}
        onGenerate={handleSmartPlanGenerate}
      />

      {activeTrip ? (
        <CustomTileModal
          isOpen={customTileModalOpen}
          onClose={() => {
            setCustomTileModalOpen(false);
            setEditingCustomTile(null);
          }}
          regionId={resolvePaletteRegionId(activeTrip) ?? ""}
          initialCategory={customTileModalGroup}
          editingTile={editingCustomTile}
          remainingCreates={remainingCustomCreates}
          showFreeTierTileCounter={isFreeTierForTripLimit(userTier)}
          tilesUsedCount={customTiles.length}
          onSuccess={handleCustomTileSuccess}
          onTierLimitReached={() => {
            setTierLimitVariant("custom");
            setTierLimitReason(
              "You've created all 5 custom tiles on the free plan. Upgrade to Pro for unlimited custom tiles.",
            );
            setTierLimitOpen(true);
          }}
        />
      ) : null}

      <TierLimitModal
        isOpen={tierLimitOpen}
        onClose={() => setTierLimitOpen(false)}
        variant={tierLimitVariant}
        reason={tierLimitReason}
      />

      <div
        className="pointer-events-none fixed right-4 top-20 z-[85] flex max-w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {achievementToasts.map((item) => (
          <AchievementToast
            key={item.id}
            achievement={item.def}
            onDismiss={() => dismissAchievementToast(item.id)}
          />
        ))}
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 z-[80] max-w-[min(90vw,20rem)] -translate-x-1/2 rounded-full bg-royal px-4 py-2 text-center font-sans text-sm text-cream shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
