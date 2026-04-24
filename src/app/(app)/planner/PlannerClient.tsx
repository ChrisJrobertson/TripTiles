"use client";

import {
  assignmentWithUpdatedSlotTime,
  countFilledSlots,
  getParkIdFromSlotValue,
} from "@/lib/assignment-slots";
import {
  generateAIPlanAction,
  generateDayTimeline,
  generateMustDosForPark,
  type GenerateAIPlanInput,
  type GenerateAIPlanResult,
} from "@/actions/ai";
import {
  createBlankTripAction,
  deleteTripAction,
  touchTripAction,
  undoSmartPlanAction,
  updateAssignmentsAction,
  updateTripColourThemeAction,
  updateTripFromWizardAction,
  updateTripMetadataAction,
  updateParkMustDoDoneAction,
  updateTripPlanningPreferencesAction,
  updateTripPreferencesPatchAction,
} from "@/actions/trips";
import { AppNavHeader } from "@/components/app/AppNavHeader";
import { InlineLoadingOverlay } from "@/components/ui/InlineLoadingOverlay";
import { AchievementToast } from "@/components/gamification/AchievementToast";
import { deleteCustomTileAction } from "@/actions/custom-tiles";
import {
  getConflictDotSummaryForTrip,
  getRidePrioritiesForDay,
  getRidePrioritiesForTrip,
  updateRidePriorityMeta,
  type DayConflictDotSummary,
} from "@/actions/ride-priorities";
import {
  anchorsAtRiskOnSlotClear,
  anchorsAtRiskOnSlotParkChange,
  type BookingAnchor,
} from "@/lib/booking-anchor-risk";
import {
  BookingConflictModal,
  type BookingConflictAction,
} from "@/components/planner/BookingConflictModal";
import { Calendar } from "@/components/planner/Calendar";
import { CompareDaysPanel } from "@/components/planner/CompareDaysPanel";
import { CrowdStrategyBanner } from "@/components/planner/CrowdStrategyBanner";
import { MobileDayView } from "@/components/planner/MobileDayView";
import { PlanningSections } from "@/components/planner/PlanningSections";
import { Countdown } from "@/components/planner/Countdown";
import { CustomTileModal } from "@/components/planner/CustomTileModal";
import { DayDetailLayer } from "@/components/planner/DayDetailLayer";
import { DayNotesPanel } from "@/components/planner/DayNotesPanel";
import { AdventureTitleColorControl } from "@/components/planner/AdventureTitleColorControl";
import { EditableTitle } from "@/components/planner/EditableTitle";
import { MobilePlannerDock } from "@/components/planner/MobilePlannerDock";
import { Palette } from "@/components/planner/Palette";
import { PlannerMoreMenu } from "@/components/planner/PlannerMoreMenu";
import { PlannerActionsMenu } from "@/components/planner/PlannerActionsMenu";
import { PlannerTopNotices } from "@/components/planner/PlannerTopNotices";
import { SavingIndicator } from "@/components/planner/SavingIndicator";
import { FamilyInvitePanel } from "@/components/planner/FamilyInvitePanel";
import { ShareTripPanel } from "@/components/planner/ShareTripPanel";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import {
  SmartPlanModal,
  type SmartPlanGeneratePayload,
} from "@/components/planner/SmartPlanModal";
import { TripSelector } from "@/components/planner/TripSelector";
import { BookTripAffiliatePanel } from "@/components/planner/BookTripAffiliatePanel";
import { hasAnyAffiliatePartner } from "@/lib/affiliates";
import { PdfExportButton } from "@/components/planner/PdfExportButton";
import { TripTimeline } from "@/components/planner/TripTimeline";
import { TripStatsCard } from "@/components/planner/TripStatsCard";
import { TrippMascotImg } from "@/components/mascot/TrippMascotImg";
import { TrippSpeechBubble } from "@/components/mascot/TrippSpeechBubble";
import { EmptyCalendarCta } from "@/components/planner/EmptyCalendarCta";
import { TripCreationWizard } from "@/components/planner/TripCreationWizard";
import { TripThemePicker } from "@/components/planner/TripThemePicker";
import { Wizard } from "@/components/planner/Wizard";
import { TierLimitModal } from "@/components/paywall/TierLimitModal";
import { formatUndoSnapshotHint } from "@/lib/date-helpers";
import { buildSurpriseDayPlan } from "@/lib/surprise-day";
import { isCruisePaletteTileName } from "@/lib/cruise-tiles";
import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import { copyTextToClipboard } from "@/lib/clipboard-access";
import {
  sleep,
  SMART_PLAN_CLIENT_TIMEOUT_MS,
  withTimeout,
} from "@/lib/smart-plan-client";
import {
  ADVENTURE_TITLE_COLOR_KEY,
  resolvedAdventureTitleColor,
} from "@/lib/adventure-title-color";
import { trackEvent } from "@/lib/analytics/client";
import {
  plannerAiDayCrowdNotes,
  plannerUserDayNotes,
} from "@/lib/planner-note-maps";
import {
  eachDateKeyInRange,
  formatDateISO,
  formatDateKey,
  parseDate,
} from "@/lib/date-helpers";
import {
  computePlannerDayConflicts,
  conflictDotForDay,
} from "@/lib/planner-day-conflicts";
import {
  normaliseThemeKey,
  plannerThemeStyleVars,
  type ThemeKey,
} from "@/lib/themes";
import type { Tier } from "@/lib/tier";
import {
  notifyStaleServerActionIfNeeded,
  showToast,
} from "@/lib/toast";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import type {
  AchievementDefinition,
  Assignment,
  Assignments,
  CustomTile,
  Park,
  Region,
  SlotType,
  TemperatureUnit,
  Trip,
  UserTier,
} from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import type { TripPayment } from "@/types/payments";
import { customTileToPark } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  /** From `profiles.tier` (server validates row before render). */
  userTier: UserTier;
  /** Effective Stripe + legacy product tier for caps and nav. */
  productTier: Tier;
  productPlanLabel: string;
  maxActiveTripCap: number | "unlimited";
  stripeCustomerId: string | null;
  achievementDefs: AchievementDefinition[];
  /** Successful AI generations per trip id (for free-tier UX). */
  aiGenerationCountsByTrip: Record<string, number>;
  /** Absolute site URL for share links (no trailing slash). */
  siteUrl: string;
  /** After cloning a public plan: custom tiles removed from source (from `?tile_scrubbed=`). */
  initialTileScrubNotice: number | null;
  initialCustomTiles: CustomTile[];
  /** From `?openSmartPlan=true` (e.g. post-onboarding AI path). */
  initialOpenSmartPlan?: boolean;
  /** From `?autoGenerate=true` — run Smart Plan once using stored wizard preferences. */
  initialAutoGenerate?: boolean;
  /** From `user_custom_tile_limit` RPC. */
  customTileLimit: number;
  /** From `?tab=` on the planner URL. */
  plannerTab?: "planner" | "planning";
  /** Legacy deep-link mapping for Planning accordion pre-open. */
  initialPlanningSection?: "todo" | "payments" | "budget" | null;
  /** From `profiles.temperature_unit` for calendar weather labels. */
  temperatureUnit?: TemperatureUnit;
  /** When true, milestone reminder emails are suppressed for every trip. */
  emailMarketingOptOut?: boolean;
  /** Ride priorities keyed by trip id (server-loaded). */
  initialRidePrioritiesByTripId: Record<string, TripRidePriority[]>;
  /** Per-day counts for trips without a full priority payload loaded. */
  ridePriorityCountByTripAndDay: Record<
    string,
    Record<string, { total: number; mustDo: number }>
  >;
  /** Scheduled payments keyed by trip id (server-loaded). */
  initialPaymentsByTripId: Record<string, TripPayment[]>;
  /** Base path `/trip/{id}` for day detail routes; omit on legacy shells only. */
  tripRouteBase?: string;
  /** Distinct `parks.id` with ≥1 `attractions` row — for catalogue vs AI gating. */
  cataloguedParkIds?: string[];
};

const ASSIGN_DEBOUNCE_MS = 450;
const SAVE_FLASH_MS = 500;

function isFreeTierForTripLimit(tier: Tier): boolean {
  return tier === "free";
}

function shouldBlockNewTripWizard(
  tripsLength: number,
  maxCap: number | "unlimited",
): boolean {
  if (maxCap === "unlimited") return false;
  return tripsLength >= maxCap;
}

function resolvePaletteRegionId(trip: Trip | null): string | null {
  if (!trip) return null;
  if (trip.region_id) return trip.region_id;
  if (trip.destination !== "custom") return trip.destination;
  return null;
}

type SmartGenResult = Awaited<ReturnType<typeof generateAIPlanAction>>;

/** One automatic retry after 2s for timeouts and generic Smart Plan failures. */
async function runSmartPlanWithTimeoutAndRetry(
  run: () => Promise<SmartGenResult>,
  notify: (msg: string) => void,
): Promise<SmartGenResult> {
  let res: SmartGenResult;
  try {
    res = await withTimeout(run(), SMART_PLAN_CLIENT_TIMEOUT_MS);
  } catch {
    res = {
      ok: false,
      error: "AI_ERROR",
      message: "Smart Plan is still working — this pass hit the time limit.",
    };
  }
  if (res.ok) return res;
  if (
    res.error === "TIER_LIMIT" ||
    res.error === "TIER_AI_DISABLED" ||
    res.error === "NOT_AUTHED"
  ) {
    return res;
  }
  notify("Still working on your plan — hold tight…");
  await sleep(2000);
  try {
    return await withTimeout(run(), SMART_PLAN_CLIENT_TIMEOUT_MS);
  } catch {
    return {
      ok: false,
      error: "AI_ERROR",
      message:
        "Smart Plan couldn't generate your plan — try again from the planner, or build it yourself.",
    };
  }
}

