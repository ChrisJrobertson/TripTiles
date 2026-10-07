import {
  resolveOperatingWindow,
  sequencerMinutesFromResolution,
  type CatalogueHours,
  type NormalisedScheduleEntry,
  type OperatingWindowResolution,
} from "@/lib/park-data/schedule";

export type SequencerClock = {
  parkId: string;
  resolution: OperatingWindowResolution;
  openMinutes: number;
  closeMinutes: number;
  usedEarlyEntry: boolean;
  warnings: string[];
  blocked: boolean;
  blockMessage: string | null;
};

/**
 * One operating window for the V1 sequencer, which still plans a single clock.
 * The first assigned park supplies that clock. Other parks only add a warning
 * when their posted window differs.
 */
export function operatingWindowForSequencer(input: {
  parkIds: string[];
  date: string;
  schedules: readonly NormalisedScheduleEntry[];
  catalogues: readonly CatalogueHours[];
  preferredProvider: string;
  hasEarlyEntry: boolean;
  now?: Date;
}): SequencerClock {
  const parkId = input.parkIds[0] ?? "";
  const catalogue = input.catalogues.find((row) => row.parkId === parkId) ?? null;
  const resolution = resolveOperatingWindow({
    date: input.date,
    schedules: input.schedules.filter((row) => row.parkId === parkId),
    catalogue,
    preferredProvider: input.preferredProvider,
    now: input.now,
  });
  const minutes = sequencerMinutesFromResolution(resolution, {
    hasEarlyEntry: input.hasEarlyEntry,
  });

  if (!minutes) {
    return {
      parkId,
      resolution,
      openMinutes: 0,
      closeMinutes: 0,
      usedEarlyEntry: false,
      warnings: [],
      blocked: true,
      blockMessage: resolution.label,
    };
  }

  const warnings: string[] = [];
  if (
    resolution.source === "fallback_assumption" ||
    resolution.source === "catalogue_hours" ||
    resolution.source === "stored_schedule"
  ) {
    warnings.push(resolution.label);
  } else if (resolution.source === "posted_schedule" && resolution.provider) {
    // Usable provider hours — still labelled so UI never presents them as official.
    warnings.push(resolution.label);
  }
  if (minutes.usedEarlyEntry) {
    warnings.push("Posted early entry is included in the touring start time.");
  }

  if (input.parkIds.length > 1) {
    const differs = input.parkIds.slice(1).some((otherId) => {
      const other = resolveOperatingWindow({
        date: input.date,
        schedules: input.schedules.filter((row) => row.parkId === otherId),
        catalogue: input.catalogues.find((row) => row.parkId === otherId) ?? null,
        preferredProvider: input.preferredProvider,
        now: input.now,
      });
      return other.open !== resolution.open || other.close !== resolution.close;
    });
    if (differs) {
      warnings.push(
        `Hours differ across the parks assigned today. The touring plan uses ${parkId} (${resolution.open ?? "unknown"}–${resolution.close ?? "unknown"}).`,
      );
    }
  }

  return {
    parkId,
    resolution,
    openMinutes: minutes.openMinutes,
    closeMinutes: minutes.closeMinutes,
    usedEarlyEntry: minutes.usedEarlyEntry,
    warnings,
    blocked: false,
    blockMessage: null,
  };
}
