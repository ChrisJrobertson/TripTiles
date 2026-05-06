"use client";

import {
  assignmentWithUpdatedSlotTime,
  countFilledSlots,
  getParkIdFromSlotValue,
} from "@/lib/assignment-slots";
import {
  generateAIPlanAction,
  generateDayStrategy,
  generateDayTimeline,
  generateMustDosForPark,
  popDaySnapshot,
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
import { Button } from "@/components/ui/Button";
import { InlineLoadingOverlay } from "@/components/ui/InlineLoadingOverlay";
import { ModalShell } from "@/components/ui/ModalShell";
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
import { DayStrategyUpgradeModal } from "@/components/planner/DayStrategyUpgradeModal";
import { MobileTripCalendarStripNav } from "@/components/planner/MobileTripCalendarStripNav";
import { MobileDayView } from "@/components/planner/MobileDayView";
import { PlanningSections } from "@/components/planner/PlanningSections";
import { CustomTileModal } from "@/components/planner/CustomTileModal";
import { TripDayPageView } from "@/components/planner/TripDayPageView";
import { DayPlannerModal } from "@/components/planner/DayPlannerModal";
import { DayNotesPanel } from "@/components/planner/DayNotesPanel";
import { AdventureTitleColorControl } from "@/components/planner/AdventureTitleColorControl";
import { EditableTitle } from "@/components/planner/EditableTitle";
import { MobilePlannerDock } from "@/components/planner/MobilePlannerDock";
import { Palette } from "@/components/planner/Palette";
import { PlannerHeroStats } from "@/components/planner/PlannerHeroStats";
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
import { BookTripAffiliatePanel } from "@/components/planner/BookTripAffiliatePanel";
import { hasAnyAffiliatePartner } from "@/lib/affiliates";
import { PdfExportButton } from "@/components/planner/PdfExportButton";
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
  MONTHS_SHORT,
  parseDate,
} from "@/lib/date-helpers";
import {
  buildTripStatsShareText,
  computeTripStats,
} from "@/lib/compute-trip-stats";
import { buildPlannerKeyDateRowsSorted } from "@/components/planning/KeyDatesPanel";
import {
  heuristicCrowdToneFromNoteText,
  type CrowdLevel,
} from "@/lib/planner-crowd-level-meta";
import { crowdLevelFromHeuristicTone } from "@/components/planner/CrowdLevelIndicator";
import { PlannerDayTimelineStub } from "@/components/planner/PlannerDayTimelineStub";
import { PlannerPlanningDeck } from "@/components/planner/PlannerPlanningDeck";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { dayConditionRow } from "@/lib/planner-day-conditions";
import { daysUntilTripStart, tripStartValueLabel } from "@/lib/trip-start-label";
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
import { APP_PLANNER_VERSION } from "@/lib/planner-version";
import {
  notifyStaleServerActionIfNeeded,
  showToast,
} from "@/lib/toast";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import type {
  AchievementDefinition,
  AIDayStrategy,
  Assignment,
  Assignments,
  CustomTile,
  DayPlanningIntent,
  Park,
  Region,
  SlotType,
  TemperatureUnit,
  Trip,
  TripPlanningPreferences,
  UserTier,
} from "@/lib/types";
import { customTileToPark } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import type { TripPayment } from "@/types/payments";
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

const SHOW_BOOKING_AFFILIATE_PANEL = false;

function formatSavedBrief(at: Date | null): string {
  if (!at) return "";
  const sec = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000));
  if (sec < 10) return "just now";
  if (sec < 120) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 120) return `${m} min ago`;
  return at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayCrowdNoteForDate(trip: Trip, dateKey: string): string | null {
  const raw = plannerAiDayCrowdNotes(trip)[dateKey]?.trim();
  if (!raw) return null;
  return sanitizeDayNote(raw);
}