type StreamHandlers = {
  onDelta: (deltaText: string) => void;
};

async function streamGeneratePlan(
  input: GenerateAIPlanInput,
  handlers: StreamHandlers,
): Promise<GenerateAIPlanResult> {
  const response = await fetch("/api/ai/generate-plan-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    throw new Error("Smart Plan stream failed to start.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneResult: GenerateAIPlanResult | null = null;

  const parseEventBlock = (block: string) => {
    const lines = block
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean);
    if (lines.length === 0) return;

    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }
    if (dataLines.length === 0) return;

    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (eventName === "delta") {
      const text = (payload as { text?: unknown }).text;
      if (typeof text === "string" && text.length > 0) {
        handlers.onDelta(text);
      }
      return;
    }

    if (eventName === "done") {
      doneResult = payload as GenerateAIPlanResult;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex);
      parseEventBlock(block);
      buffer = buffer.slice(separatorIndex + 2);
      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim().length > 0) {
    parseEventBlock(buffer.trim());
  }

  if (!doneResult) {
    throw new Error("Smart Plan stream ended unexpectedly.");
  }
  return doneResult;
}

type AchievementToastItem = { id: string; def: AchievementDefinition };

type PlannerSlotBooking = {
  dayDate: string;
  action: BookingConflictAction;
  anchors: BookingAnchor[];
  newParkName?: string;
  pending:
    | { kind: "assign"; dateKey: string; slot: SlotType; parkId: string }
    | { kind: "clear"; dateKey: string; slot: SlotType };
};

