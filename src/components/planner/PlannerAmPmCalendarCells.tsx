"use client";

import {
  describeDerivedSlotTooltip,
  deriveDayPlanFromTimeline,
  type DerivedSlot,
} from "@/lib/planner/derive-slots-from-timeline";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import {
  buildAmPmPresentation,
  halfDayDisplayForPlannerSlot,
  lookupPlannerPark,
  type AmPmCalendarPresentation,
  type HalfDayDisplay,
} from "@/lib/planner-am-pm-display";
import {
  pickPlannerTileDisplayIcon,
  PlannerTileIcon,
} from "@/components/planner/PlannerTileIcon";
import { plannerCalendarParkSlotStyle } from "@/lib/theme-colours";
import { themedEmptySlotSurfaceStyle, type ThemeKey } from "@/lib/themes";
import type { AiDayTimeline, Assignment, Park, SlotType } from "@/lib/types";
import type { CSSProperties } from "react";

type Props = {
  dateKey: string;
  assignment: Assignment;
  parkById: Map<string, Park>;
  themeKey: ThemeKey;
  readOnly: boolean;
  selectedParkId: string | null;
  onAssign: (dateKey: string, slot: SlotType, parkId: string) => void;
  onClear: (dateKey: string, slot: SlotType) => void;
  onNeedParkFirst: () => void;
  onAfterSlotClear?: () => void;
  useDayDetailShell: boolean;
  onOpenDayDetail?: (dateKey: string) => void;
  /** When set, AM/PM rows derive from Plan-this-day timeline (split layout). */
  aiTimeline?: AiDayTimeline | null;
};

const REST_UNIFIED_PRIMARY = "Rest / Pool";
const LABEL_FULL_DAY = "Full day";
const LABEL_TRAVEL_DAY = "Travel day";

function clearBothAmPm(
  dateKey: string,
  onClear: (dateKey: string, slot: SlotType) => void,
) {
  onClear(dateKey, "am");
  onClear(dateKey, "pm");
}

function unifiedShellStyle(
  mode: Exclude<AmPmCalendarPresentation, { mode: "split" }>,
  themeKey: ThemeKey,
  readOnly: boolean,
): CSSProperties {
  if (mode.mode === "unified_rest_day") {
    return plannerCalendarParkSlotStyle(mode.stylePark, themeKey, readOnly);
  }
  return plannerCalendarParkSlotStyle(mode.park, themeKey, readOnly);
}

