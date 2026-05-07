"use client";

import { BookTripAffiliatePanel } from "@/components/planner/BookTripAffiliatePanel";
import { Calendar } from "@/components/planner/Calendar";
import { CompareDaysPanel } from "@/components/planner/CompareDaysPanel";
import { EmptyCalendarCta } from "@/components/planner/EmptyCalendarCta";
import { MobileTripCalendarStripNav } from "@/components/planner/MobileTripCalendarStripNav";
import { MobileDayView } from "@/components/planner/MobileDayView";
import { Palette } from "@/components/planner/Palette";
import { PlannerDayTimelineStub } from "@/components/planner/PlannerDayTimelineStub";
import { PlannerPlanningDeck } from "@/components/planner/PlannerPlanningDeck";
import { TripDayPageView } from "@/components/planner/TripDayPageView";
import { SHOW_BOOKING_AFFILIATE_PANEL } from "@/components/planner/sections/planner-section-flags";
import { hasAnyAffiliatePartner } from "@/lib/affiliates";
import type { CrowdLevel } from "@/lib/planner-crowd-level-meta";
import { resolvePaletteRegionId } from "@/lib/planner-palette-region";
import { normaliseThemeKey } from "@/lib/themes";
import type { Tier } from "@/lib/tier";
import type {
  CustomTile,
  Park,
  SlotType,
  TemperatureUnit,
  Trip,
} from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import type { TripPayment } from "@/types/payments";

export type PlannerGridColumnStackProps = {
  compareMode: boolean;
  activeTrip: Trip;
  activeRegionLabel: string;
  siteUrl: string;
  parks: Park[];
  customTilesForPalette: CustomTile[];
  selectedParkId: string | null;
  onSelectPark: (id: string | null) => void;
  onAddCustom: (group: string) => void;
  onEditCustom: (tile: CustomTile) => void;
  onDeleteCustom: (tileId: string) => void;
  calendarParks: Park[];
  temperatureUnit: TemperatureUnit;
  productTier: Tier;
  mobilePlannerNoteMaps: {
    ai: Record<string, string>;
    user: Record<string, string>;
  };
  mobileCrowdSummaryText: string | null;
  onSaveDayNote: (dateKey: string, note: string) => void;
  onTransferSlot: (
    fromDate: string,
    fromSlot: SlotType,
    toDate: string,
    toSlot: SlotType,
  ) => void;
  onAssign: (dateKey: string, slot: SlotType, parkId: string) => void;
  onClear: (dateKey: string, slot: SlotType) => void;
  onNeedParkFirst: () => void;
  onAfterSlotClear: () => void;
  hasAnyAssignment: boolean;
  dayDetailOpen: boolean;
  onEmptyCalendarGenerateAi: () => void;
  onEmptyCalendarAddManually: () => void;
  onEmptyCalendarSurprise: () => void;
  tripRouteBase: string | null | undefined;
  dayCanonicalForDetail: string | null;
  closeDayDetail: () => void;
  ridePrioritiesByDayForActiveTrip: Record<string, TripRidePriority[]>;
  rideCountsByDayForActiveTrip: Record<string, { total: number; mustDo: number }>;
  handleRideDayPrioritiesUpdated: (
    dayDate: string,
    items: TripRidePriority[],
  ) => void;
  openDayPlanner: (
    dateKey: string,
    options?: { tab?: "adjust" | "strategy"; autoRunStrategy?: boolean },
  ) => void;
  handleUndoDayTweak: (dateKey: string) => void;
  runMustDosGen: (dateKey: string, parkId: string) => void;
  mustDosGenLoading: { dateKey: string; parkId: string } | null;
  handleToggleMustDoDone: (
    dateKey: string,
    parkId: string,
    mustDoId: string,
    next: boolean,
  ) => void;
  handleMobileMenuShare: () => void;
  onMenuUndoSmartPlan: () => void;
  cataloguedParkIdSet: Set<string>;
  timelineUnlocked: boolean;
  onSlotTimeChange: (
    dateKey: string,
    slot: SlotType,
    timeHHmm: string,
  ) => void;
  calendarConflictDotsForCalendar: Record<string, "amber" | "grey">;
  goToTodayRingDateKey: string | null;
  plannerTimelineDateKey: string | null;
  setPlannerTimelineDateKey: (k: string | null) => void;
  openDayDetail: (
    dateKey: string,
    options?: { focusNotes?: boolean },
  ) => void;
  timelineWeatherCrowd: {
    weather: string | null;
    crowd: CrowdLevel | null;
  };
  plannerDayUndoAvailable: boolean;
  shiftPlannerTimelineDay: (delta: number) => void;
  onPlanThisDay: () => void;
  onUndoAiTimeline: () => void;
  onShareTimelineDay: (() => void) | undefined;
  onEditTimelineDay: () => void;
  paymentsByTripId: Record<string, TripPayment[]>;
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  onTripPatch: (patch: Partial<Trip>) => void;
  setCompareMode: (v: boolean) => void;
};

