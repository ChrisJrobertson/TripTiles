import {
  getMonthlyConditions,
  type CrowdLevel,
} from "@/data/destination-conditions";
import { MONTHS_LONG } from "@/lib/date-helpers";
import type { TemperatureUnit } from "@/lib/types";

const CROWD_WORDS: Record<CrowdLevel, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  busy: "Busy",
};

const CROWD_TIP: Record<CrowdLevel, string> = {
  quiet: "Tip: lighter queues — great day for headline parks.",
  moderate: "Tip: arrive early for shorter queues.",
  busy: "Tip: arrive early for shorter queues.",
};

export function crowdTooltipForMonth(
  crowd: CrowdLevel,
  monthIndex1: number,
): string {
  const name = MONTHS_LONG[monthIndex1 - 1] ?? "this month";
  const emoji =
    crowd === "quiet" ? "🟢" : crowd === "moderate" ? "🟡" : "🔴";
  return `${emoji} ${CROWD_WORDS[crowd]} crowds expected in ${name}. ${CROWD_TIP[crowd]}`;
}

export function formatTempForUnit(
  c: number,
  f: number,
  unit: TemperatureUnit,
): string {
  return unit === "f" ? `${Math.round(f)}°F` : `${Math.round(c)}°C`;
}

export function dayConditionRow(
  regionId: string | null | undefined,
  day: Date,
  tempUnit: TemperatureUnit,
): {
  conditions: import("@/data/destination-conditions").MonthlyConditions;
  tempLabel: string;
  crowd: CrowdLevel;
  tooltip: string;
} | null {
  const month = day.getMonth() + 1;
  const mc = getMonthlyConditions(regionId, month);
  if (!mc) return null;
  return {
    conditions: mc,
    tempLabel: formatTempForUnit(mc.tempHighC, mc.tempHighF, tempUnit),
    crowd: mc.crowdLevel,
    tooltip: crowdTooltipForMonth(mc.crowdLevel, month),
  };
}

/** One line for PDF day headers. */
export function pdfDayConditionLine(
  regionId: string | null | undefined,
  day: Date,
  tempUnit: TemperatureUnit,
): string | null {
  const row = dayConditionRow(regionId, day, tempUnit);
  if (!row) return null;
  const crowdW = CROWD_WORDS[row.crowd].toLowerCase();
  const fParen =
    tempUnit === "c"
      ? ` (${Math.round(row.conditions.tempHighF)}°F)`
      : ` (${Math.round(row.conditions.tempHighC)}°C)`;
  const tempPart =
    tempUnit === "c"
      ? `${Math.round(row.conditions.tempHighC)}°C${fParen}`
      : `${Math.round(row.conditions.tempHighF)}°F${fParen}`;
  return `Expected conditions: ${row.conditions.weatherEmoji} ${tempPart}, ${crowdW} crowds`;
}