function SplitHalfSlot({
  dateKey,
  slot,
  halfPrefix,
  display,
  assignment,
  parkById,
  areaClass,
  themeKey,
  readOnly,
  selectedParkId,
  onAssign,
  onClear,
  onNeedParkFirst,
  onAfterSlotClear,
  useDayDetailShell,
  onOpenDayDetail,
  derivedOverride,
  derivedTooltip,
}: {
  dateKey: string;
  slot: "am" | "pm";
  halfPrefix: "AM" | "PM";
  display: HalfDayDisplay;
  assignment: Assignment;
  parkById: Map<string, Park>;
  areaClass: string;
  themeKey: ThemeKey;
  readOnly: boolean;
  selectedParkId: string | null;
  onAssign: Props["onAssign"];
  onClear: Props["onClear"];
  onNeedParkFirst: Props["onNeedParkFirst"];
  onAfterSlotClear?: Props["onAfterSlotClear"];
  useDayDetailShell: boolean;
  onOpenDayDetail?: Props["onOpenDayDetail"];
  derivedOverride?: DerivedSlot | null;
  derivedTooltip?: string;
}) {
  const slotPid = getParkIdFromSlotValue(
    slot === "am" ? assignment.am : assignment.pm,
  );
  const park =
    display.state === "park"
      ? display.park
      : lookupPlannerPark(slotPid, parkById);

  if (derivedOverride) {
    const canOpen =
      !readOnly &&
      useDayDetailShell &&
      Boolean(onOpenDayDetail) &&
      !selectedParkId;
    const aria = `${halfPrefix} planned: ${derivedOverride.label}`;
    const useParkChromaShell = Boolean(park);
    const parkChromaShellStyle: CSSProperties | undefined =
      park != null
        ? plannerCalendarParkSlotStyle(park, themeKey, readOnly)
        : undefined;
    return (
      <div
        className={
          useParkChromaShell
            ? `group planner-slot relative flex min-h-0 flex-1 flex-col overflow-hidden rounded ${areaClass} transition hover:brightness-[1.06] ${
                canOpen || !readOnly
                  ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/50 focus-visible:ring-inset"
                  : ""
              }`
            : `group planner-slot relative flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-tt-gold/35 bg-tt-gold-soft/25 ${areaClass} transition hover:brightness-[1.04] ${
                canOpen || !readOnly
                  ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-gold/50 focus-visible:ring-inset"
                  : readOnly
                    ? ""
                    : "cursor-pointer hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/50 focus-visible:ring-inset"
              }`
        }
        style={parkChromaShellStyle}
        data-day-interactive
        role={canOpen || !readOnly ? "button" : undefined}
        tabIndex={canOpen || !readOnly ? 0 : undefined}
        aria-label={aria}
        title={
          selectedParkId && !readOnly
            ? `${derivedTooltip ?? aria} — tap to place selected park`
            : (derivedTooltip ?? aria)
        }
        onClick={(e) => {
          if (readOnly) return;
          e.stopPropagation();
          if (selectedParkId) {
            onAssign(dateKey, slot, selectedParkId);
            return;
          }
          if (canOpen && onOpenDayDetail) {
            onOpenDayDetail(dateKey);
            return;
          }
          onNeedParkFirst();
        }}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            if (selectedParkId) {
              onAssign(dateKey, slot, selectedParkId);
              return;
            }
            if (canOpen && onOpenDayDetail) {
              onOpenDayDetail(dateKey);
              return;
            }
            onNeedParkFirst();
          }
        }}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-row items-center gap-0.5 pl-0.5 pr-1 pt-3 md:min-h-[1.75rem] md:pl-1 md:pr-1 md:pt-2"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (readOnly) return;
            onClear(dateKey, slot);
            onAfterSlotClear?.();
          }}
        >
          {!readOnly ? (
            <button
              type="button"
              className="planner-slot-clear relative right-auto top-auto z-[1] flex h-5 w-5 shrink-0 items-center justify-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/55"
              data-day-interactive
              onClick={(e) => {
                e.stopPropagation();
                onClear(dateKey, slot);
              }}
              aria-label="Clear slot"
            >
              ×
            </button>
          ) : null}
          <span
            className={`line-clamp-3 min-w-0 flex-1 font-sans text-[0.6rem] font-medium leading-snug sm:text-[0.62rem] md:leading-tight${
              useParkChromaShell ? "" : " text-tt-royal"
            }`}
          >
            <span className="font-semibold opacity-80">{halfPrefix}</span> ✨{" "}
            {derivedOverride.label}
            {derivedOverride.sublabel ? (
              <span className="block truncate text-[0.52rem] font-normal opacity-80 sm:text-[0.54rem]">
                {derivedOverride.sublabel}
              </span>
            ) : null}
          </span>
        </div>
      </div>
    );
  }

  const slotAria = park
    ? `${halfPrefix} ${park.name}`
    : `${halfPrefix} Free`;
  const emptySlotStyle: CSSProperties | undefined = park
    ? undefined
    : themedEmptySlotSurfaceStyle();
  const filledSlotStyle: CSSProperties | undefined = park
    ? plannerCalendarParkSlotStyle(park, themeKey, readOnly)
    : undefined;
  const canOpenDayPanel = Boolean(
    !readOnly &&
      park &&
      useDayDetailShell &&
      onOpenDayDetail &&
      !selectedParkId,
  );
  const canOverwriteWithSelection = Boolean(
    !readOnly && park && selectedParkId,
  );

  return (
    <div
      className={`group planner-slot relative flex min-h-0 flex-1 flex-col overflow-hidden rounded ${areaClass} ${
        park ? "" : "border border-royal/10"
      } ${park ? "transition hover:brightness-[1.06]" : ""} ${
        readOnly || park
          ? ""
          : "cursor-pointer hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/50 focus-visible:ring-inset"
      }${
        canOpenDayPanel || canOverwriteWithSelection ? " cursor-pointer" : ""
      }`}
      style={park ? filledSlotStyle : emptySlotStyle}
      data-day-interactive
      role={
        canOpenDayPanel ||
        canOverwriteWithSelection ||
        (!readOnly && !park)
          ? "button"
          : undefined
      }
      tabIndex={
        canOpenDayPanel ||
        canOverwriteWithSelection ||
        (!readOnly && !park)
          ? 0
          : undefined
      }
      aria-label={
        canOverwriteWithSelection
          ? `Place selected park — ${slotAria}`
          : canOpenDayPanel
            ? `Open day planner — ${slotAria}`
            : slotAria
      }
      title={
        canOverwriteWithSelection
          ? "Place selected park on this slot (tap)"
          : canOpenDayPanel
            ? "Open day planner (rides, must-dos, and notes)"
            : slotAria
      }
      onClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        if (selectedParkId) {
          onAssign(dateKey, slot, selectedParkId);
          return;
        }
        if (park && useDayDetailShell && onOpenDayDetail) {
          onOpenDayDetail(dateKey);
          return;
        }
        if (!park) {
          onNeedParkFirst();
        }
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (selectedParkId) {
            onAssign(dateKey, slot, selectedParkId);
            return;
          }
          if (park && useDayDetailShell && onOpenDayDetail) {
            onOpenDayDetail(dateKey);
            return;
          }
          if (!park) {
            onNeedParkFirst();
          }
        }
      }}
    >
      {park ? (
        <div
          className="relative flex min-h-0 flex-1 flex-row items-center gap-0.5 pl-0.5 pr-1 pt-3 md:min-h-[1.75rem] md:pl-1 md:pr-1 md:pt-2"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (readOnly) return;
            onClear(dateKey, slot);
            onAfterSlotClear?.();
          }}
        >
          {!readOnly ? (
            <button
              type="button"
              className="planner-slot-clear relative right-auto top-auto z-[1] flex h-5 w-5 shrink-0 items-center justify-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/55"
              data-day-interactive
              onClick={(e) => {
                e.stopPropagation();
                onClear(dateKey, slot);
              }}
              aria-label="Clear slot"
            >
              ×
            </button>
          ) : null}
          <span className="line-clamp-3 min-w-0 flex-1 font-sans text-[0.6rem] font-medium leading-snug sm:text-[0.62rem] md:leading-tight">
            <span className="font-semibold opacity-80">{halfPrefix}</span>{" "}
            <PlannerTileIcon park={park} />
            {park.name}
          </span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center pb-0.5 pl-0.5 pr-1 pt-3 md:min-h-[1.75rem] md:justify-center md:pt-2">
          <span className="font-sans text-[0.58rem] font-medium leading-snug text-royal/55 sm:text-[0.6rem]">
            <span className="font-semibold text-royal/50">{halfPrefix}</span>{" "}
            <span className="italic">Free</span>
          </span>
        </div>
      )}
    </div>
  );
}