export function PlannerGridColumnStack({
  compareMode,
  activeTrip,
  activeRegionLabel,
  siteUrl,
  parks,
  customTilesForPalette,
  selectedParkId,
  onSelectPark,
  onAddCustom,
  onEditCustom,
  onDeleteCustom,
  calendarParks,
  temperatureUnit,
  productTier,
  mobilePlannerNoteMaps,
  mobileCrowdSummaryText,
  onSaveDayNote,
  onTransferSlot,
  onAssign,
  onClear,
  onNeedParkFirst,
  onAfterSlotClear,
  hasAnyAssignment,
  dayDetailOpen,
  onEmptyCalendarGenerateAi,
  onEmptyCalendarAddManually,
  onEmptyCalendarSurprise,
  tripRouteBase,
  dayCanonicalForDetail,
  closeDayDetail,
  ridePrioritiesByDayForActiveTrip,
  rideCountsByDayForActiveTrip,
  handleRideDayPrioritiesUpdated,
  openDayPlanner,
  handleUndoDayTweak,
  runMustDosGen,
  mustDosGenLoading,
  handleToggleMustDoDone,
  handleMobileMenuShare,
  onMenuUndoSmartPlan,
  cataloguedParkIdSet,
  timelineUnlocked,
  onSlotTimeChange,
  calendarConflictDotsForCalendar,
  goToTodayRingDateKey,
  plannerTimelineDateKey,
  setPlannerTimelineDateKey,
  openDayDetail,
  timelineWeatherCrowd,
  plannerDayUndoAvailable,
  shiftPlannerTimelineDay,
  onPlanThisDay,
  onUndoAiTimeline,
  onShareTimelineDay,
  onEditTimelineDay,
  paymentsByTripId,
  onPaymentsChange,
  onTripPatch,
  setCompareMode,
}: PlannerGridColumnStackProps) {
  return (
    <div
      className={`mt-8 grid items-start gap-6 ${
        compareMode
          ? ""
          : "lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] lg:gap-5 xl:gap-6"
      }`}
    >
      {!compareMode ? (
        <div className="hidden space-y-3 md:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1">
          {SHOW_BOOKING_AFFILIATE_PANEL && hasAnyAffiliatePartner() ? (
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
            onSelectPark={onSelectPark}
            onAddCustom={onAddCustom}
            onEditCustom={onEditCustom}
            onDeleteCustom={onDeleteCustom}
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
                    onGenerateAi={onEmptyCalendarGenerateAi}
                    onAddManually={onEmptyCalendarAddManually}
                    onSurpriseMe={onEmptyCalendarSurprise}
                  />
                </div>
              </div>
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
                      ridePrioritiesByDayForActiveTrip[dayCanonicalForDetail] ??
                      []
                    }
                    productTier={productTier}
                    plannerRegionId={resolvePaletteRegionId(activeTrip)}
                    temperatureUnit={temperatureUnit}
                    onClose={closeDayDetail}
                    onPrioritiesUpdated={(items) =>
                      handleRideDayPrioritiesUpdated(dayCanonicalForDetail, items)
                    }
                    onSaveDayNote={onSaveDayNote}
                    onOpenSmartPlan={onPlanThisDay}
                    onOpenDayPlanner={(opts) =>
                      openDayPlanner(dayCanonicalForDetail, opts)
                    }
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
                        ? (rideCountsByDayForActiveTrip[dayCanonicalForDetail] ??
                          null)
                        : null
                    }
                    onTripPatch={onTripPatch}
                    ridePrioritiesByDayForTrip={ridePrioritiesByDayForActiveTrip}
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
                    ridePrioritiesByDay={ridePrioritiesByDayForActiveTrip}
                    rideCountsByDay={rideCountsByDayForActiveTrip}
                    onRideDayPrioritiesUpdated={handleRideDayPrioritiesUpdated}
                    onOpenDayPlanner={openDayPlanner}
                    onUndoDayTweak={handleUndoDayTweak}
                    cataloguedParkIdSet={cataloguedParkIdSet}
                    onGenerateMustDosForPark={runMustDosGen}
                    mustDosGenLoading={mustDosGenLoading}
                    onToggleMustDoDone={handleToggleMustDoDone}
                    onSelectPark={onSelectPark}
                    onMenuExportPdf={() =>
                      document.getElementById("planner-pdf-export-btn")?.click()
                    }
                    onMenuShare={handleMobileMenuShare}
                    onMenuSettings={() => undefined}
                    smartPlanUndoSnapshotAt={
                      activeTrip.previous_assignments_snapshot_at ?? null
                    }
                    onMenuUndoSmartPlan={onMenuUndoSmartPlan}
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
                      onNeedParkFirst={onNeedParkFirst}
                      onAfterSlotClear={onAfterSlotClear}
                      plannerRegionId={resolvePaletteRegionId(activeTrip)}
                      temperatureUnit={temperatureUnit}
                      onSaveDayNote={onSaveDayNote}
                      timelineUnlocked={timelineUnlocked}
                      onSlotTimeChange={onSlotTimeChange}
                      ridePrioritiesByDay={ridePrioritiesByDayForActiveTrip}
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
                  {activeTrip ? (
                    <div className="mt-6 space-y-4 md:mt-8 md:space-y-5">
                      <PlannerDayTimelineStub
                        trip={activeTrip}
                        dateKey={plannerTimelineDateKey}
                        parks={calendarParks}
                        plannerRegionId={resolvePaletteRegionId(activeTrip)}
                        temperatureUnit={temperatureUnit}
                        weatherChip={timelineWeatherCrowd.weather}
                        crowdLevel={timelineWeatherCrowd.crowd}
                        undoAiAvailable={plannerDayUndoAvailable}
                        onClearSelection={() => setPlannerTimelineDateKey(null)}
                        onPrevDay={() => shiftPlannerTimelineDay(-1)}
                        onNextDay={() => shiftPlannerTimelineDay(1)}
                        onPlanThisDay={onPlanThisDay}
                        onUndoAi={onUndoAiTimeline}
                        onShareDay={onShareTimelineDay}
                        onEditDay={onEditTimelineDay}
                      />
                      <PlannerPlanningDeck
                        trip={activeTrip}
                        payments={paymentsByTripId[activeTrip.id] ?? []}
                        onPaymentsChange={onPaymentsChange}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