export function PlannerClient({
  initialTrips,
  parks,
  regions,
  initialActiveTripId,
  userEmail,
  userTier,
  productTier,
  productPlanLabel,
  maxActiveTripCap,
  stripeCustomerId,
  achievementDefs,
  aiGenerationCountsByTrip: initialAiCounts,
  siteUrl,
  initialTileScrubNotice,
  initialCustomTiles,
  initialOpenSmartPlan = false,
  initialAutoGenerate = false,
  customTileLimit,
  plannerTab = "planner",
  initialPlanningSection = null,
  temperatureUnit = "c",
  emailMarketingOptOut = false,
  initialRidePrioritiesByTripId,
  ridePriorityCountByTripAndDay,
  initialPaymentsByTripId,
  tripRouteBase,
  cataloguedParkIds: cataloguedParkIdsProp,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const overviewHref = tripRouteBase ?? "/planner";
  const mainScrollRef = useRef<HTMLElement>(null);
  const [isPending, startTransition] = useTransition();

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

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFirstRun, setWizardFirstRun] = useState(true);
  const [blankTripBusy, setBlankTripBusy] = useState(false);
  const [wizardEditId, setWizardEditId] = useState<string | null>(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartPlanUndoOpen, setSmartPlanUndoOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [smartCanRetryPartial, setSmartCanRetryPartial] = useState(false);
  const [smartRetryPayload, setSmartRetryPayload] =
    useState<SmartPlanGeneratePayload | null>(null);
  /** Per-park must-do generation (mobile + day panel). */
  const [mustDosGenLoading, setMustDosGenLoading] = useState<{
    dateKey: string;
    parkId: string;
  } | null>(null);
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
  const smartPlanOpenedFromQueryRef = useRef(false);
  const autoGenerateConsumedRef = useRef(false);
  const [fullPageAiBusy, setFullPageAiBusy] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [adminPanel, setAdminPanel] = useState<
    null | "share" | "family" | "notes"
  >(null);
  const [goToTodayRingDateKey, setGoToTodayRingDateKey] = useState<
    string | null
  >(null);
  const [isTodayVisibleInViewport, setIsTodayVisibleInViewport] = useState(true);
  const smartLandingScrollDoneRef = useRef<string | null>(null);
  /** Loaded eagerly for all trips; Day Detail is the future boundary for lazy per-day fetch. */
  const [ridePrioritiesByTripId, setRidePrioritiesByTripId] = useState<
    Record<string, TripRidePriority[]>
  >(() => initialRidePrioritiesByTripId);
  const [paymentsByTripId, setPaymentsByTripId] = useState<
    Record<string, TripPayment[]>
  >(() => initialPaymentsByTripId);
  const [surpriseUndo, setSurpriseUndo] = useState<{
    tripId: string;
    dateKey: string;
    prevDay: Assignment | undefined;
    prevUserNote: string;
  } | null>(null);
  const [calendarConflictDotsSource, setCalendarConflictDotsSource] = useState<
    "server" | "client"
  >("client");
  const [calendarConflictDotSummary, setCalendarConflictDotSummary] =
    useState<DayConflictDotSummary>({});
  const [plannerSlotBooking, setPlannerSlotBooking] =
    useState<PlannerSlotBooking | null>(null);
  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  const cataloguedParkIdSet = useMemo(
    () => new Set(cataloguedParkIdsProp ?? []),
    [cataloguedParkIdsProp],
  );

  const pathTripIdFromUrl = pathname.match(/^\/trip\/([^/]+)/)?.[1] ?? null;
  const dayDateFromUrl =
    pathname.match(/\/trip\/[^/]+\/day\/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const dayDetailOpen =
    Boolean(dayDateFromUrl) &&
    Boolean(activeTrip) &&
    pathTripIdFromUrl === activeTrip?.id;

  const dayCanonicalForDetail = useMemo(() => {
    if (!dayDateFromUrl) return null;
    return formatDateISO(parseDate(dayDateFromUrl));
  }, [dayDateFromUrl]);

  const smartLanding = useMemo(() => {
    if (!activeTrip) {
      return { inWindow: false, targetDayKey: null as string | null };
    }
    const today = parseDate(formatDateKey(new Date()));
    const start = parseDate(activeTrip.start_date);
    const end = parseDate(activeTrip.end_date);
    const dayMs = 24 * 60 * 60 * 1000;
    const inWindow =
      today.getTime() >= start.getTime() - dayMs * 3 &&
      today.getTime() <= end.getTime() + dayMs * 3;
    if (!inWindow) return { inWindow: false, targetDayKey: null as string | null };
    if (today.getTime() < start.getTime()) {
      return {
        inWindow: true,
        targetDayKey: formatDateISO(start),
      };
    }
    if (today.getTime() > end.getTime()) {
      return {
        inWindow: true,
        targetDayKey: formatDateISO(end),
      };
    }
    return {
      inWindow: true,
      targetDayKey: formatDateKey(new Date()),
    };
  }, [activeTrip]);

  useEffect(() => {
    if (!pathTripIdFromUrl) return;
    if (trips.some((t) => t.id === pathTripIdFromUrl)) {
      setActiveTripId(pathTripIdFromUrl);
    }
  }, [pathTripIdFromUrl, trips]);

  useLayoutEffect(() => {
    if (dayDetailOpen) return;
    const key = `trip-${activeTripId}-scroll`;
    const raw = sessionStorage.getItem(key);
    if (raw == null || !mainScrollRef.current) return;
    const y = Number(raw);
    if (!Number.isNaN(y)) mainScrollRef.current.scrollTop = y;
    sessionStorage.removeItem(key);
  }, [dayDetailOpen, activeTripId]);

  useLayoutEffect(() => {
    if (plannerTab !== "planner") return;
    if (!activeTrip || !smartLanding.targetDayKey || dayDetailOpen) return;
    const runKey = `${activeTrip.id}:${smartLanding.targetDayKey}`;
    if (smartLandingScrollDoneRef.current === runKey) return;
    let cancelled = false;
    const targetId = `planner-day-${smartLanding.targetDayKey}`;
    const tryScroll = (attempt = 0) => {
      if (cancelled) return;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        smartLandingScrollDoneRef.current = runKey;
        return;
      }
      if (attempt < 8) {
        window.requestAnimationFrame(() => tryScroll(attempt + 1));
      }
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [activeTrip, dayDetailOpen, plannerTab, smartLanding.targetDayKey]);

  useEffect(() => {
    if (plannerTab !== "planner" || dayDetailOpen || !activeTrip) {
      setIsTodayVisibleInViewport(true);
      return;
    }
    const todayKey = formatDateKey(new Date());
    const keys = eachDateKeyInRange(activeTrip.start_date, activeTrip.end_date);
    if (!keys.includes(todayKey)) {
      setIsTodayVisibleInViewport(true);
      return;
    }
    const el = document.getElementById(`planner-day-${todayKey}`);
    if (!el) {
      setIsTodayVisibleInViewport(false);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setIsTodayVisibleInViewport(entries[0]?.isIntersecting ?? false);
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTrip, dayDetailOpen, plannerTab]);

  useEffect(() => {
    setRidePrioritiesByTripId(initialRidePrioritiesByTripId);
  }, [initialRidePrioritiesByTripId]);

  useEffect(() => {
    if (!activeTripId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getRidePrioritiesForTrip(activeTripId);
        if (cancelled) return;
        setRidePrioritiesByTripId((prev) => {
          if ((prev[activeTripId]?.length ?? 0) > 0) return prev;
          return { ...prev, [activeTripId]: rows };
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTripId]);

  useEffect(() => {
    if (!dayDetailOpen || !dayCanonicalForDetail || !activeTripId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getRidePrioritiesForDay(
          activeTripId,
          dayCanonicalForDetail,
        );
        if (cancelled) return;
        setRidePrioritiesByTripId((prev) => {
          const list = prev[activeTripId] ?? [];
          const merged = [
            ...list.filter((x) => x.day_date !== dayCanonicalForDetail),
            ...rows,
          ];
          return { ...prev, [activeTripId]: merged };
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dayDetailOpen, dayCanonicalForDetail, activeTripId]);

  useEffect(() => {
    setPaymentsByTripId(initialPaymentsByTripId);
  }, [initialPaymentsByTripId]);

  const ridePrioritiesForActiveTrip = useMemo(
    () => ridePrioritiesByTripId[activeTripId] ?? [],
    [ridePrioritiesByTripId, activeTripId],
  );

  const ridePrioritiesByDayForActiveTrip = useMemo(() => {
    const m: Record<string, TripRidePriority[]> = {};
    for (const p of ridePrioritiesForActiveTrip) {
      const list = m[p.day_date] ?? [];
      list.push(p);
      m[p.day_date] = list;
    }
    for (const k of Object.keys(m)) {
      m[k] = sortPrioritiesForDay(m[k]!);
    }
    return m;
  }, [ridePrioritiesForActiveTrip]);

  const handleRideDayPrioritiesUpdated = useCallback(
    (dayDate: string, items: TripRidePriority[]) => {
      if (!activeTripId) return;
      setRidePrioritiesByTripId((prev) => {
        const list = prev[activeTripId] ?? [];
        const merged = [
          ...list.filter((x) => x.day_date !== dayDate),
          ...items,
        ];
        return { ...prev, [activeTripId]: merged };
      });
    },
    [activeTripId],
  );

  const parkByIdPlanner = useMemo(
    () => new Map(parks.map((p) => [p.id, p] as const)),
    [parks],
  );

  const patchClearSkipLineReturnsOnDay = useCallback(
    (dayDate: string, attractionIds: string[]) => {
      if (!activeTripId || attractionIds.length === 0) return;
      setRidePrioritiesByTripId((prev) => {
        const list = prev[activeTripId] ?? [];
        const idSet = new Set(attractionIds);
        const next = list.map((r) =>
          r.day_date === dayDate && idSet.has(r.attraction_id)
            ? { ...r, skip_line_return_hhmm: null }
            : r,
        );
        return { ...prev, [activeTripId]: next };
      });
    },
    [activeTripId],
  );

  const handlePaymentsChange = useCallback(
    (tripId: string, next: TripPayment[]) => {
      setPaymentsByTripId((prev) => ({ ...prev, [tripId]: next }));
    },
    [],
  );

  const timelineUnlocked = productTier !== "free";

  const shellThemeStyle = useMemo(
    () =>
      plannerThemeStyleVars(
        normaliseThemeKey(
          trips.find((t) => t.id === activeTripId)?.colour_theme,
        ),
      ),
    [trips, activeTripId],
  );

  const hasAnyAssignment = useMemo(() => {
    if (!activeTrip) return false;
    return countFilledSlots(activeTrip.assignments) > 0;
  }, [activeTrip]);

  const regionLabel = useMemo(() => {
    if (!activeTrip?.region_id) return "your destination";
    const r = regions.find((x) => x.id === activeTrip.region_id);
    return r?.short_name ?? r?.name ?? "your destination";
  }, [activeTrip?.region_id, regions]);

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

  const calendarParks = useMemo(() => {
    const rid = resolvePaletteRegionId(activeTrip);
    const catalog = parks.filter((p) => parkMatchesPlannerRegion(p, rid));
    const filtered =
      activeTrip?.has_cruise
        ? catalog
        : catalog.filter((p) => !isCruisePaletteTileName(p.name));
    return [...filtered, ...customTilesForPalette.map(customTileToPark)];
  }, [parks, customTilesForPalette, activeTrip]);

  const smartPlanParks = useMemo(() => {
    const rid = resolvePaletteRegionId(activeTrip);
    if (!rid) return [];
    const raw = parks.filter(
      (p) => !p.is_custom && parkMatchesPlannerRegion(p, rid),
    );
    if (activeTrip?.has_cruise) return raw;
    return raw.filter((p) => !isCruisePaletteTileName(p.name));
  }, [parks, activeTrip]);

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
    router.replace(overviewHref);
    router.refresh();
  }, [initialTileScrubNotice, router, overviewHref]);

  useEffect(() => {
    if (!initialOpenSmartPlan) return;
    if (smartPlanOpenedFromQueryRef.current) return;
    if (!activeTripId) return;
    smartPlanOpenedFromQueryRef.current = true;
    setSmartOpen(true);
    startTransition(() => {
      router.replace(overviewHref, { scroll: false });
    });
  }, [initialOpenSmartPlan, activeTripId, router, overviewHref]);

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

  const startBlankTrip = useCallback(async () => {
    if (shouldBlockNewTripWizard(trips.length, maxActiveTripCap)) {
      setTierLimitVariant("trips");
      setTierLimitReason(
        maxActiveTripCap === 1
          ? "Free includes one active trip. Upgrade to Pro or Family on Pricing for more."
          : `Your plan allows ${maxActiveTripCap} active trips. Archive one or upgrade on Pricing.`,
      );
      setTierLimitOpen(true);
      return;
    }
    setBlankTripBusy(true);
    try {
      const r = await createBlankTripAction();
      if (!r.ok) {
        showToast(r.error, { type: "error" });
        return;
      }
      startTransition(() => {
        router.push(`/trip/${r.tripId}`);
        router.refresh();
      });
    } finally {
      setBlankTripBusy(false);
    }
  }, [trips.length, maxActiveTripCap, router]);

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
      setWizardOpen(false);
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
    void copyTextToClipboard(url);
    showToast("Link copied");
  }, [activeTripId, trips, siteUrl]);

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
    [router],
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
    [clearAssignTimer, router, withSaving],
  );

  useEffect(() => {
    return () => clearAssignTimer();
  }, [clearAssignTimer]);

  useEffect(() => {
    if (!surpriseUndo) return;
    const id = window.setTimeout(() => setSurpriseUndo(null), 5000);
    return () => window.clearTimeout(id);
  }, [surpriseUndo]);

  useEffect(() => {
    setCompareMode(false);
  }, [activeTripId]);

  const applyLocalPatch = useCallback((tripId: string, patch: Partial<Trip>) => {
    const ts = new Date().toISOString();
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, ...patch, updated_at: ts } : t,
      ),
    );
  }, []);

  const runMustDosGen = useCallback(
    async (dateKey: string, parkId: string) => {
      if (!activeTripId) return;
      setMustDosGenLoading({ dateKey, parkId });
      try {
        const res = await generateMustDosForPark({
          tripId: activeTripId,
          dateISO: dateKey,
          parkId,
        });
        if (!res.ok) {
          if (res.code === "TIER_LIMIT" || res.code === "TIER_AI_DISABLED") {
            setTierLimitVariant("ai");
            setTierLimitReason(
              res.error ||
                (res.code === "TIER_LIMIT"
                  ? "You have used your Smart Plan allowance on the Free plan."
                  : "Smart Plan is not available on your current plan."),
            );
            setTierLimitOpen(true);
          } else {
            showToast(res.error);
          }
          return;
        }
        applyLocalPatch(activeTripId, {
          preferences: res.nextPreferences,
        });
      } finally {
        setMustDosGenLoading(null);
      }
    },
    [activeTripId, applyLocalPatch],
  );

  const handleToggleMustDoDone = useCallback(
    async (
      dateKey: string,
      parkId: string,
      mustDoId: string,
      nextDone: boolean,
    ) => {
      if (!activeTripId) return;
      const res = await updateParkMustDoDoneAction({
        tripId: activeTripId,
        dateISO: dateKey,
        parkId,
        mustDoId,
        done: nextDone,
      });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      applyLocalPatch(activeTripId, {
        preferences: res.nextPreferences,
      });
    },
    [activeTripId, applyLocalPatch],
  );

  const handleColourThemeChange = useCallback(
    async (key: ThemeKey) => {
      if (!activeTripId) return;
      applyLocalPatch(activeTripId, { colour_theme: key });
      const res = await updateTripColourThemeAction({
        tripId: activeTripId,
        colourTheme: key,
      });
      if (!res.ok) {
        showToast(res.error);
        startTransition(() => router.refresh());
      }
    },
    [activeTripId, applyLocalPatch, router],
  );

  const handleTripIncludesCruiseChange = useCallback(
    async (next: boolean) => {
      if (!activeTripId) return;
      const cur = trips.find((t) => t.id === activeTripId);
      applyLocalPatch(activeTripId, {
        has_cruise: next,
        ...(next ? {} : { cruise_embark: null, cruise_disembark: null }),
      });
      const res = await updateTripMetadataAction({
        tripId: activeTripId,
        hasCruise: next,
        cruiseEmbark: next ? cur?.cruise_embark ?? null : null,
        cruiseDisembark: next ? cur?.cruise_disembark ?? null : null,
      });
      if (!res.ok) {
        showToast(res.error);
        startTransition(() => router.refresh());
      }
    },
    [activeTripId, trips, applyLocalPatch, router],
  );

  const handleSmartPlanGenerate = useCallback(
    async (payload: SmartPlanGeneratePayload) => {
      if (!activeTripId) return;
      setSmartError(null);
      setSmartCanRetryPartial(false);
      setSmartRetryPayload(payload);
      setIsAiGenerating(true);
      let sawFirstToken = false;
      try {
        if (payload.planningPreferences != null) {
          const prefRes = await updateTripPlanningPreferencesAction({
            tripId: activeTripId,
            planningPreferences: payload.planningPreferences,
          });
          if (!prefRes.ok) {
            setSmartError(prefRes.error);
            showToast(prefRes.error);
            return;
          }
          applyLocalPatch(activeTripId, {
            planning_preferences: payload.planningPreferences,
          });
        }
        const tripBefore = trips.find((x) => x.id === activeTripId);
        if (payload.dateKey) {
          const dayRes = await generateDayTimeline(
            activeTripId,
            payload.dateKey,
          );
          if (!dayRes.ok) {
            if (dayRes.code === "tier_limit") {
              setTierLimitVariant("ai");
              setTierLimitReason(dayRes.error);
              setTierLimitOpen(true);
            } else if (dayRes.code === "rate_limit") {
              showToast(
                "Too many generations in a row. Try again in a minute.",
              );
            } else if (dayRes.code === "invalid_day") {
              showToast("This date is outside your trip dates.");
            } else {
              showToast(
                "Couldn't build the plan. Give it another go in a moment.",
              );
            }
            return;
          }
          const t = tripBefore;
          const prevPrefs = (t?.preferences ?? {}) as Record<string, unknown>;
          const existing = prevPrefs.ai_day_timeline;
          const dayMap =
            existing && typeof existing === "object" && !Array.isArray(existing)
              ? { ...(existing as Record<string, unknown>) }
              : {};
          dayMap[payload.dateKey] = dayRes.timeline;
          applyLocalPatch(activeTripId, {
            preferences: { ...prevPrefs, ai_day_timeline: dayMap },
            assignments: dayRes.assignments,
          });
          showToast("✨ Day plan ready! Slot times updated to match the plan.");
          trackEvent("day_timeline_success", { dateKey: payload.dateKey });
          setSmartOpen(false);
          startTransition(() => router.refresh());
          window.setTimeout(() => {
            document.getElementById("tt-day-timeline")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 200);
          return;
        }
        const snapAssignments = tripBefore?.assignments
          ? (JSON.parse(
              JSON.stringify(tripBefore.assignments),
            ) as Assignments)
          : ({} as Assignments);
        const snapPreferences = tripBefore?.preferences
          ? ({ ...tripBefore.preferences } as Record<string, unknown>)
          : ({} as Record<string, unknown>);
        const t = tripBefore;
        const res = await streamGeneratePlan(
          {
            tripId: activeTripId,
            mode: payload.mode,
            userPrompt: payload.userPrompt,
            dateKey: payload.dateKey,
            preserveExistingSlots: !payload.replaceExistingTiles,
          },
          {
            onDelta() {
              if (!sawFirstToken) {
                sawFirstToken = true;
              }
            },
          },
        );
        if (!res.ok) {
          if (res.stoppedEarly) {
            setSmartCanRetryPartial(true);
            setSmartError(res.message || "Stopped early - retry?");
            return;
          }
          if (res.error === "TIER_AI_DISABLED") {
            setTierLimitVariant("ai");
            setTierLimitReason(
              res.message ||
                "Smart Plan is not included on the Free plan. Upgrade on Pricing.",
            );
            setTierLimitOpen(true);
            return;
          }
          if (res.error === "TIER_LIMIT") {
            setTierLimitVariant("ai");
            setTierLimitReason(
              "Smart Plan is not available on your current plan. See Pricing for Pro or Family.",
            );
            setTierLimitOpen(true);
            return;
          }
          const errMsg =
            res.message ||
            "Smart Plan couldn't generate your plan — try again, or build the calendar yourself.";
          setSmartError(errMsg);
          showToast(errMsg);
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
        if (res.mustDos != null && Object.keys(res.mustDos).length > 0) {
          prefPatch.must_dos = res.mustDos;
        }
        applyLocalPatch(activeTripId, {
          assignments: res.assignments,
          preferences: prefPatch,
          previous_assignments_snapshot: snapAssignments,
          previous_preferences_snapshot: snapPreferences,
          previous_assignments_snapshot_at: res.undoSnapshotAt,
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
      } catch (e) {
        if (sawFirstToken) {
          setSmartCanRetryPartial(true);
          setSmartError("Stopped early — retry?");
          return;
        }
        if (notifyStaleServerActionIfNeeded(e)) {
          setSmartError(null);
          return;
        }
        const msg =
          e instanceof Error ? e.message : "Something went wrong. Try again.";
        setSmartError(msg);
        showToast(msg);
      } finally {
        setIsAiGenerating(false);
      }
    },
    [
      activeTripId,
      applyLocalPatch,
      enqueueAchievementKeys,
      router,
      trips,
    ],
  );

  useEffect(() => {
    if (!initialAutoGenerate || !activeTripId) return;
    if (autoGenerateConsumedRef.current) return;
    autoGenerateConsumedRef.current = true;
    void (async () => {
      setFullPageAiBusy(true);
      try {
        const tripBefore =
          trips.find((x) => x.id === activeTripId) ??
          initialTrips.find((x) => x.id === activeTripId);
        const snapAssignments = tripBefore?.assignments
          ? (JSON.parse(
              JSON.stringify(tripBefore.assignments),
            ) as Assignments)
          : ({} as Assignments);
        const snapPreferences = tripBefore?.preferences
          ? ({ ...tripBefore.preferences } as Record<string, unknown>)
          : ({} as Record<string, unknown>);
        const res = await runSmartPlanWithTimeoutAndRetry(
          () =>
            generateAIPlanAction({
              tripId: activeTripId,
              mode: "smart",
              userPrompt: "",
              preserveExistingSlots: true,
            }),
          showToast,
        );
        if (!res.ok) {
          if (res.error === "TIER_AI_DISABLED") {
            setTierLimitVariant("ai");
            setTierLimitReason(
              res.message ||
                "Smart Plan is not included on the Free plan. Upgrade on Pricing.",
            );
            setTierLimitOpen(true);
          } else if (res.error === "TIER_LIMIT") {
            setTierLimitVariant("ai");
            setTierLimitReason(
              "Smart Plan is not available on your current plan. See Pricing for Pro or Family.",
            );
            setTierLimitOpen(true);
          } else {
            showToast(
              res.message ||
                "Smart Plan couldn't generate your plan — you can try again from the planner, or build it yourself.",
            );
          }
          startTransition(() => router.replace(overviewHref));
          return;
        }
        const t = tripBefore;
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
        if (res.mustDos != null && Object.keys(res.mustDos).length > 0) {
          prefPatch.must_dos = res.mustDos;
        }
        applyLocalPatch(activeTripId, {
          assignments: res.assignments,
          preferences: prefPatch,
          previous_assignments_snapshot: snapAssignments,
          previous_preferences_snapshot: snapPreferences,
          previous_assignments_snapshot_at: res.undoSnapshotAt,
        });
        setAiGenByTrip((prev) => ({
          ...prev,
          [activeTripId]: Math.max(
            res.generationsUsedForTrip,
            prev[activeTripId] ?? 0,
          ),
        }));
        showToast("✨ Plan generated!");
        trackEvent("smart_plan_success", { mode: "smart" });
        enqueueAchievementKeys(res.newAchievements);
        startTransition(() => router.replace(overviewHref));
        startTransition(() => router.refresh());
      } catch (e) {
        if (notifyStaleServerActionIfNeeded(e)) {
          startTransition(() => router.replace(overviewHref));
          return;
        }
        showToast(
          e instanceof Error
            ? e.message
            : "Smart Plan couldn't generate your plan — you can try again from the planner, or build it yourself.",
        );
        startTransition(() => router.replace(overviewHref));
      } finally {
        setFullPageAiBusy(false);
      }
    })();
  }, [
    initialAutoGenerate,
    activeTripId,
    applyLocalPatch,
    enqueueAchievementKeys,
    router,
    overviewHref,
    initialTrips,
    trips,
  ]);

  const applySlotAssign = useCallback(
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
            previous_assignments_snapshot: null,
            previous_preferences_snapshot: null,
            previous_assignments_snapshot_at: null,
          };
          scheduleAssignmentsSave(t.id, nextAss);
          return next;
        }),
      );
    },
    [activeTripId, scheduleAssignmentsSave],
  );

  const applySlotClear = useCallback(
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
            previous_assignments_snapshot: null,
            previous_preferences_snapshot: null,
            previous_assignments_snapshot_at: null,
          };
          scheduleAssignmentsSave(t.id, nextAss);
          return next;
        }),
      );
    },
    [activeTripId, scheduleAssignmentsSave],
  );

  const onAssign = useCallback(
    (dateKey: string, slot: SlotType, parkId: string) => {
      if (!activeTripId) return;
      const t = trips.find((x) => x.id === activeTripId);
      if (!t) return;
      const day = t.assignments[dateKey] ?? {};
      const oldSlotVal = day[slot];
      const oldPark = getParkIdFromSlotValue(oldSlotVal);
      const dayRows = ridePrioritiesByDayForActiveTrip[dateKey] ?? [];
      const atRisk = anchorsAtRiskOnSlotParkChange(
        oldPark,
        parkId,
        dayRows,
        parkByIdPlanner,
      );
      if (atRisk.length > 0) {
        setPlannerSlotBooking({
          dayDate: dateKey,
          action: "park-change",
          anchors: atRisk,
          newParkName: parkByIdPlanner.get(parkId)?.name,
          pending: { kind: "assign", dateKey, slot, parkId },
        });
        return;
      }
      applySlotAssign(dateKey, slot, parkId);
    },
    [
      activeTripId,
      trips,
      ridePrioritiesByDayForActiveTrip,
      parkByIdPlanner,
      applySlotAssign,
    ],
  );

  const onClear = useCallback(
    (dateKey: string, slot: SlotType) => {
      if (!activeTripId) return;
      const t = trips.find((x) => x.id === activeTripId);
      if (!t) return;
      const day = t.assignments[dateKey] ?? {};
      const oldSlotVal = day[slot];
      const oldPark = getParkIdFromSlotValue(oldSlotVal);
      const dayRows = ridePrioritiesByDayForActiveTrip[dateKey] ?? [];
      const atRisk = anchorsAtRiskOnSlotClear(
        oldPark,
        dayRows,
        parkByIdPlanner,
      );
      if (atRisk.length > 0) {
        setPlannerSlotBooking({
          dayDate: dateKey,
          action: "slot-clear",
          anchors: atRisk,
          pending: { kind: "clear", dateKey, slot },
        });
        return;
      }
      applySlotClear(dateKey, slot);
    },
    [
      activeTripId,
      trips,
      ridePrioritiesByDayForActiveTrip,
      parkByIdPlanner,
      applySlotClear,
    ],
  );

  const onSlotTimeChange = useCallback(
    (dateKey: string, slot: SlotType, timeHHmm: string) => {
      if (!activeTripId) return;
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const nextAss = assignmentWithUpdatedSlotTime(
            t.assignments,
            dateKey,
            slot,
            timeHHmm,
          );
          if (nextAss === t.assignments) return t;
          scheduleAssignmentsSave(t.id, nextAss);
          return {
            ...t,
            assignments: nextAss,
            updated_at: new Date().toISOString(),
            previous_assignments_snapshot: null,
            previous_preferences_snapshot: null,
            previous_assignments_snapshot_at: null,
          };
        }),
      );
    },
    [activeTripId, scheduleAssignmentsSave],
  );

  const onTransferSlot = useCallback(
    (
      fromDate: string,
      fromSlot: SlotType,
      toDate: string,
      toSlot: SlotType,
    ) => {
      if (!activeTripId) return;
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== activeTripId) return t;
          const nextAss: Assignments = { ...t.assignments };
          const da = { ...(nextAss[fromDate] ?? {}) };
          const db = { ...(nextAss[toDate] ?? {}) };
          const a = da[fromSlot];
          const b = db[toSlot];
          if (a === undefined && b === undefined) return t;
          if (a !== undefined) db[toSlot] = a;
          else delete db[toSlot];
          if (b !== undefined) da[fromSlot] = b;
          else delete da[fromSlot];
          if (Object.keys(da).length === 0) delete nextAss[fromDate];
          else nextAss[fromDate] = da;
          if (Object.keys(db).length === 0) delete nextAss[toDate];
          else nextAss[toDate] = db;
          scheduleAssignmentsSave(t.id, nextAss);
          return {
            ...t,
            assignments: nextAss,
            updated_at: new Date().toISOString(),
            previous_assignments_snapshot: null,
            previous_preferences_snapshot: null,
            previous_assignments_snapshot_at: null,
          };
        }),
      );
    },
    [activeTripId, scheduleAssignmentsSave],
  );

  const handleTripEmailReminders = useCallback(
    async (enabled: boolean) => {
      if (!activeTripId) return;
      applyLocalPatch(activeTripId, { email_reminders: enabled });
      const res = await updateTripMetadataAction({
        tripId: activeTripId,
        emailReminders: enabled,
      });
      if (!res.ok) {
        showToast(res.error);
        startTransition(() => router.refresh());
      }
    },
    [activeTripId, applyLocalPatch, router],
  );

  const undoSurpriseFill = useCallback(() => {
    if (!surpriseUndo || !activeTripId) return;
    const { tripId, dateKey, prevDay, prevUserNote } = surpriseUndo;
    const tripRef = trips.find((x) => x.id === tripId);
    const prefBase =
      tripRef?.preferences && typeof tripRef.preferences === "object"
        ? { ...tripRef.preferences }
        : {};
    const rawNotes = prefBase.day_notes;
    const noteBase =
      rawNotes && typeof rawNotes === "object" && !Array.isArray(rawNotes)
        ? { ...(rawNotes as Record<string, string>) }
        : {};
    const mergedForApi = { ...noteBase };
    if (prevUserNote.trim()) mergedForApi[dateKey] = prevUserNote;
    else delete mergedForApi[dateKey];

    setSurpriseUndo(null);
    setTrips((prev) =>
      prev.map((trip) => {
        if (trip.id !== tripId) return trip;
        const nextAss: Assignments = { ...trip.assignments };
        if (prevDay && Object.keys(prevDay).length > 0) {
          nextAss[dateKey] = { ...prevDay };
        } else {
          delete nextAss[dateKey];
        }
        scheduleAssignmentsSave(trip.id, nextAss);
        const tripPref =
          trip.preferences && typeof trip.preferences === "object"
            ? { ...trip.preferences }
            : {};
        return {
          ...trip,
          assignments: nextAss,
          preferences: { ...tripPref, day_notes: mergedForApi },
          updated_at: new Date().toISOString(),
          previous_assignments_snapshot: null,
          previous_preferences_snapshot: null,
          previous_assignments_snapshot_at: null,
        };
      }),
    );
    void (async () => {
      const res = await updateTripPreferencesPatchAction({
        tripId,
        patch: { day_notes: mergedForApi },
      });
      if (!res.ok) showToast(res.error);
    })();
    showToast("Surprise plan removed.");
  }, [surpriseUndo, activeTripId, trips, scheduleAssignmentsSave]);

  const handleSurpriseMe = useCallback(
    (preferredDateKey?: string | null) => {
      if (!activeTripId) return;
      const t = trips.find((x) => x.id === activeTripId);
      if (!t) return;
      const res = buildSurpriseDayPlan({
        trip: t,
        parks,
        preferredDateKey: preferredDateKey ?? undefined,
      });
      if (!res) {
        showToast(
          "No empty days to fill — clear a day or extend your trip dates.",
        );
        return;
      }
      const userNotes = plannerUserDayNotes(t);
      const prevUserNote = userNotes[res.dateKey] ?? "";
      const prevDay = t.assignments[res.dateKey];
      const surpriseLine =
        "Surprise plan — feel free to swap anything out!";
      const noteMerged = prevUserNote.trim()
        ? `${prevUserNote.trim()}\n\n${surpriseLine}`
        : surpriseLine;

      const rawNotes = t.preferences?.day_notes;
      const noteBase =
        rawNotes &&
        typeof rawNotes === "object" &&
        !Array.isArray(rawNotes)
          ? { ...(rawNotes as Record<string, string>) }
          : {};
      const mergedNotesForServer = { ...noteBase, [res.dateKey]: noteMerged };

      setSurpriseUndo({
        tripId: t.id,
        dateKey: res.dateKey,
        prevDay: prevDay ? { ...prevDay } : undefined,
        prevUserNote,
      });

      setTrips((prev) =>
        prev.map((trip) => {
          if (trip.id !== activeTripId) return trip;
          const nextAss: Assignments = { ...trip.assignments };
          nextAss[res.dateKey] = { ...res.assignment };
          scheduleAssignmentsSave(trip.id, nextAss);
          const prefBase =
            trip.preferences && typeof trip.preferences === "object"
              ? { ...trip.preferences }
              : {};
          return {
            ...trip,
            assignments: nextAss,
            preferences: {
              ...prefBase,
              day_notes: mergedNotesForServer,
            },
            updated_at: new Date().toISOString(),
            previous_assignments_snapshot: null,
            previous_preferences_snapshot: null,
            previous_assignments_snapshot_at: null,
          };
        }),
      );

      void (async () => {
        const r = await updateTripPreferencesPatchAction({
          tripId: activeTripId,
          patch: { day_notes: mergedNotesForServer },
        });
        if (!r.ok) showToast(r.error);
      })();

      const label = new Date(`${res.dateKey}T12:00:00`).toLocaleDateString(
        "en-GB",
        { weekday: "short", day: "numeric", month: "short" },
      );
      showToast(`Trip filled ${label} with a surprise plan! 🎲`);
    },
    [activeTripId, trips, parks, scheduleAssignmentsSave],
  );

  const openDayDetail = useCallback(
    (dateKey: string, options?: { focusNotes?: boolean }) => {
      if (!tripRouteBase || !activeTripId) return;
      const el = mainScrollRef.current;
      if (el) {
        sessionStorage.setItem(
          `trip-${activeTripId}-scroll`,
          String(el.scrollTop),
        );
      }
      const daySeg = formatDateISO(parseDate(dateKey));
      startTransition(() => {
        router.push(
          `${tripRouteBase}/day/${daySeg}${options?.focusNotes ? "#day-notes" : ""}`,
        );
      });
    },
    [tripRouteBase, activeTripId, router],
  );

  const closeDayDetail = useCallback(() => {
    startTransition(() => router.push(overviewHref, { scroll: false }));
  }, [router, overviewHref]);

  const showGoToTodayPill = useMemo(() => {
    if (!activeTrip || dayDetailOpen || plannerTab !== "planner") return false;
    const keys = eachDateKeyInRange(activeTrip.start_date, activeTrip.end_date);
    const today = formatDateKey(new Date());
    return smartLanding.inWindow && keys.includes(today) && !isTodayVisibleInViewport;
  }, [activeTrip, dayDetailOpen, plannerTab, smartLanding.inWindow, isTodayVisibleInViewport]);

  const rideCountsByDayForActiveTrip = useMemo(
    () =>
      activeTripId && ridePriorityCountByTripAndDay[activeTripId]
        ? ridePriorityCountByTripAndDay[activeTripId]!
        : {},
    [activeTripId, ridePriorityCountByTripAndDay],
  );

  const dayConflictDotsForActiveTrip = useMemo(() => {
    const m: Record<string, "amber" | "grey"> = {};
    if (!activeTrip) return m;
    const parkById = new Map(calendarParks.map((p) => [p.id, p]));
    for (const key of eachDateKeyInRange(
      activeTrip.start_date,
      activeTrip.end_date,
    )) {
      const pris = ridePrioritiesByDayForActiveTrip[key] ?? [];
      const counts = rideCountsByDayForActiveTrip[key];
      const dot = conflictDotForDay(
        computePlannerDayConflicts(
          activeTrip,
          key,
          pris,
          counts,
          parkById,
        ),
      );
      if (dot) m[key] = dot;
    }
    return m;
  }, [
    activeTrip,
    calendarParks,
    ridePrioritiesByDayForActiveTrip,
    rideCountsByDayForActiveTrip,
  ]);

  useEffect(() => {
    if (!activeTripId || !activeTrip) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await getConflictDotSummaryForTrip(activeTripId);
        if (cancelled) return;
        setCalendarConflictDotSummary(s);
        setCalendarConflictDotsSource("server");
      } catch {
        if (!cancelled) setCalendarConflictDotsSource("client");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeTrip,
    activeTripId,
    activeTrip?.assignments,
    activeTrip?.start_date,
    activeTrip?.end_date,
    ridePrioritiesForActiveTrip,
  ]);

  const calendarConflictDotsForCalendar = useMemo(() => {
    if (calendarConflictDotsSource === "server" && activeTrip) {
      const m: Record<string, "amber" | "grey"> = {};
      for (const key of eachDateKeyInRange(
        activeTrip.start_date,
        activeTrip.end_date,
      )) {
        const s = calendarConflictDotSummary[key];
        if (!s) continue;
        m[key] = s.hasAmber ? "amber" : "grey";
      }
      return m;
    }
    return dayConflictDotsForActiveTrip;
  }, [
    calendarConflictDotsSource,
    calendarConflictDotSummary,
    activeTrip,
    dayConflictDotsForActiveTrip,
  ]);

  const onSaveDayNote = useCallback(
    async (dateKey: string, text: string) => {
      if (!activeTripId) return;
      const t = trips.find((x) => x.id === activeTripId);
      if (!t) return;
      const raw = t.preferences?.day_notes;
      const base =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? { ...(raw as Record<string, string>) }
          : {};
      const mergedNotes = { ...base, [dateKey]: text };
      const prefsBase =
        t.preferences &&
        typeof t.preferences === "object" &&
        !Array.isArray(t.preferences)
          ? { ...t.preferences }
          : {};
      applyLocalPatch(activeTripId, {
        preferences: {
          ...prefsBase,
          day_notes: mergedNotes,
        },
      });
      const res = await updateTripPreferencesPatchAction({
        tripId: activeTripId,
        patch: { day_notes: mergedNotes },
      });
      if (!res.ok) {
        showToast(res.error);
        startTransition(() => router.refresh());
      }
    },
    [activeTripId, trips, applyLocalPatch, router],
  );

  const confirmUndoSmartPlan = useCallback(async () => {
    if (!activeTripId) return;
    setSmartPlanUndoOpen(false);
    const res = await undoSmartPlanAction(activeTripId);
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast("Smart Plan undone — your previous trip is restored");
    startTransition(() => router.refresh());
  }, [activeTripId, router]);

  const wizardInitial = (): Partial<Trip> => {
    if (wizardEditId) {
      const t = trips.find((x) => x.id === wizardEditId);
      return t ?? {};
    }
    return {};
  };

  const savingVisible = isSaving || isPending;
  const showPlannerShell = plannerTab === "planner";

  const openCompareDays = useCallback(() => {
    setCompareMode(true);
    if (plannerTab !== "planner") {
      startTransition(() => {
        router.replace(tripRouteBase ?? "/planner");
      });
    }
  }, [plannerTab, router, tripRouteBase]);

  return (
    <InlineLoadingOverlay
      isLoading={fullPageAiBusy}
      label="Smart Plan is building your itinerary"
    >
    <div
      className="min-h-screen bg-transparent pb-28 pt-2 lg:pb-16"
      style={shellThemeStyle}
    >
      <AppNavHeader
        userEmail={userEmail}
        userTier={userTier}
        tripCount={trips.length}
        freeTripLimit={1}
        planBadgeLabel={productPlanLabel}
        activeTripCap={maxActiveTripCap}
        showUpgradeNavCta={productTier === "free"}
        stripeCustomerId={stripeCustomerId}
      />

      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-2 sm:px-6 lg:px-8">
        <PlannerTopNotices
          hasTrip={trips.length > 0}
          hasAnyAssignment={hasAnyAssignment}
        />
      </div>

      {activeTrip ? (
        <main
          ref={mainScrollRef}
          className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8"
        >
          <header className="border-b border-royal/10 pb-5">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <h1 className="min-w-0 flex-1 text-balance font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
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
                    className="inline-block min-w-[4ch] text-royal"
                  />
                  <span className="text-royal/40"> — </span>
                  <span className="inline-flex max-w-full flex-wrap items-baseline gap-1.5 sm:gap-2">
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
                      style={{
                        color: resolvedAdventureTitleColor(
                          activeTrip.preferences,
                        ),
                      }}
                    />
                    <AdventureTitleColorControl
                      preferences={activeTrip.preferences}
                      onColorChange={(next) => {
                        const prev =
                          activeTrip.preferences &&
                          typeof activeTrip.preferences === "object" &&
                          !Array.isArray(activeTrip.preferences)
                            ? ({
                                ...activeTrip.preferences,
                              } as Record<string, unknown>)
                            : ({} as Record<string, unknown>);
                        applyLocalPatch(activeTrip.id, {
                          preferences: {
                            ...prev,
                            [ADVENTURE_TITLE_COLOR_KEY]: next,
                          },
                        });
                        void withSaving(async () => {
                          setSaveError(null);
                          const res = await updateTripPreferencesPatchAction({
                            tripId: activeTrip.id,
                            patch: {
                              [ADVENTURE_TITLE_COLOR_KEY]: next,
                            },
                          });
                          if (!res.ok) setSaveError(res.error);
                        });
                      }}
                    />
                  </span>
                </h1>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {showGoToTodayPill ? (
                    <button
                      type="button"
                      className="min-h-11 rounded-full border border-gold/40 bg-gold/90 px-3 font-serif text-xs font-semibold text-royal shadow-sm transition hover:bg-gold"
                      onClick={() => {
                        const todayKey = formatDateKey(new Date());
                        const el = document.getElementById(
                          `planner-day-${todayKey}`,
                        );
                        el?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        setGoToTodayRingDateKey(todayKey);
                        window.setTimeout(() => setGoToTodayRingDateKey(null), 1000);
                      }}
                    >
                      Go to today →
                    </button>
                  ) : null}
                  <PlannerMoreMenu
                    onOpenPanel={(panel) => {
                      setAdminPanel(panel);
                    }}
                  />
                  <SavingIndicator
                    isSaving={savingVisible}
                    lastSavedAt={lastSavedAt}
                  />
                </div>
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
                const tabQ =
                  plannerTab !== "planner" ? `?tab=${plannerTab}` : "";
                if (tripRouteBase) {
                  router.push(`/trip/${id}${tabQ}`);
                }
              }}
              onNew={() => {
                if (shouldBlockNewTripWizard(trips.length, maxActiveTripCap)) {
                  setTierLimitVariant("trips");
                  setTierLimitReason(
                    maxActiveTripCap === 1
                      ? "Free includes one active trip. Upgrade to Pro or Family on Pricing for more."
                      : `Your plan allows ${maxActiveTripCap} active trips. Archive one or upgrade on Pricing.`,
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
            className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-royal/15 bg-gradient-to-br from-white/40 via-white/30 to-white/25 px-3 py-3 shadow-sm ring-1 ring-gold/20 backdrop-blur-md"
            aria-label="Trip actions"
          >
            <button
              type="button"
              onClick={() => {
                setWizardEditId(activeTripId);
                setWizardFirstRun(false);
                setWizardOpen(true);
              }}
              className="rounded-lg bg-royalSoft px-4 py-2.5 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-royalSoft/90"
            >
              Edit trip
            </button>
            <button
              type="button"
              onClick={() => {
                setSmartError(null);
                setSmartOpen(true);
              }}
              className="rounded-lg border-2 border-royalSoft/40 bg-royalSoft px-4 py-2.5 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-royalSoft/90"
            >
              Smart Plan ✨
            </button>
            <PdfExportButton
              tripId={activeTripId}
              disabled={!activeTripId}
              buttonId="planner-pdf-export-btn"
              onAchievementKeys={(keys) => enqueueAchievementKeys(keys)}
            />
            <button
              type="button"
              className="inline-flex cursor-pointer select-none rounded-lg border border-royalSoft/25 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-ink shadow-sm transition hover:border-gold/35 hover:bg-cream"
              onClick={openCompareDays}
            >
              Compare days
            </button>
            {activeTrip.previous_assignments_snapshot_at ? (
              <button
                type="button"
                onClick={() => setSmartPlanUndoOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-gold/40 px-4 py-2.5 font-sans text-sm font-medium text-royal/80 shadow-sm transition hover:bg-cream active:bg-cream/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                aria-label="Undo last Smart Plan generation"
                title={`Undo Smart Plan from ${formatUndoSnapshotHint(activeTrip.previous_assignments_snapshot_at)}`}
              >
                <span aria-hidden>↶</span>
                Undo Smart Plan
              </button>
            ) : null}
            <PlannerActionsMenu
              onCompareDays={openCompareDays}
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
                applyLocalPatch(activeTripId, {
                  assignments: {},
                  previous_assignments_snapshot: null,
                  previous_preferences_snapshot: null,
                  previous_assignments_snapshot_at: null,
                });
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
              cruiseSection={
                activeTrip ? (
                  <div className="px-3 py-2">
                    <p className="font-sans text-xs font-semibold text-royal/70">
                      Cruise segment
                    </p>
                    <label className="mt-2 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-royal/15 bg-white px-3 py-2">
                      <span className="font-sans text-sm text-royal">
                        Show cruise &amp; ship tiles in the drawer
                      </span>
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border-royal/35 accent-royal"
                        checked={activeTrip.has_cruise}
                        onChange={(e) =>
                          void handleTripIncludesCruiseChange(e.target.checked)
                        }
                        aria-label="Show cruise and ship tiles in the parks drawer"
                      />
                    </label>
                  </div>
                ) : null
              }
              colourSection={
                activeTrip ? (
                  <div className="px-2 pb-2 pt-2">
                    <p className="px-2 font-sans text-xs font-semibold text-royal/70">
                      Colour theme
                    </p>
                    <div className="mt-2 px-1">
                      <TripThemePicker
                        layout="row"
                        value={activeTrip.colour_theme}
                        onChange={(key) => void handleColourThemeChange(key)}
                      />
                    </div>
                  </div>
                ) : null
              }
              remindersSection={
                activeTrip ? (
                  <div className="px-3 py-2">
                    <p className="font-sans text-xs font-semibold text-royal/70">
                      Email reminders
                    </p>
                    <label className="mt-2 flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-royal/15 bg-white px-3 py-2">
                      <span className="font-sans text-sm text-royal">
                        Send me email reminders for this trip
                      </span>
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border-royal/35 accent-royal"
                        checked={activeTrip.email_reminders !== false}
                        disabled={emailMarketingOptOut}
                        onChange={(e) =>
                          void handleTripEmailReminders(e.target.checked)
                        }
                        aria-label="Send email reminders for this trip"
                      />
                    </label>
                    {emailMarketingOptOut ? (
                      <p className="mt-2 font-sans text-xs text-royal/60">
                        You&apos;ve opted out of marketing emails in Settings —
                        we won&apos;t send trip reminders.
                      </p>
                    ) : null}
                  </div>
                ) : null
              }
            />
          </section>

          {showPlannerShell &&
          typeof activeTrip.preferences?.ai_crowd_summary === "string" &&
          (activeTrip.preferences.ai_crowd_summary as string).trim() ? (
            <CrowdStrategyBanner
              text={(activeTrip.preferences.ai_crowd_summary as string).trim()}
            />
          ) : null}

          {showPlannerShell ? (
            <div className="mt-3">
              <SkipLineLegend />
            </div>
          ) : null}

          {plannerTab === "planning" ? (
            <PlanningSections
              trip={activeTrip}
              payments={paymentsByTripId[activeTrip.id] ?? []}
              onPaymentsChange={handlePaymentsChange}
              onTripPatch={(patch) => applyLocalPatch(activeTrip.id, patch)}
              initialSection={initialPlanningSection}
            />
          ) : (
            <div
              className={`mt-8 grid items-start gap-6 ${
                compareMode
                  ? ""
                  : "lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8 xl:gap-10"
              }`}
            >
              {!compareMode ? (
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
                    showCruiseTiles={activeTrip.has_cruise}
                    colourTheme={normaliseThemeKey(activeTrip.colour_theme)}
                    selectedParkId={selectedParkId}
                    onSelectPark={setSelectedParkId}
                    onAddCustom={handleAddCustom}
                    onEditCustom={handleEditCustom}
                    onDeleteCustom={handleDeleteCustom}
                  />
                </div>
              ) : null}
              <div className="relative min-w-0 w-full">
                {compareMode ? (
                  <CompareDaysPanel
                    trip={activeTrip}
                    parks={calendarParks}
                    assignments={activeTrip.assignments ?? {}}
                    colourTheme={normaliseThemeKey(activeTrip.colour_theme)}
                    plannerRegionId={resolvePaletteRegionId(activeTrip)}
                    temperatureUnit={temperatureUnit}
                    userDayNotes={mobilePlannerNoteMaps.user}
                    onSaveUserDayNote={onSaveDayNote}
                    onTransferSlot={onTransferSlot}
                    onExit={() => setCompareMode(false)}
                  />
                ) : (
                  <>
                    <TripStatsCard
                      trip={activeTrip}
                      parks={calendarParks}
                      payments={paymentsByTripId[activeTrip.id] ?? []}
                      destinationLabel={activeRegionLabel}
                      onToast={showToast}
                      onViewAllPayments={() => {
                        startTransition(() => {
                          router.push(`${tripRouteBase ?? "/planner"}?tab=payments`);
                        });
                      }}
                    />
                    {!hasAnyAssignment ? (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-3 sm:p-4">
                        <div className="pointer-events-auto w-full max-w-md">
                          <EmptyCalendarCta
                            onGenerateAi={() => {
                              setSmartError(null);
                              setSmartOpen(true);
                            }}
                            onAddManually={() =>
                              showHint(
                                "Pick a park from the list, then tap a day slot to place it.",
                              )
                            }
                            onSurpriseMe={() => handleSurpriseMe(null)}
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="relative min-w-0">
                      <div className="hidden md:block">
                        <Calendar
                          trip={activeTrip}
                          parks={calendarParks}
                          selectedParkId={selectedParkId}
                          onAssign={onAssign}
                          onClear={onClear}
                          onNeedParkFirst={() =>
                            showHint("Pick a park first")
                          }
                          onAfterSlotClear={() => showToast("Slot cleared")}
                          plannerRegionId={resolvePaletteRegionId(activeTrip)}
                          temperatureUnit={temperatureUnit}
                          onSaveDayNote={onSaveDayNote}
                          timelineUnlocked={timelineUnlocked}
                          onSlotTimeChange={onSlotTimeChange}
                          ridePrioritiesByDay={
                            ridePrioritiesByDayForActiveTrip
                          }
                          rideCountsByDay={rideCountsByDayForActiveTrip}
                          dayConflictDots={calendarConflictDotsForCalendar}
                          highlightDateKey={goToTodayRingDateKey}
                          onRideDayPrioritiesUpdated={
                            handleRideDayPrioritiesUpdated
                          }
                          onOpenDayDetail={
                            tripRouteBase ? openDayDetail : undefined
                          }
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
                      ridePrioritiesByDay={ridePrioritiesByDayForActiveTrip}
                      rideCountsByDay={rideCountsByDayForActiveTrip}
                      onRideDayPrioritiesUpdated={
                        handleRideDayPrioritiesUpdated
                      }
                      onOpenDayDetail={
                        tripRouteBase ? openDayDetail : undefined
                      }
                      cataloguedParkIdSet={cataloguedParkIdSet}
                      onGenerateMustDosForPark={runMustDosGen}
                      mustDosGenLoading={mustDosGenLoading}
                      onToggleMustDoDone={handleToggleMustDoDone}
                      onSelectPark={setSelectedParkId}
                      onMenuExportPdf={() =>
                        document.getElementById("planner-pdf-export-btn")?.click()
                      }
                      onMenuShare={handleMobileMenuShare}
                      onMenuSettings={() => undefined}
                      smartPlanUndoSnapshotAt={
                        activeTrip.previous_assignments_snapshot_at ?? null
                      }
                      onMenuUndoSmartPlan={() => setSmartPlanUndoOpen(true)}
                      plannerRegionId={resolvePaletteRegionId(activeTrip)}
                      temperatureUnit={temperatureUnit}
                      onSaveUserDayNote={onSaveDayNote}
                      timelineUnlocked={timelineUnlocked}
                      onSlotTimeChange={onSlotTimeChange}
                    />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      ) : (
        <main className="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <TrippMascotImg
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
            />
            <TrippSpeechBubble maxWidthClass="max-w-md">
              Ready when you are — no pressure, just possibilities. 🗺️
            </TrippSpeechBubble>
          </div>
          <h2 className="mt-8 font-serif text-2xl font-semibold tracking-tight text-royal sm:text-3xl">
            Your planner is ready
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-royal/80 sm:text-base">
            Start your first TripTiles adventure. We&apos;ll help you plan a
            theme park trip your family will actually follow.
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setWizardFirstRun(true);
                setWizardOpen(true);
              }}
              className="min-h-11 w-full min-w-0 flex-1 rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-5 py-2.5 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 sm:min-h-[44px] sm:max-w-xs"
            >
              Plan my trip in minutes
            </button>
            <button
              type="button"
              disabled={blankTripBusy}
              onClick={() => void startBlankTrip()}
              className="min-h-11 w-full min-w-0 flex-1 rounded-lg border-2 border-royal/25 bg-white px-5 py-2.5 font-sans text-base font-semibold text-royal transition hover:border-royal/40 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[44px] sm:max-w-xs"
            >
              {blankTripBusy ? "Starting…" : "Start from scratch"}
            </button>
          </div>
          <p className="mt-8 font-sans text-sm text-royal/65">
            Or browse plans from other families to get inspired.
          </p>
          <p className="mt-2">
            <Link
              href="/plans"
              className="inline-flex min-h-11 min-w-[44px] items-center justify-center font-sans text-sm font-semibold text-royal underline decoration-gold/50 underline-offset-2 transition hover:text-gold"
            >
              Browse plans
            </Link>
          </p>
        </main>
      )}

      {wizardOpen && !wizardEditId ? (
        <div className="fixed inset-0 z-[88] overflow-y-auto bg-royal/50 backdrop-blur-[2px]">
          <TripCreationWizard
            regions={regions}
            parks={parks}
            includeWelcome={false}
            variant="modal"
            onTripTierLimit={() => {
              setTierLimitVariant("trips");
              setTierLimitReason(
                maxActiveTripCap === 1
                  ? "Free includes one active trip. Upgrade to Pro or Family on Pricing for more."
                  : `Your plan allows ${maxActiveTripCap} active trips. Archive one or upgrade on Pricing.`,
              );
              setTierLimitOpen(true);
            }}
            onTripCreated={() => {
              setWizardOpen(false);
              setWizardFirstRun(false);
            }}
            onCancel={() => {
              setWizardOpen(false);
              setWizardFirstRun(false);
            }}
          />
        </div>
      ) : null}

      {wizardOpen && wizardEditId ? (
        <Wizard
          isOpen
          isFirstRun={wizardFirstRun}
          regions={regions}
          initialData={wizardInitial()}
          onClose={() => {
            setWizardOpen(false);
            setWizardEditId(null);
          }}
          onComplete={async (data) => {
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
          }}
        />
      ) : null}

      {activeTrip ? (
        <MobilePlannerDock
          trip={activeTrip}
          selectedParkId={selectedParkId}
          onAssign={onAssign}
          onNeedParkFirst={() => showHint("Pick a park first")}
        />
      ) : null}

      {smartPlanUndoOpen && activeTrip?.previous_assignments_snapshot_at ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-royal/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="undo-smart-plan-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-cream p-6 shadow-xl">
            <h2
              id="undo-smart-plan-title"
              className="font-display text-lg font-semibold text-royal"
            >
              Undo Smart Plan?
            </h2>
            <p className="mt-3 font-sans text-sm text-royal/80">
              This will restore your trip to the state it was in before the
              last Smart Plan generation. Any Smart Plan suggestions will be
              removed.
              This cannot be undone.
            </p>
            <p className="mt-2 font-sans text-xs text-royal/60">
              Snapshot:{" "}
              {formatUndoSnapshotHint(
                activeTrip.previous_assignments_snapshot_at,
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gold/40 px-4 py-2 font-sans text-sm font-medium text-royal/80 hover:bg-white"
                onClick={() => setSmartPlanUndoOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-royal px-4 py-2 font-sans text-sm font-medium text-cream hover:bg-royal/90"
                onClick={() => void confirmUndoSmartPlan()}
              >
                Yes, undo it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SmartPlanModal
        isOpen={smartOpen}
        onClose={() => {
          setSmartOpen(false);
          setSmartError(null);
          setSmartCanRetryPartial(false);
          setSmartRetryPayload(null);
        }}
        trip={activeTrip}
        parks={smartPlanParks}
        regionLabel={regionLabel}
        generationsUsedThisTrip={aiGenByTrip[activeTripId] ?? 0}
        showFreeTierNote={isFreeTierForTripLimit(productTier)}
        isGenerating={isAiGenerating}
        submitError={smartError}
        scope={dayDetailOpen && dayCanonicalForDetail ? "day" : "trip"}
        dayDateKey={dayDetailOpen ? dayCanonicalForDetail : null}
        dayHasAiTimeline={Boolean(
          dayDetailOpen &&
            dayCanonicalForDetail &&
            activeTrip &&
            (() => {
              const m = activeTrip.preferences?.ai_day_timeline;
              if (!m || typeof m !== "object" || Array.isArray(m)) {
                return false;
              }
              return Boolean(
                (m as Record<string, unknown>)[dayCanonicalForDetail!],
              );
            })(),
        )}
        ridePrioritiesForDay={
          dayDetailOpen && dayCanonicalForDetail
            ? (ridePrioritiesByDayForActiveTrip[dayCanonicalForDetail] ?? [])
            : []
        }
        canRetryPartial={smartCanRetryPartial}
        onRetryPartial={() => {
          if (!smartRetryPayload || isAiGenerating) return;
          void handleSmartPlanGenerate(smartRetryPayload);
        }}
        onGenerate={handleSmartPlanGenerate}
        onTripPatch={(patch) => {
          if (!activeTripId) return;
          applyLocalPatch(activeTripId, patch);
        }}
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
          showFreeTierTileCounter={isFreeTierForTripLimit(productTier)}
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

      {adminPanel && activeTrip ? (
        <div
          className="fixed inset-0 z-[103] flex items-center justify-center bg-royal/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planner-admin-panel-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default border-0 bg-transparent"
            aria-label="Close"
            onClick={() => setAdminPanel(null)}
          />
          <div className="relative z-10 max-h-[min(90vh,800px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gold/30 bg-cream p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2
                id="planner-admin-panel-title"
                className="font-display text-lg font-semibold text-royal"
              >
                {adminPanel === "share"
                  ? "Community sharing"
                  : adminPanel === "family"
                    ? "Family members"
                    : "Day notes (all days)"}
              </h2>
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-royal/15 bg-white text-lg text-royal transition hover:bg-cream"
                aria-label="Close"
                onClick={() => setAdminPanel(null)}
              >
                ✕
              </button>
            </div>
            {adminPanel === "share" ? (
              <ShareTripPanel
                tripId={activeTrip.id}
                trip={activeTrip}
                isPublic={activeTrip.is_public}
                publicSlug={activeTrip.public_slug}
                siteUrl={siteUrl}
                cloneCount={activeTrip.clone_count ?? 0}
                viewCount={activeTrip.view_count ?? 0}
              />
            ) : adminPanel === "family" ? (
              <FamilyInvitePanel
                tripId={activeTrip.id}
                userTier={userTier}
              />
            ) : (
              <DayNotesPanel trip={activeTrip} tripId={activeTrip.id} />
            )}
          </div>
        </div>
      ) : null}

      {dayDetailOpen &&
      activeTrip &&
      dayCanonicalForDetail &&
      tripRouteBase ? (
        <DayDetailLayer
          trip={activeTrip}
          dayDate={dayCanonicalForDetail}
          tripBasePath={tripRouteBase}
          parks={calendarParks}
          cataloguedParkIdSet={cataloguedParkIdSet}
          ridePriorities={
            ridePrioritiesByDayForActiveTrip[dayCanonicalForDetail] ?? []
          }
          productTier={productTier}
          plannerRegionId={resolvePaletteRegionId(activeTrip)}
          temperatureUnit={temperatureUnit}
          onClose={closeDayDetail}
          onPrioritiesUpdated={(items) =>
            handleRideDayPrioritiesUpdated(dayCanonicalForDetail, items)
          }
          onSaveDayNote={onSaveDayNote}
          onOpenSmartPlan={() => setSmartOpen(true)}
          onGenerateMustDosForPark={(parkId) => {
            void runMustDosGen(dayCanonicalForDetail, parkId);
          }}
          generatingMustDosParkId={
            mustDosGenLoading?.dateKey === dayCanonicalForDetail
              ? mustDosGenLoading.parkId
              : null
          }
          onToggleMustDoDone={(parkId, mustDoId, next) => {
            void handleToggleMustDoDone(
              dayCanonicalForDetail,
              parkId,
              mustDoId,
              next,
            );
          }}
          rideCountsForDay={
            dayCanonicalForDetail
              ? (rideCountsByDayForActiveTrip[dayCanonicalForDetail] ?? null)
              : null
          }
          onTripPatch={(patch) => applyLocalPatch(activeTrip.id, patch)}
          ridePrioritiesByDayForTrip={ridePrioritiesByDayForActiveTrip}
        />
      ) : null}

      <BookingConflictModal
        open={plannerSlotBooking != null}
        dayDate={plannerSlotBooking?.dayDate ?? ""}
        action={plannerSlotBooking?.action ?? "park-change"}
        anchors={plannerSlotBooking?.anchors ?? []}
        newParkName={plannerSlotBooking?.newParkName}
        onKeepBooking={() => setPlannerSlotBooking(null)}
        onDismiss={() => setPlannerSlotBooking(null)}
        onProceedKeepBooking={() => {
          const b = plannerSlotBooking;
          if (!b) return;
          setPlannerSlotBooking(null);
          if (b.pending.kind === "assign") {
            applySlotAssign(b.pending.dateKey, b.pending.slot, b.pending.parkId);
          } else {
            applySlotClear(b.pending.dateKey, b.pending.slot);
          }
        }}
        onProceedClearBooking={() => {
          const b = plannerSlotBooking;
          if (!b || !activeTripId) return;
          setPlannerSlotBooking(null);
          void (async () => {
            for (const a of b.anchors) {
              await updateRidePriorityMeta(
                activeTripId,
                a.attractionId,
                b.dayDate,
                { skipLineReturnHhmm: null },
              );
            }
            patchClearSkipLineReturnsOnDay(
              b.dayDate,
              b.anchors.map((x) => x.attractionId),
            );
            if (b.pending.kind === "assign") {
              applySlotAssign(
                b.pending.dateKey,
                b.pending.slot,
                b.pending.parkId,
              );
            } else {
              applySlotClear(b.pending.dateKey, b.pending.slot);
            }
          })();
        }}
      />

      {surpriseUndo ? (
        <div className="fixed bottom-24 left-1/2 z-[92] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-2xl border border-royal/15 bg-white px-4 py-3 shadow-xl safe-area-inset-bottom">
          <span className="text-center font-sans text-sm text-royal">
            Undo surprise fill?
          </span>
          <button
            type="button"
            onClick={undoSurpriseFill}
            className="min-h-11 rounded-lg bg-royal px-5 font-sans text-sm font-semibold text-cream transition hover:bg-royal/90"
          >
            Undo
          </button>
        </div>
      ) : null}

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

    </div>
    </InlineLoadingOverlay>
  );
}