function formatTripHeroDateRange(startIso: string, endIso: string): string {
  const a = parseDate(startIso);
  const b = parseDate(endIso);
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  }
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
  const right = `${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  return sameYear ? `${left} – ${right}` : `${left} ${a.getFullYear()} – ${right}`;
}

function plannerPartyLabel(trip: Trip): string {
  const bits: string[] = [];
  if (trip.adults > 0) {
    bits.push(`${trip.adults} adult${trip.adults === 1 ? "" : "s"}`);
  }
  if (trip.children > 0) {
    bits.push(`${trip.children} child${trip.children === 1 ? "" : "ren"}`);
  }
  return bits.length ? bits.join(", ") : "Party size not set";
}

function tripPlannerStatusMeta(trip: Trip): {
  label: string;
  dotClass: string;
} {
  const end = parseDate(trip.end_date);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  if (startOfToday.getTime() > end.getTime()) {
    return { label: "Past trip", dotClass: "bg-tt-ink/40" };
  }
  if (daysUntilTripStart(trip.start_date) > 0) {
    return { label: "Upcoming", dotClass: "bg-sky-500" };
  }
  return { label: "In progress", dotClass: "bg-emerald-600" };
}

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
  signal?: AbortSignal;
};

const SMART_PLAN_STREAM_IDLE_TIMEOUT_MS = 30_000;

async function logSmartPlanTimeout(input: GenerateAIPlanInput): Promise<void> {
  try {
    await fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        message: "smart_plan_timeout",
        url: window.location.href,
        userAgent: navigator.userAgent,
        context: {
          prefix: "[AUTO-ERROR] smart_plan_timeout",
          tripId: input.tripId,
          mode: input.mode,
          dateKey: input.dateKey ?? null,
        },
      }),
    });
  } catch {
    // Best-effort observability only.
  }
}

async function streamGeneratePlan(
  input: GenerateAIPlanInput,
  handlers: StreamHandlers,
): Promise<GenerateAIPlanResult> {
  const controller = new AbortController();
  const signal = handlers.signal;
  const abortFromParent = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  // Diagnostic logs use a stable `[smart-plan-client]` prefix to make browser
  // console output easy to scan and to surface in Jam recordings. Logs only —
  // no behaviour changes in this part.
  const startTs = Date.now();
  const logCtx = {
    tripId: input.tripId,
    mode: input.mode,
    hasDateKey: typeof input.dateKey === "string",
  };
  let lastEventTs = startTs;
  const eventCounts: Record<string, number> = {};

  let idleTimer: number | null = null;
  const resetIdleTimer = () => {
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      console.warn("[smart-plan-client] idle-timeout-fired", {
        ...logCtx,
        msSinceLastEvent: Date.now() - lastEventTs,
        eventCounts: { ...eventCounts },
      });
      controller.abort(new DOMException("Smart Plan timed out", "TimeoutError"));
    }, SMART_PLAN_STREAM_IDLE_TIMEOUT_MS);
  };
  resetIdleTimer();

  console.log("[smart-plan-client] fetch-started", logCtx);
  const response = await fetch("/api/ai/generate-plan-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    console.error("[smart-plan-client] fetch-failed", {
      ...logCtx,
      status: response.status,
      hasBody: !!response.body,
    });
    throw new Error("Smart Plan stream failed to start.");
  }

  console.log("[smart-plan-client] fetch-ok", {
    ...logCtx,
    status: response.status,
  });

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
    resetIdleTimer();

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

    lastEventTs = Date.now();
    eventCounts[eventName] = (eventCounts[eventName] ?? 0) + 1;
    // Avoid log spam: only emit per-event log on first occurrence of each kind,
    // plus every event for `started` and `done` (which are the diagnostic ones).
    if (eventCounts[eventName] === 1 || eventName === "done" || eventName === "started") {
      console.log("[smart-plan-client] event-received", {
        ...logCtx,
        eventName,
        count: eventCounts[eventName],
        hasData: payload != null,
        ageMs: lastEventTs - startTs,
      });
    }

    if (eventName === "delta") {
      const text = (payload as { text?: unknown }).text;
      if (typeof text === "string" && text.length > 0) {
        handlers.onDelta(text);
      }
      return;
    }

    if (eventName === "ping") {
      return;
    }

    if (eventName === "done") {
      doneResult = payload as GenerateAIPlanResult;
      console.log("[smart-plan-client] done-received", {
        ...logCtx,
        hasResult: !!doneResult,
        ok: (doneResult as { ok?: boolean })?.ok ?? null,
        totalDurationMs: lastEventTs - startTs,
      });
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log("[smart-plan-client] reader-eof", {
          ...logCtx,
          hasDoneResult: !!doneResult,
          eventCounts: { ...eventCounts },
          totalDurationMs: Date.now() - startTs,
        });
        break;
      }
      resetIdleTimer();
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
      console.error("[smart-plan-client] stream-ended-without-done", {
        ...logCtx,
        eventCounts: { ...eventCounts },
        totalDurationMs: Date.now() - startTs,
      });
      throw new Error("Smart Plan stream ended unexpectedly.");
    }
    return doneResult;
  } catch (error) {
    if (controller.signal.aborted && signal?.aborted) {
      console.log("[smart-plan-client] cancelled-by-parent", {
        ...logCtx,
        msSinceLastEvent: Date.now() - lastEventTs,
      });
      throw new DOMException("Smart Plan cancelled", "AbortError");
    }
    if (controller.signal.aborted) {
      console.warn("[smart-plan-client] cancelled-by-idle-timeout", {
        ...logCtx,
        msSinceLastEvent: Date.now() - lastEventTs,
      });
      await logSmartPlanTimeout(input);
      throw new Error("Smart Plan timed out — try again");
    }
    console.error("[smart-plan-client] stream-error", {
      ...logCtx,
      message: error instanceof Error ? error.message : String(error),
      eventCounts: { ...eventCounts },
    });
    throw error;
  } finally {
    if (idleTimer) window.clearTimeout(idleTimer);
    signal?.removeEventListener("abort", abortFromParent);
    reader.releaseLock();
  }
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
  const [dayPlannerDate, setDayPlannerDate] = useState<string | null>(null);
  const [dayPlannerInitialTab, setDayPlannerInitialTab] = useState<
    "adjust" | "strategy"
  >("adjust");
  /** After save from mini-wizard, DayPlannerModal runs strategy once without a second tap. */
  const [dayPlannerAutoRunStrategy, setDayPlannerAutoRunStrategy] =
    useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [smartCanRetryPartial, setSmartCanRetryPartial] = useState(false);
  const [smartRetryPayload, setSmartRetryPayload] =
    useState<SmartPlanGeneratePayload | null>(null);
  const smartPlanAbortRef = useRef<AbortController | null>(null);
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
  /** Selected day for inline planner timeline (/planner, not routed day panel). */
  const [plannerTimelineDateKey, setPlannerTimelineDateKey] = useState<
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
  const [dayStrategyUpgradeOpen, setDayStrategyUpgradeOpen] = useState(false);
  const [undoDayTweakPrompt, setUndoDayTweakPrompt] = useState<{
    dateKey: string;
    message: string;
  } | null>(null);
  const [undoDayTweakBusy, setUndoDayTweakBusy] = useState(false);
  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;

  useEffect(() => {
    if (!activeTrip?.id) {
      setPlannerTimelineDateKey(null);
      return;
    }
    const todayKey = formatDateKey(new Date());
    const picked =
      todayKey >= activeTrip.start_date && todayKey <= activeTrip.end_date
        ? formatDateISO(parseDate(todayKey))
        : formatDateISO(parseDate(activeTrip.start_date));
    setPlannerTimelineDateKey(picked);
  }, [activeTrip?.id, activeTrip?.start_date, activeTrip?.end_date]);

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

  const applyStrategyPatchForDate = useCallback(
    (dateKey: string, strategy: AIDayStrategy) => {
      if (!activeTripId) return;
      const trip = trips.find((t) => t.id === activeTripId);
      if (!trip) return;
      const prevStrat = trip.preferences?.ai_day_strategy;
      const base =
        typeof prevStrat === "object" &&
        prevStrat !== null &&
        !Array.isArray(prevStrat)
          ? { ...(prevStrat as Record<string, unknown>) }
          : {};
      applyLocalPatch(activeTripId, {
        preferences: {
          ...trip.preferences,
          ai_day_strategy: { ...base, [dateKey]: strategy },
        },
      });
    },
    [activeTripId, trips, applyLocalPatch],
  );

  const runDayStrategyGenerate = useCallback(
    async (
      dateKey: string,
      options?: {
        suppressErrorToast?: boolean;
        /** Opens Plan this day on Strategy tab and runs generate (mini-wizard if needed). */
        openPlannerWithAutoStrategyOnMissingData?: boolean;
      },
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!activeTripId) {
        return { ok: false, error: "No trip selected." };
      }
      if (!trips.some((t) => t.id === activeTripId)) {
        return { ok: false, error: "Trip not found." };
      }

      try {
        const res = await generateDayStrategy({
          tripId: activeTripId,
          date: dateKey,
        });

        if (res.status === "success") {
          applyStrategyPatchForDate(dateKey, res.strategy);
          if (!options?.suppressErrorToast) {
            showToast("AI Day Strategy is ready.");
          }
          startTransition(() => router.refresh());
          return { ok: true };
        }

        if (res.status === "tier_blocked") {
          setDayStrategyUpgradeOpen(true);
          const msg = "AI Day Strategy needs a Pro or Family plan.";
          if (!options?.suppressErrorToast) {
            showToast(msg);
          }
          return { ok: false, error: msg };
        }

        if (res.status === "missing_data") {
          if (options?.openPlannerWithAutoStrategyOnMissingData) {
            setDayPlannerDate(dateKey);
            setDayPlannerInitialTab("strategy");
            setDayPlannerAutoRunStrategy(true);
            return { ok: true };
          }
          const msg = "We still need a few planning details for this day.";
          if (!options?.suppressErrorToast) {
            showToast(msg);
          }
          return { ok: false, error: msg };
        }

        if (res.status === "no_park_assigned") {
          const msg = "Assign a theme park to this day first.";
          if (!options?.suppressErrorToast) {
            showToast(msg);
          }
          return { ok: false, error: msg };
        }

        const err = res.error;
        if (!options?.suppressErrorToast) {
          showToast(err);
        }
        return { ok: false, error: err };
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Something went wrong. Try again.";
        if (!options?.suppressErrorToast) {
          showToast(msg);
        }
        return { ok: false, error: msg };
      }
    },
    [activeTripId, trips, router, applyStrategyPatchForDate],
  );

  const handlePlanPrefsSavedContinueStrategy = useCallback(
    async (prefs: TripPlanningPreferences, intent: DayPlanningIntent) => {
      if (!activeTrip || !dayPlannerDate) {
        return { ok: false, error: "No day selected." };
      }
      const prevPrefs =
        activeTrip.preferences &&
        typeof activeTrip.preferences === "object" &&
        !Array.isArray(activeTrip.preferences)
          ? { ...activeTrip.preferences }
          : {};
      const prevDayIntentMap =
        prevPrefs.ai_day_intent &&
        typeof prevPrefs.ai_day_intent === "object" &&
        !Array.isArray(prevPrefs.ai_day_intent)
          ? ({ ...prevPrefs.ai_day_intent } as Record<string, unknown>)
          : {};
      applyLocalPatch(activeTrip.id, {
        planning_preferences: prefs,
        preferences: {
          ...prevPrefs,
          ai_day_intent: {
            ...prevDayIntentMap,
            [dayPlannerDate]: intent,
          },
        },
      });
      return runDayStrategyGenerate(dayPlannerDate, {
        suppressErrorToast: true,
      });
    },
    [activeTrip, dayPlannerDate, applyLocalPatch, runDayStrategyGenerate],
  );

  const handleRetryStrategyFromMiniWizard = useCallback(async () => {
    if (!dayPlannerDate) {
      return { ok: false, error: "No day selected." };
    }
    return runDayStrategyGenerate(dayPlannerDate, {
      suppressErrorToast: true,
    });
  }, [dayPlannerDate, runDayStrategyGenerate]);

  const handleDayPlannerStrategySuccess = useCallback(
    ({ date, strategy }: { date: string; strategy: AIDayStrategy }) => {
      applyStrategyPatchForDate(date, strategy);
    },
    [applyStrategyPatchForDate],
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
      const generationController = new AbortController();
      smartPlanAbortRef.current?.abort();
      smartPlanAbortRef.current = generationController;
      setSmartError(null);
      setSmartCanRetryPartial(false);
      setSmartRetryPayload(payload);
      setIsAiGenerating(true);
      let sawFirstToken = false;
      // `spinnerClearReason` records why the spinner came down — surfaced via
      // `[smart-plan-client] spinner-cleared` so a hung-spinner reproduction
      // immediately tells us whether the stream completed, errored, or aborted.
      let spinnerClearReason:
        | "done"
        | "abort"
        | "timeout"
        | "error"
        | "stopped-early"
        | "stale-server-action"
        | "tier-limit"
        | "day-error"
        | "smart-error"
        | "unknown" = "unknown";
      try {
        if (payload.planningPreferences != null) {
          const prefRes = await updateTripPlanningPreferencesAction({
            tripId: activeTripId,
            planningPreferences: payload.planningPreferences,
          });
          if (!prefRes.ok) {
            spinnerClearReason = "smart-error";
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
            spinnerClearReason = "day-error";
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
          spinnerClearReason = "done";
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
            signal: generationController.signal,
            onDelta() {
              if (!sawFirstToken) {
                sawFirstToken = true;
              }
            },
          },
        );
        if (generationController.signal.aborted) {
          spinnerClearReason = "abort";
          return;
        }
        if (!res.ok) {
          if (res.error === "SMART_PLAN_TRUNCATED") {
            spinnerClearReason = "smart-error";
            setSmartError(
              res.message ||
                "Your plan was too long to finish in one go. Please try Regenerate.",
            );
            showToast(
              res.message ||
                "Your plan was too long to finish. Try again in a moment.",
            );
            return;
          }
          if (res.stoppedEarly) {
            spinnerClearReason = "stopped-early";
            setSmartCanRetryPartial(true);
            setSmartError(res.message || "Stopped early - retry?");
            return;
          }
          if (res.error === "TIER_AI_DISABLED") {
            spinnerClearReason = "tier-limit";
            setTierLimitVariant("ai");
            setTierLimitReason(
              res.message ||
                "Smart Plan is not included on the Free plan. Upgrade on Pricing.",
            );
            setTierLimitOpen(true);
            return;
          }
          if (res.error === "TIER_LIMIT") {
            spinnerClearReason = "tier-limit";
            setTierLimitVariant("ai");
            setTierLimitReason(
              "Smart Plan is not available on your current plan. See Pricing for Pro or Family.",
            );
            setTierLimitOpen(true);
            return;
          }
          spinnerClearReason = "smart-error";
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
        spinnerClearReason = "done";
        showToast("✨ Plan generated!");
        trackEvent("smart_plan_success", { mode: payload.mode });
        enqueueAchievementKeys(res.newAchievements);
        setSmartOpen(false);
        startTransition(() => router.refresh());
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          spinnerClearReason = "abort";
          return;
        }
        if (sawFirstToken) {
          spinnerClearReason = "stopped-early";
          setSmartCanRetryPartial(true);
          setSmartError("Stopped early — retry?");
          return;
        }
        if (notifyStaleServerActionIfNeeded(e)) {
          spinnerClearReason = "stale-server-action";
          setSmartError(null);
          return;
        }
        spinnerClearReason =
          e instanceof Error && /timed out/i.test(e.message)
            ? "timeout"
            : "error";
        const msg =
          e instanceof Error ? e.message : "Something went wrong. Try again.";
        setSmartError(msg);
        showToast(msg);
      } finally {
        if (smartPlanAbortRef.current === generationController) {
          smartPlanAbortRef.current = null;
        }
        console.log("[smart-plan-client] spinner-cleared", {
          tripId: activeTripId,
          reason: spinnerClearReason,
        });
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

  const cancelSmartPlanGeneration = useCallback(() => {
    smartPlanAbortRef.current?.abort();
    smartPlanAbortRef.current = null;
    setIsAiGenerating(false);
    setSmartOpen(false);
    setSmartError(null);
    setSmartCanRetryPartial(false);
    showToast("Smart Plan cancelled");
  }, []);

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
            day_snapshots: (t.day_snapshots ?? []).filter(
              (snap) => snap.date !== dateKey,
            ),
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
            day_snapshots: (t.day_snapshots ?? []).filter(
              (snap) => snap.date !== dateKey,
            ),
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
            day_snapshots: (t.day_snapshots ?? []).filter(
              (snap) => snap.date !== dateKey,
            ),
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
            day_snapshots: (t.day_snapshots ?? []).filter(
              (snap) => snap.date !== fromDate && snap.date !== toDate,
            ),
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
          day_snapshots: (trip.day_snapshots ?? []).filter(
            (snap) => snap.date !== dateKey,
          ),
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
            day_snapshots: (trip.day_snapshots ?? []).filter(
              (snap) => snap.date !== res.dateKey,
            ),
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
      const daySeg = formatDateISO(parseDate(dateKey));
      setPlannerTimelineDateKey(daySeg);
      if (!tripRouteBase || !activeTripId) return;
      const el = mainScrollRef.current;
      if (el) {
        sessionStorage.setItem(
          `trip-${activeTripId}-scroll`,
          String(el.scrollTop),
        );
      }
      startTransition(() => {
        router.push(
          `${tripRouteBase}/day/${daySeg}${options?.focusNotes ? "#day-notes" : ""}`,
        );
      });
    },
    [tripRouteBase, activeTripId, router],
  );

  const openDayPlanner = useCallback(
    (
      dateKey: string,
      options?: { tab?: "adjust" | "strategy"; autoRunStrategy?: boolean },
    ) => {
      setDayPlannerDate(dateKey);
      setDayPlannerInitialTab(options?.tab ?? "adjust");
      setDayPlannerAutoRunStrategy(options?.autoRunStrategy ?? false);
    },
    [],
  );

  const handleUndoDayTweak = useCallback(
    (dateKey: string) => {
      if (!activeTripId) return;
      const trip = trips.find((t) => t.id === activeTripId);
      const latest = [...(trip?.day_snapshots ?? [])]
        .filter((snap) => snap.date === dateKey)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setUndoDayTweakPrompt({
        dateKey,
        message: latest
          ? `Undo the AI tweak from ${formatUndoSnapshotHint(latest.created_at)}? This restores the day to its previous state.`
          : "Undo the last AI tweak?",
      });
    },
    [activeTripId, trips],
  );

  const confirmUndoDayTweak = useCallback(async () => {
    if (!undoDayTweakPrompt || !activeTripId) return;
    setUndoDayTweakBusy(true);
    try {
      const res = await popDaySnapshot(
        activeTripId,
        undoDayTweakPrompt.dateKey,
      );
      if (!res.restored) {
        showToast(res.error ?? "Nothing to undo.");
        return;
      }
      applyLocalPatch(activeTripId, {
        assignments: res.assignments,
        preferences: res.preferences,
        day_snapshots: res.daySnapshots,
      });
      showToast("Reverted.");
      setUndoDayTweakPrompt(null);
      startTransition(() => router.refresh());
    } finally {
      setUndoDayTweakBusy(false);
    }
  }, [undoDayTweakPrompt, activeTripId, applyLocalPatch, router]);

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

  const crowdSeasonPill = useMemo(() => {
    if (!activeTrip) return null;
    const sd = parseDate(activeTrip.start_date);
    const mon = (MONTHS_SHORT[sd.getMonth()] ?? "").toUpperCase();
    const dc = dayConditionRow(
      resolvePaletteRegionId(activeTrip),
      sd,
      temperatureUnit,
    );
    if (!dc) return mon ? `${mon} · PLAN` : null;
    const tag =
      dc.crowd === "busy" ? "PEAK" : dc.crowd === "moderate" ? "BUSY" : "QUIETER";
    return `${mon} · ${tag}`;
  }, [activeTrip, temperatureUnit]);

  const nextPlannerMilestoneLabel = useMemo(() => {
    if (!activeTrip) return null;
    const rows = buildPlannerKeyDateRowsSorted(activeTrip);
    const today = formatDateKey(new Date());
    const upcoming = rows.find((r) => r.dateKey >= today);
    return upcoming?.label ?? null;
  }, [activeTrip]);

  const heroMetadataLine = useMemo(() => {
    if (!activeTrip) return null;
    const startDiff = daysUntilTripStart(activeTrip.start_date);
    const departs = tripStartValueLabel(startDiff);
    const range = formatTripHeroDateRange(activeTrip.start_date, activeTrip.end_date);
    const dest = activeRegionLabel;
    const party = plannerPartyLabel(activeTrip);
    const next = nextPlannerMilestoneLabel
      ? `Next: ${nextPlannerMilestoneLabel}`
      : "Next: —";
    return `Departs ${departs} · ${next} · ${range} · ${dest} · ${party}`;
  }, [activeTrip, activeRegionLabel, nextPlannerMilestoneLabel]);

  const plannerTimelineWeatherCrowd = useMemo(() => {
    if (!activeTrip || !plannerTimelineDateKey) {
      return { weather: null as string | null, crowd: null as CrowdLevel | null };
    }
    const day = parseDate(plannerTimelineDateKey);
    const dc = dayConditionRow(
      resolvePaletteRegionId(activeTrip),
      day,
      temperatureUnit,
    );
    const weather = dc
      ? `${dc.conditions.weatherEmoji} ${dc.tempLabel}`
      : null;
    const note = dayCrowdNoteForDate(activeTrip, plannerTimelineDateKey);
    const noteTone = heuristicCrowdToneFromNoteText(note);
    const crowd =
      note != null && note.trim() !== "" && noteTone != null
        ? crowdLevelFromHeuristicTone(noteTone)
        : (dc?.crowd ?? null);
    return { weather, crowd };
  }, [activeTrip, plannerTimelineDateKey, temperatureUnit]);

  const smartPlanDayKey =
    dayDetailOpen && dayCanonicalForDetail
      ? dayCanonicalForDetail
      : plannerTab === "planner" && plannerTimelineDateKey
        ? plannerTimelineDateKey
        : null;

  const plannerDayUndoAvailable = useMemo(() => {
    if (!activeTripId || !plannerTimelineDateKey) return false;
    const trip = trips.find((t) => t.id === activeTripId);
    if (!trip?.day_snapshots?.length) return false;
    return trip.day_snapshots.some((s) => s.date === plannerTimelineDateKey);
  }, [activeTripId, plannerTimelineDateKey, trips]);

  const shiftPlannerTimelineDay = useCallback(
    (delta: number) => {
      if (!activeTrip || !plannerTimelineDateKey) return;
      const keys = eachDateKeyInRange(
        activeTrip.start_date,
        activeTrip.end_date,
      );
      const idx = keys.indexOf(plannerTimelineDateKey);
      if (idx < 0) return;
      const next = keys[idx + delta];
      if (!next) return;
      setPlannerTimelineDateKey(next);
    },
    [activeTrip, plannerTimelineDateKey],
  );

  const handleShareTimelineDay = useCallback(() => {
    if (!activeTrip || !plannerTimelineDateKey || !tripRouteBase) return;
    const base = siteUrl.replace(/\/$/, "");
    const url = `${base}${tripRouteBase}/day/${plannerTimelineDateKey}`;
    void copyTextToClipboard(url);
    showToast("Day link copied");
  }, [activeTrip, plannerTimelineDateKey, tripRouteBase, siteUrl]);

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

  const heroTripStatus = activeTrip ? tripPlannerStatusMeta(activeTrip) : null;

  return (
    <InlineLoadingOverlay
      isLoading={fullPageAiBusy}
      label="Smart Plan is building your itinerary"
    >
    <div
      className="min-h-screen bg-transparent pb-28 pt-2 text-tt-ink lg:pb-16"
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
        <>
        <main
          ref={mainScrollRef}
          className="mx-auto w-full max-w-screen-2xl px-3 py-3 sm:px-5 sm:py-5 lg:px-6"
        >
          <header className="relative overflow-hidden rounded-tt-xl border border-tt-line bg-gradient-to-br from-tt-surface via-tt-surface-warm to-tt-bg-soft px-4 py-4 shadow-tt-md sm:px-5 sm:py-5">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              aria-hidden
              style={{
                backgroundImage:
                  "radial-gradient(circle at 12% 18%, rgba(255,255,255,.95) 0 1px, transparent 1.5px), radial-gradient(circle at 88% 20%, rgba(217,73,26,.22) 0 1px, transparent 1.6px), radial-gradient(circle at 70% 78%, rgba(47,147,222,.2) 0 1.5px, transparent 2px)",
              }}
            />
            <div className="relative flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="font-meta text-[10px] font-semibold uppercase tracking-[0.14em] text-tt-gold/95">
                    Current trip
                    {lastSavedAt ? (
                      <>
                        {" "}
                        <span className="font-normal tracking-normal text-tt-line/55">
                          ·
                        </span>{" "}
                        Auto-saved {formatSavedBrief(lastSavedAt)}
                      </>
                    ) : (
                      <>
                        {" "}
                        <span className="font-normal tracking-normal text-tt-line/55">
                          ·
                        </span>{" "}
                        Auto-save while you edit
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className="mt-2 inline-flex shrink-0 items-center gap-2"
                      title={heroTripStatus?.label}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${heroTripStatus?.dotClass ?? "bg-tt-ink/30"}`}
                        aria-hidden
                      />
                      <span className="sr-only">
                        Trip status: {heroTripStatus?.label ?? "Unknown"}
                      </span>
                    </span>
                    <h1 className="min-w-0 flex-1 text-balance font-heading text-3xl font-semibold tracking-tight text-tt-royal sm:text-4xl">
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
                        className="inline-block min-w-[4ch] text-tt-royal"
                      />
                      <span className="text-tt-royal/35"> — </span>
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
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm text-tt-ink-muted">
                    {heroMetadataLine}
                  </p>
                  <PlannerHeroStats trip={activeTrip} parks={calendarParks} />
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-xs lg:w-64">
                  <label className="block font-meta text-[11px] font-semibold uppercase tracking-wide text-tt-ink-soft">
                    Switch trip
                    <select
                      value={activeTripId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setActiveTripId(id);
                        void touchTripAction(id);
                        const tabQ =
                          plannerTab !== "planner" ? `?tab=${plannerTab}` : "";
                        if (tripRouteBase) {
                          router.push(`/trip/${id}${tabQ}`);
                        }
                      }}
                      className="mt-1.5 min-h-11 w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-sm font-semibold text-tt-royal shadow-tt-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40"
                    >
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.family_name} — {t.adventure_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {showGoToTodayPill ? (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        className="rounded-full"
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
                      </Button>
                    ) : null}
                    <SavingIndicator
                      isSaving={savingVisible}
                      lastSavedAt={lastSavedAt}
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

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
            className="mt-4 flex flex-wrap items-center gap-2 rounded-tt-lg border border-tt-line bg-tt-surface/90 px-3 py-3 shadow-tt-sm backdrop-blur-md"
            aria-label="Trip actions"
          >
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setSmartError(null);
                setSmartOpen(true);
              }}
            >
              Smart Plan ✨
            </Button>
            <PdfExportButton
              tripId={activeTripId}
              disabled={!activeTripId}
              buttonId="planner-pdf-export-btn"
              buttonVariant="accent"
              buttonLabel="Export PDF"
              onAchievementKeys={(keys) => enqueueAchievementKeys(keys)}
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={openCompareDays}
            >
              Compare days
            </Button>
            <PlannerActionsMenu
              adminSection={(close) => (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      setAdminPanel("share");
                      close();
                    }}
                  >
                    Share trip
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      setAdminPanel("family");
                      close();
                    }}
                  >
                    Family members
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      setAdminPanel("notes");
                      close();
                    }}
                  >
                    Day notes (all days)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      setWizardEditId(activeTripId);
                      setWizardFirstRun(false);
                      setWizardOpen(true);
                      close();
                    }}
                  >
                    Edit trip
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      if (shouldBlockNewTripWizard(trips.length, maxActiveTripCap)) {
                        setTierLimitVariant("trips");
                        setTierLimitReason(
                          maxActiveTripCap === 1
                            ? "Free includes one active trip. Upgrade to Pro or Family on Pricing for more."
                            : `Your plan allows ${maxActiveTripCap} active trips. Archive one or upgrade on Pricing.`,
                        );
                        setTierLimitOpen(true);
                        close();
                        return;
                      }
                      setWizardEditId(null);
                      setWizardFirstRun(false);
                      setWizardOpen(true);
                      close();
                    }}
                  >
                    + New trip
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      setWizardEditId(activeTripId);
                      setWizardFirstRun(false);
                      setWizardOpen(true);
                      close();
                    }}
                  >
                    Rename in wizard
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={trips.length <= 1}
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => {
                      if (trips.length <= 1) return;
                      if (!confirm("Are you sure? This can't be undone.")) return;
                      clearAssignTimer();
                      const idToDelete = activeTripId;
                      close();
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
                  >
                    Delete trip
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      void (async () => {
                        const parkById = new Map(
                          calendarParks.map((p) => [p.id, p]),
                        );
                        const stats = computeTripStats(activeTrip, parkById);
                        const text = buildTripStatsShareText(
                          stats,
                          activeRegionLabel,
                        );
                        try {
                          await copyTextToClipboard(text);
                          showToast("Stats copied — share it with your group!");
                        } catch {
                          showToast("Couldn't copy — try again.");
                        }
                        close();
                      })();
                    }}
                  >
                    Copy stats summary
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                    onClick={() => {
                      startTransition(() => {
                        router.push(`${tripRouteBase ?? "/planner"}?tab=payments`);
                      });
                      close();
                    }}
                  >
                    View payments
                  </button>
                  {activeTrip.previous_assignments_snapshot_at ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-4 py-2.5 text-left font-sans text-sm text-tt-royal transition hover:bg-tt-bg-soft"
                      onClick={() => {
                        setSmartPlanUndoOpen(true);
                        close();
                      }}
                    >
                      Undo Smart Plan
                    </button>
                  ) : null}
                </>
              )}
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
              seasonPill={crowdSeasonPill ?? undefined}
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
                : "lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] lg:gap-5 xl:gap-6"
              }`}
            >
              {!compareMode ? (
                <div className="hidden space-y-3 md:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
                  {SHOW_BOOKING_AFFILIATE_PANEL &&
                  hasAnyAffiliatePartner() ? (
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
                    {!hasAnyAssignment && !dayDetailOpen ? (
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
                    {!dayDetailOpen && activeTrip ? (
                      <>
                        <PlannerDayTimelineStub
                          trip={activeTrip}
                          dateKey={plannerTimelineDateKey}
                          parks={calendarParks}
                          plannerRegionId={resolvePaletteRegionId(activeTrip)}
                          temperatureUnit={temperatureUnit}
                          weatherChip={plannerTimelineWeatherCrowd.weather}
                          crowdLevel={plannerTimelineWeatherCrowd.crowd}
                          undoAiAvailable={plannerDayUndoAvailable}
                          onClearSelection={() =>
                            setPlannerTimelineDateKey(null)
                          }
                          onPrevDay={() => shiftPlannerTimelineDay(-1)}
                          onNextDay={() => shiftPlannerTimelineDay(1)}
                          onPlanThisDay={() => setSmartOpen(true)}
                          onUndoAi={() => {
                            if (plannerTimelineDateKey) {
                              handleUndoDayTweak(plannerTimelineDateKey);
                            }
                          }}
                          onShareDay={
                            tripRouteBase ? handleShareTimelineDay : undefined
                          }
                          onEditDay={() => {
                            if (plannerTimelineDateKey) {
                              openDayPlanner(plannerTimelineDateKey);
                            }
                          }}
                        />
                        <PlannerPlanningDeck
                          trip={activeTrip}
                          payments={paymentsByTripId[activeTrip.id] ?? []}
                          onPaymentsChange={handlePaymentsChange}
                        />
                      </>
                    ) : null}
                    <div className="relative min-w-0">
                      {dayDetailOpen &&
                      tripRouteBase &&
                      dayCanonicalForDetail &&
                      activeTrip ? (
                        <>
                          <TripDayPageView
                            trip={activeTrip}
                            dayDate={dayCanonicalForDetail}
                            tripBasePath={tripRouteBase}
                            parks={calendarParks}
                            cataloguedParkIdSet={cataloguedParkIdSet}
                            ridePriorities={
                              ridePrioritiesByDayForActiveTrip[
                                dayCanonicalForDetail
                              ] ?? []
                            }
                            productTier={productTier}
                            plannerRegionId={resolvePaletteRegionId(activeTrip)}
                            temperatureUnit={temperatureUnit}
                            onClose={closeDayDetail}
                            onPrioritiesUpdated={(items) =>
                              handleRideDayPrioritiesUpdated(
                                dayCanonicalForDetail,
                                items,
                              )
                            }
                            onSaveDayNote={onSaveDayNote}
                            onOpenSmartPlan={() => setSmartOpen(true)}
                            onOpenDayPlanner={(opts) => {
                              openDayPlanner(dayCanonicalForDetail, opts);
                            }}
                            onUndoDayTweak={handleUndoDayTweak}
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
                                ? (rideCountsByDayForActiveTrip[
                                    dayCanonicalForDetail
                                  ] ?? null)
                                : null
                            }
                            onTripPatch={(patch) =>
                              applyLocalPatch(activeTrip.id, patch)
                            }
                            ridePrioritiesByDayForTrip={
                              ridePrioritiesByDayForActiveTrip
                            }
                          />
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
                            ridePrioritiesByDay={
                              ridePrioritiesByDayForActiveTrip
                            }
                            rideCountsByDay={rideCountsByDayForActiveTrip}
                            onRideDayPrioritiesUpdated={
                              handleRideDayPrioritiesUpdated
                            }
                            onOpenDayPlanner={openDayPlanner}
                            onUndoDayTweak={handleUndoDayTweak}
                            cataloguedParkIdSet={cataloguedParkIdSet}
                            onGenerateMustDosForPark={runMustDosGen}
                            mustDosGenLoading={mustDosGenLoading}
                            onToggleMustDoDone={handleToggleMustDoDone}
                            onSelectPark={setSelectedParkId}
                            onMenuExportPdf={() =>
                              document
                                .getElementById("planner-pdf-export-btn")
                                ?.click()
                            }
                            onMenuShare={handleMobileMenuShare}
                            onMenuSettings={() => undefined}
                            smartPlanUndoSnapshotAt={
                              activeTrip.previous_assignments_snapshot_at ?? null
                            }
                            onMenuUndoSmartPlan={() =>
                              setSmartPlanUndoOpen(true)
                            }
                            plannerRegionId={resolvePaletteRegionId(activeTrip)}
                            temperatureUnit={temperatureUnit}
                            onSaveUserDayNote={onSaveDayNote}
                            timelineUnlocked={timelineUnlocked}
                            onSlotTimeChange={onSlotTimeChange}
                            tripRouteBase={tripRouteBase}
                            urlSyncedDayDate={dayCanonicalForDetail}
                          />
                        </>
                      ) : (
                        <>
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
                              timelineSelectedDateKey={plannerTimelineDateKey}
                              onTimelineDaySelect={setPlannerTimelineDateKey}
                              onRideDayPrioritiesUpdated={
                                handleRideDayPrioritiesUpdated
                              }
                              onOpenDayDetail={
                                tripRouteBase ? openDayDetail : undefined
                              }
                            />
                          </div>
                          {tripRouteBase ? (
                            <MobileTripCalendarStripNav
                              trip={activeTrip}
                              tripRouteBase={tripRouteBase}
                              dayNotes={mobilePlannerNoteMaps.ai}
                              userDayNotes={mobilePlannerNoteMaps.user}
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
        {showPlannerShell && !compareMode ? (
          <footer className="mx-auto mt-10 w-full max-w-screen-2xl border-t border-tt-line-soft px-3 py-6 text-center font-meta text-[11px] leading-relaxed text-tt-ink-muted sm:px-5 lg:px-6">
            <p className="text-balance">
              <span className="text-tt-ink-soft">Plan together, stress less.</span>
              {" "}
              <span className="text-tt-line/45" aria-hidden>
                ·
              </span>
              {" "}
              Planner v{APP_PLANNER_VERSION}
              {lastSavedAt ? (
                <>
                  {" "}
                  <span className="text-tt-line/45" aria-hidden>
                    ·
                  </span>
                  {" "}
                  Saved {formatSavedBrief(lastSavedAt)}
                </>
              ) : null}
            </p>
          </footer>
        ) : null}
        </>
      ) : (
        <main className="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <div
              className="mb-4 flex h-24 w-24 items-center justify-center rounded-2xl border border-tt-gold/35 bg-gradient-to-b from-tt-gold-soft/45 to-white text-5xl shadow-tt-sm"
              aria-hidden
            >
              🗺️
            </div>
            <p className="max-w-md font-sans text-sm leading-relaxed text-royal/80">
              Ready when you are — no pressure, just possibilities.
            </p>
          </div>
          <h2 className="mt-8 font-serif text-2xl font-semibold tracking-tight text-royal sm:text-3xl">
            Your planner is ready
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-royal/80 sm:text-base">
            Start your first TripTiles adventure. We&apos;ll help you plan a
            theme park trip your family will actually follow.
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="accent"
              size="lg"
              className="w-full min-w-0 flex-1 font-heading sm:max-w-xs"
              onClick={() => {
                setWizardFirstRun(true);
                setWizardOpen(true);
              }}
            >
              Plan my trip in minutes
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full min-w-0 flex-1 sm:max-w-xs"
              disabled={blankTripBusy}
              loading={blankTripBusy}
              loadingLabel="Starting…"
              onClick={() => void startBlankTrip()}
            >
              Start from scratch
            </Button>
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
        <div className="fixed inset-0 z-[88] overflow-y-auto bg-tt-royal/45 backdrop-blur-[1px]">
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
        <ModalShell
          zClassName="z-[95]"
          overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
          maxWidthClass="max-w-md"
          panelClassName="p-6"
          role="dialog"
          aria-modal={true}
          aria-labelledby="undo-smart-plan-title"
        >
            <h2
              id="undo-smart-plan-title"
              className="font-heading text-lg font-semibold text-tt-royal"
            >
              Undo Smart Plan?
            </h2>
            <p className="mt-3 font-sans text-sm text-tt-royal/80">
              This will restore your trip to the state it was in before the last
              Smart Plan generation. Any Smart Plan suggestions will be removed.
              This cannot be undone.
            </p>
            <p className="mt-2 font-sans text-xs text-tt-royal/60">
              Snapshot:{" "}
              {formatUndoSnapshotHint(
                activeTrip.previous_assignments_snapshot_at,
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-tt-line-soft pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSmartPlanUndoOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void confirmUndoSmartPlan()}
              >
                Yes, undo it
              </Button>
            </div>
        </ModalShell>
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
        scope={smartPlanDayKey ? "day" : "trip"}
        dayDateKey={smartPlanDayKey}
        dayHasAiTimeline={Boolean(
          smartPlanDayKey &&
            activeTrip &&
            (() => {
              const m = activeTrip.preferences?.ai_day_timeline;
              if (!m || typeof m !== "object" || Array.isArray(m)) {
                return false;
              }
              return Boolean(
                (m as Record<string, unknown>)[smartPlanDayKey],
              );
            })(),
        )}
        ridePrioritiesForDay={
          smartPlanDayKey
            ? (ridePrioritiesByDayForActiveTrip[smartPlanDayKey] ?? [])
            : []
        }
        canRetryPartial={smartCanRetryPartial}
        onRetryPartial={() => {
          if (!smartRetryPayload || isAiGenerating) return;
          void handleSmartPlanGenerate(smartRetryPayload);
        }}
        onCancelGeneration={cancelSmartPlanGeneration}
        onGenerate={handleSmartPlanGenerate}
        onTripPatch={(patch) => {
          if (!activeTripId) return;
          applyLocalPatch(activeTripId, patch);
        }}
      />

      {activeTrip && dayDetailOpen && dayPlannerDate ? (
        <DayPlannerModal
          open={true}
          trip={activeTrip}
          date={dayPlannerDate}
          parks={calendarParks}
          productTier={productTier}
          initialTab={dayPlannerInitialTab}
          autoRunStrategy={dayPlannerAutoRunStrategy}
          onClose={() => {
            setDayPlannerDate(null);
            setDayPlannerAutoRunStrategy(false);
          }}
          onAutoRunStrategyConsumed={() => setDayPlannerAutoRunStrategy(false)}
          onApplied={(patch) => {
            applyLocalPatch(activeTrip.id, patch);
            startTransition(() => router.refresh());
          }}
          onTierLimit={(message) => {
            setTierLimitVariant("ai");
            setTierLimitReason(message);
            setTierLimitOpen(true);
          }}
          onPlanPrefsSavedContinueStrategy={handlePlanPrefsSavedContinueStrategy}
          onRetryStrategyFromMiniWizard={handleRetryStrategyFromMiniWizard}
          onStrategySuccess={handleDayPlannerStrategySuccess}
          onRequestStrategyUpgrade={() => setDayStrategyUpgradeOpen(true)}
          onNeedsTripRefresh={() => startTransition(() => router.refresh())}
        />
      ) : null}

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

      <DayStrategyUpgradeModal
        open={dayStrategyUpgradeOpen}
        onClose={() => setDayStrategyUpgradeOpen(false)}
      />

      {undoDayTweakPrompt ? (
        <ModalShell
          zClassName="z-[128]"
          overlayClassName="bg-tt-royal/60 backdrop-blur-[1px]"
          maxWidthClass="max-w-md"
          panelClassName="p-5"
          role="dialog"
          aria-modal={true}
          aria-labelledby="undo-day-tweak-title"
        >
            <h2
              id="undo-day-tweak-title"
              className="font-heading text-lg font-semibold text-tt-royal"
            >
              Undo AI change?
            </h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-tt-royal/85">
              {undoDayTweakPrompt.message}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-tt-line-soft pt-4">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                disabled={undoDayTweakBusy}
                onClick={() => setUndoDayTweakPrompt(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="min-h-11 flex-1"
                disabled={undoDayTweakBusy}
                loading={undoDayTweakBusy}
                loadingLabel="Working…"
                onClick={() => void confirmUndoDayTweak()}
              >
                Undo
              </Button>
            </div>
        </ModalShell>
      ) : null}

      {adminPanel && activeTrip ? (
        <ModalShell
          zClassName="z-[103]"
          overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
          maxWidthClass="max-w-lg"
          panelClassName="max-h-[min(90vh,800px)] overflow-y-auto p-5"
          role="dialog"
          aria-modal={true}
          aria-labelledby="planner-admin-panel-title"
          onClick={(e) => e.target === e.currentTarget && setAdminPanel(null)}
        >
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2
                id="planner-admin-panel-title"
                className="font-heading text-lg font-semibold text-tt-royal"
              >
                {adminPanel === "share"
                  ? "Community sharing"
                  : adminPanel === "family"
                    ? "Family members"
                    : "Day notes (all days)"}
              </h2>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 min-w-11 shrink-0 p-0 text-lg"
                aria-label="Close"
                onClick={() => setAdminPanel(null)}
              >
                ✕
              </Button>
            </div>
            {adminPanel === "share" ? (
              <ShareTripPanel
                tripId={activeTrip.id}
                trip={activeTrip}
                isPublic={activeTrip.is_public}
                publicSlug={activeTrip.public_slug}
                siteUrl={siteUrl}
                canPublishPublic={productTier !== "free"}
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
        </ModalShell>
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
        <div className="fixed bottom-24 left-1/2 z-[92] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-tt-xl border border-tt-line bg-tt-surface-warm px-4 py-3 shadow-tt-md safe-area-inset-bottom">
          <span className="text-center font-sans text-sm text-tt-royal">
            Undo surprise fill?
          </span>
          <Button type="button" variant="primary" onClick={undoSurpriseFill}>
            Undo
          </Button>
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