function UnifiedSpanSlot({
  dateKey,
  presentation,
  themeKey,
  readOnly,
  onClear,
  onAfterSlotClear,
  useDayDetailShell,
  onOpenDayDetail,
  selectedParkId,
  onAssign,
}: {
  dateKey: string;
  presentation: Exclude<AmPmCalendarPresentation, { mode: "split" }>;
  themeKey: ThemeKey;
  readOnly: boolean;
  onClear: Props["onClear"];
  onAfterSlotClear?: Props["onAfterSlotClear"];
  useDayDetailShell: boolean;
  onOpenDayDetail?: Props["onOpenDayDetail"];
  selectedParkId: string | null;
  onAssign: Props["onAssign"];
}) {
  const style = unifiedShellStyle(presentation, themeKey, readOnly);
  const canOpenDayPanel = Boolean(
    !readOnly &&
      useDayDetailShell &&
      onOpenDayDetail &&
      !selectedParkId,
  );
  const canPlaceFullDaySelection = Boolean(!readOnly && selectedParkId);

  let secondaryLine: string;
  let ariaPrimary: string;

  if (presentation.mode === "unified_rest_day") {
    ariaPrimary = REST_UNIFIED_PRIMARY;
    secondaryLine = LABEL_FULL_DAY;
  } else if (presentation.mode === "unified_travel_day") {
    ariaPrimary = `${pickPlannerTileDisplayIcon(presentation.park)} ${presentation.park.name}`;
    secondaryLine = LABEL_TRAVEL_DAY;
  } else {
    ariaPrimary = `${pickPlannerTileDisplayIcon(presentation.park)} ${presentation.park.name}`;
    secondaryLine = LABEL_FULL_DAY;
  }

  const ariaUnified = `${ariaPrimary}. ${secondaryLine}.`;

  return (
    <div
      className={`group planner-slot planner-slot-am-pm-span relative flex min-h-0 flex-col overflow-hidden rounded transition hover:brightness-[1.06] ${
        canOpenDayPanel || canPlaceFullDaySelection ? "cursor-pointer" : ""
      }`}
      style={style}
      data-day-interactive
      role={canOpenDayPanel || canPlaceFullDaySelection ? "button" : undefined}
      tabIndex={
        canOpenDayPanel || canPlaceFullDaySelection ? 0 : undefined
      }
      aria-label={
        canPlaceFullDaySelection
          ? `Place selected park — full day (AM and PM) — ${ariaUnified}`
          : canOpenDayPanel
            ? `Open day planner — ${ariaUnified}`
            : ariaUnified
      }
      title={
        canPlaceFullDaySelection
          ? "Place selected park on both AM and PM (tap)"
          : canOpenDayPanel
            ? "Open day planner (rides, must-dos, and notes)"
            : undefined
      }
      onClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        if (selectedParkId) {
          onAssign(dateKey, "am", selectedParkId);
          onAssign(dateKey, "pm", selectedParkId);
          return;
        }
        if (useDayDetailShell && onOpenDayDetail) {
          onOpenDayDetail(dateKey);
        }
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (selectedParkId) {
            onAssign(dateKey, "am", selectedParkId);
            onAssign(dateKey, "pm", selectedParkId);
            return;
          }
          if (useDayDetailShell && onOpenDayDetail) {
            onOpenDayDetail(dateKey);
          }
        }
      }}
    >
      <div
        className="relative flex min-h-0 flex-1 flex-row items-center gap-0.5 px-1 py-0.5 md:px-1 md:py-0.5"
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (readOnly) return;
          clearBothAmPm(dateKey, onClear);
          onAfterSlotClear?.();
        }}
      >
        {!readOnly ? (
          <button
            type="button"
            className="planner-slot-clear relative right-auto top-auto z-[1] flex h-5 w-5 shrink-0 items-center justify-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/55"
            data-day-interactive
            onClick={(e) => {
              e.stopPropagation();
              clearBothAmPm(dateKey, onClear);
            }}
            aria-label="Clear morning and afternoon slots"
          >
            ×
          </button>
        ) : null}
        <div className="min-w-0 flex-1 text-left">
          <div className="line-clamp-3 font-sans text-[0.64rem] font-medium leading-snug sm:text-[0.66rem] md:leading-tight">
            {presentation.mode === "unified_rest_day" ? (
              REST_UNIFIED_PRIMARY
            ) : (
              <>
                <PlannerTileIcon park={presentation.park} />
                {presentation.park.name}
              </>
            )}
          </div>
          <div className="planner-slot-am-pm-banner mt-0.5 font-sans text-[0.5rem] font-semibold uppercase leading-none tracking-wide opacity-75 sm:text-[0.52rem]">
            {secondaryLine}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlannerAmPmCalendarCells(props: Props) {
  const presentation = buildAmPmPresentation(props.assignment, props.parkById);
  const ai = props.aiTimeline;

  if (ai) {
    const derivedPlan = deriveDayPlanFromTimeline(ai);
    const amDisp = halfDayDisplayForPlannerSlot(
      "am",
      presentation,
      props.assignment,
      props.parkById,
    );
    const pmDisp = halfDayDisplayForPlannerSlot(
      "pm",
      presentation,
      props.assignment,
      props.parkById,
    );
    const amTip = derivedPlan.am
      ? describeDerivedSlotTooltip(ai, derivedPlan.am)
      : undefined;
    const pmTip = derivedPlan.pm
      ? describeDerivedSlotTooltip(ai, derivedPlan.pm)
      : undefined;
    return (
      <>
        <SplitHalfSlot
          dateKey={props.dateKey}
          slot="am"
          halfPrefix="AM"
          display={amDisp}
          assignment={props.assignment}
          parkById={props.parkById}
          derivedOverride={derivedPlan.am}
          derivedTooltip={amTip}
          areaClass="planner-slot-am"
          themeKey={props.themeKey}
          readOnly={props.readOnly}
          selectedParkId={props.selectedParkId}
          onAssign={props.onAssign}
          onClear={props.onClear}
          onNeedParkFirst={props.onNeedParkFirst}
          onAfterSlotClear={props.onAfterSlotClear}
          useDayDetailShell={props.useDayDetailShell}
          onOpenDayDetail={props.onOpenDayDetail}
        />
        <SplitHalfSlot
          dateKey={props.dateKey}
          slot="pm"
          halfPrefix="PM"
          display={pmDisp}
          assignment={props.assignment}
          parkById={props.parkById}
          derivedOverride={derivedPlan.pm}
          derivedTooltip={pmTip}
          areaClass="planner-slot-pm"
          themeKey={props.themeKey}
          readOnly={props.readOnly}
          selectedParkId={props.selectedParkId}
          onAssign={props.onAssign}
          onClear={props.onClear}
          onNeedParkFirst={props.onNeedParkFirst}
          onAfterSlotClear={props.onAfterSlotClear}
          useDayDetailShell={props.useDayDetailShell}
          onOpenDayDetail={props.onOpenDayDetail}
        />
      </>
    );
  }

  if (presentation.mode === "split") {
    return (
      <>
        <SplitHalfSlot
          dateKey={props.dateKey}
          slot="am"
          halfPrefix="AM"
          display={presentation.morning}
          assignment={props.assignment}
          parkById={props.parkById}
          areaClass="planner-slot-am"
          themeKey={props.themeKey}
          readOnly={props.readOnly}
          selectedParkId={props.selectedParkId}
          onAssign={props.onAssign}
          onClear={props.onClear}
          onNeedParkFirst={props.onNeedParkFirst}
          onAfterSlotClear={props.onAfterSlotClear}
          useDayDetailShell={props.useDayDetailShell}
          onOpenDayDetail={props.onOpenDayDetail}
        />
        <SplitHalfSlot
          dateKey={props.dateKey}
          slot="pm"
          halfPrefix="PM"
          display={presentation.afternoon}
          assignment={props.assignment}
          parkById={props.parkById}
          areaClass="planner-slot-pm"
          themeKey={props.themeKey}
          readOnly={props.readOnly}
          selectedParkId={props.selectedParkId}
          onAssign={props.onAssign}
          onClear={props.onClear}
          onNeedParkFirst={props.onNeedParkFirst}
          onAfterSlotClear={props.onAfterSlotClear}
          useDayDetailShell={props.useDayDetailShell}
          onOpenDayDetail={props.onOpenDayDetail}
        />
      </>
    );
  }

  return (
    <UnifiedSpanSlot
      dateKey={props.dateKey}
      presentation={presentation}
      themeKey={props.themeKey}
      readOnly={props.readOnly}
      onClear={props.onClear}
      onAfterSlotClear={props.onAfterSlotClear}
      useDayDetailShell={props.useDayDetailShell}
      onOpenDayDetail={props.onOpenDayDetail}
      selectedParkId={props.selectedParkId}
      onAssign={props.onAssign}
    />
  );
}
