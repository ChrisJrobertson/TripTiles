"use client";

import { parkChromaTileStyle } from "@/lib/theme-colours";
import { themedEmptySlotSurfaceStyle, type ThemeKey } from "@/lib/themes";
import {
  buildAmPmPresentation,
  type AmPmCalendarPresentation,
} from "@/lib/planner-am-pm-display";
import type { Assignment, Park, SlotType } from "@/lib/types";
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
};

const REST_DAY_TITLE = "Rest day";
const REST_DAY_SUBTITLE = "Pool / downtime";

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
): CSSProperties {
  if (mode.mode === "unified_rest_day") {
    return parkChromaTileStyle(
      mode.stylePark.bg_colour,
      mode.stylePark.fg_colour,
      themeKey,
    );
  }
  return parkChromaTileStyle(mode.park.bg_colour, mode.park.fg_colour, themeKey);
}

type HalfDisplay =
  | { state: "flexible" }
  | { state: "park"; park: Park };

function SplitHalfSlot({
  dateKey,
  slot,
  halfLabel,
  display,
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
}: {
  dateKey: string;
  slot: "am" | "pm";
  halfLabel: string;
  display: HalfDisplay;
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
}) {
  const park = display.state === "park" ? display.park : undefined;
  const slotAria = park
    ? `${halfLabel}: ${park.name}`
    : `${halfLabel}: Flexible`;
  const emptySlotStyle: CSSProperties | undefined = park
    ? undefined
    : themedEmptySlotSurfaceStyle();
  const filledSlotStyle: CSSProperties | undefined = park
    ? parkChromaTileStyle(park.bg_colour, park.fg_colour, themeKey)
    : undefined;
  const canOpenDayPanel = Boolean(
    !readOnly && park && useDayDetailShell && onOpenDayDetail,
  );

  return (
    <div
      className={`group planner-slot relative flex min-h-0 flex-1 flex-col overflow-hidden rounded ${areaClass} ${
        park ? "" : "border border-royal/10"
      } ${park ? "transition hover:brightness-[1.06]" : ""} ${
        readOnly || park
          ? ""
          : "cursor-pointer hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/50 focus-visible:ring-inset"
      }${canOpenDayPanel ? " cursor-pointer" : ""}`}
      style={park ? filledSlotStyle : emptySlotStyle}
      data-day-interactive
      role={
        canOpenDayPanel
          ? "button"
          : readOnly || park
            ? undefined
            : "button"
      }
      tabIndex={canOpenDayPanel ? 0 : readOnly || park ? undefined : 0}
      aria-label={
        canOpenDayPanel
          ? `Open day planner — ${slotAria}`
          : slotAria
      }
      title={
        canOpenDayPanel
          ? "Open day planner (rides, must-dos, and notes)"
          : slotAria
      }
      onClick={(e) => {
        if (readOnly) return;
        if (park) {
          if (useDayDetailShell && onOpenDayDetail) {
            e.stopPropagation();
            onOpenDayDetail(dateKey);
          }
          return;
        }
        e.stopPropagation();
        if (selectedParkId) {
          onAssign(dateKey, slot, selectedParkId);
        } else {
          onNeedParkFirst();
        }
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (park) {
          if (
            useDayDetailShell &&
            onOpenDayDetail &&
            (e.key === "Enter" || e.key === " ")
          ) {
            e.preventDefault();
            e.stopPropagation();
            onOpenDayDetail(dateKey);
          }
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (selectedParkId) {
            onAssign(dateKey, slot, selectedParkId);
          } else {
            onNeedParkFirst();
          }
        }
      }}
    >
      <span className="planner-slot-morning-afternoon-label">{halfLabel}</span>
      {park ? (
        <div
          className="relative mt-2 flex min-h-0 flex-1 flex-row items-center gap-0.5 pl-0.5 pr-1 md:mt-1.5 md:items-stretch md:pl-1 md:pr-1"
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
          <span className="line-clamp-3 min-w-0 flex-1 self-center font-sans text-[0.6rem] font-medium leading-tight sm:text-[0.65rem] md:self-center md:py-0.5">
            {park.icon ? `${park.icon} ` : ""}
            {park.name}
          </span>
        </div>
      ) : (
        <div className="mt-auto flex min-h-0 flex-1 flex-col justify-end pb-0.5 pl-0.5 pr-1 md:mt-1.5 md:justify-center">
          <span className="font-sans text-[0.58rem] font-medium italic text-royal/50 sm:text-[0.6rem]">
            Flexible
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
}: {
  dateKey: string;
  presentation: Exclude<AmPmCalendarPresentation, { mode: "split" }>;
  themeKey: ThemeKey;
  readOnly: boolean;
  onClear: Props["onClear"];
  onAfterSlotClear?: Props["onAfterSlotClear"];
  useDayDetailShell: boolean;
  onOpenDayDetail?: Props["onOpenDayDetail"];
}) {
  const style = unifiedShellStyle(presentation, themeKey);
  const canOpenDayPanel = Boolean(
    !readOnly && useDayDetailShell && onOpenDayDetail,
  );

  const bannerLabel =
    presentation.mode === "unified_rest_day"
      ? REST_DAY_TITLE
      : presentation.bannerLabel;

  const parkLabel =
    presentation.mode === "unified_rest_day"
      ? null
      : `${presentation.park.icon ? `${presentation.park.icon} ` : ""}${
          presentation.park.name
        }`;

  const ariaUnified =
    presentation.mode === "unified_rest_day"
      ? `${REST_DAY_TITLE}: ${REST_DAY_SUBTITLE}`
      : `${bannerLabel}: ${presentation.park.name}`;

  return (
    <div
      className={`group planner-slot planner-slot-am-pm-span relative flex min-h-0 flex-col overflow-hidden rounded transition hover:brightness-[1.06] ${
        canOpenDayPanel ? "cursor-pointer" : ""
      }`}
      style={style}
      data-day-interactive
      role={canOpenDayPanel ? "button" : undefined}
      tabIndex={canOpenDayPanel ? 0 : undefined}
      aria-label={
        canOpenDayPanel ? `Open day planner — ${ariaUnified}` : ariaUnified
      }
      title={
        canOpenDayPanel
          ? "Open day planner (rides, must-dos, and notes)"
          : undefined
      }
      onClick={(e) => {
        if (readOnly) return;
        if (useDayDetailShell && onOpenDayDetail) {
          e.stopPropagation();
          onOpenDayDetail(dateKey);
        }
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (
          useDayDetailShell &&
          onOpenDayDetail &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          e.stopPropagation();
          onOpenDayDetail(dateKey);
        }
      }}
    >
      <div
        className="relative flex min-h-0 flex-1 flex-row items-start gap-0.5 px-1 pb-0.5 pt-1 md:px-1 md:pb-0.5 md:pt-0.5"
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
          <div className="planner-slot-am-pm-banner font-sans text-[0.55rem] font-semibold uppercase leading-none tracking-wide opacity-80">
            {bannerLabel}
          </div>
          <div className="line-clamp-4 font-sans text-[0.64rem] font-medium leading-snug sm:text-[0.68rem] md:leading-tight">
            {presentation.mode === "unified_rest_day" ? (
              <span className="block text-[0.62rem] opacity-90">
                {REST_DAY_SUBTITLE}
              </span>
            ) : (
              <span>{parkLabel}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlannerAmPmCalendarCells(props: Props) {
  const presentation = buildAmPmPresentation(props.assignment, props.parkById);

  if (presentation.mode === "split") {
    return (
      <>
        <SplitHalfSlot
          dateKey={props.dateKey}
          slot="am"
          halfLabel="Morning"
          display={presentation.morning}
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
          halfLabel="Afternoon"
          display={presentation.afternoon}
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
    />
  );
}
