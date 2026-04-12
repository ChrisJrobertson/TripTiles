/**
 * Static monthly averages (not forecasts). Crowd labels are broad heuristics.
 * Celsius-first; Fahrenheit for display when profile uses °F.
 */

export type RainChance = "low" | "medium" | "high";
export type CrowdLevel = "quiet" | "moderate" | "busy";

export interface MonthlyConditions {
  tempHighC: number;
  tempHighF: number;
  rainChance: RainChance;
  crowdLevel: CrowdLevel;
  weatherEmoji: string;
}

export const DESTINATION_CONDITIONS: Record<
  string,
  Record<number, MonthlyConditions>
> = {
  orlando: {
    1: {
      tempHighC: 22,
      tempHighF: 72,
      rainChance: "low",
      crowdLevel: "moderate",
      weatherEmoji: "☀️",
    },
    2: {
      tempHighC: 23,
      tempHighF: 74,
      rainChance: "low",
      crowdLevel: "moderate",
      weatherEmoji: "☀️",
    },
    3: {
      tempHighC: 26,
      tempHighF: 78,
      rainChance: "low",
      crowdLevel: "busy",
      weatherEmoji: "☀️",
    },
    4: {
      tempHighC: 28,
      tempHighF: 83,
      rainChance: "low",
      crowdLevel: "busy",
      weatherEmoji: "☀️",
    },
    5: {
      tempHighC: 31,
      tempHighF: 88,
      rainChance: "medium",
      crowdLevel: "moderate",
      weatherEmoji: "⛅",
    },
    6: {
      tempHighC: 33,
      tempHighF: 91,
      rainChance: "high",
      crowdLevel: "busy",
      weatherEmoji: "⛅",
    },
    7: {
      tempHighC: 33,
      tempHighF: 92,
      rainChance: "high",
      crowdLevel: "busy",
      weatherEmoji: "⛅",
    },
    8: {
      tempHighC: 33,
      tempHighF: 92,
      rainChance: "high",
      crowdLevel: "busy",
      weatherEmoji: "⛅",
    },
    9: {
      tempHighC: 32,
      tempHighF: 90,
      rainChance: "high",
      crowdLevel: "moderate",
      weatherEmoji: "⛅",
    },
    10: {
      tempHighC: 29,
      tempHighF: 84,
      rainChance: "medium",
      crowdLevel: "moderate",
      weatherEmoji: "☀️",
    },
    11: {
      tempHighC: 26,
      tempHighF: 78,
      rainChance: "low",
      crowdLevel: "moderate",
      weatherEmoji: "☀️",
    },
    12: {
      tempHighC: 23,
      tempHighF: 73,
      rainChance: "low",
      crowdLevel: "busy",
      weatherEmoji: "☀️",
    },
  },
  cali: {
    1: { tempHighC: 20, tempHighF: 68, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    2: { tempHighC: 20, tempHighF: 68, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    3: { tempHighC: 21, tempHighF: 70, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    4: { tempHighC: 22, tempHighF: 72, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    5: { tempHighC: 23, tempHighF: 73, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "⛅" },
    6: { tempHighC: 24, tempHighF: 75, rainChance: "low", crowdLevel: "busy", weatherEmoji: "⛅" },
    7: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 27, tempHighF: 81, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 27, tempHighF: 81, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    10: { tempHighC: 25, tempHighF: 77, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    11: { tempHighC: 23, tempHighF: 73, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    12: { tempHighC: 19, tempHighF: 66, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
  },
  miami: {
    1: { tempHighC: 24, tempHighF: 75, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    2: { tempHighC: 25, tempHighF: 77, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    3: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    4: { tempHighC: 28, tempHighF: 82, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    5: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "⛅" },
    6: { tempHighC: 31, tempHighF: 88, rainChance: "high", crowdLevel: "busy", weatherEmoji: "⛅" },
    7: { tempHighC: 32, tempHighF: 90, rainChance: "high", crowdLevel: "busy", weatherEmoji: "⛅" },
    8: { tempHighC: 32, tempHighF: 90, rainChance: "high", crowdLevel: "busy", weatherEmoji: "⛅" },
    9: { tempHighC: 31, tempHighF: 88, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "⛅" },
    10: { tempHighC: 29, tempHighF: 84, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "⛅" },
    11: { tempHighC: 27, tempHighF: 81, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "☀️" },
    12: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
  },
  lasvegas: {
    1: { tempHighC: 14, tempHighF: 57, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    2: { tempHighC: 16, tempHighF: 61, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    3: { tempHighC: 21, tempHighF: 70, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    4: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    5: { tempHighC: 31, tempHighF: 88, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    6: { tempHighC: 38, tempHighF: 100, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    7: { tempHighC: 41, tempHighF: 106, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 40, tempHighF: 104, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 36, tempHighF: 97, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    10: { tempHighC: 28, tempHighF: 82, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    11: { tempHighC: 19, tempHighF: 66, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    12: { tempHighC: 14, tempHighF: 57, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
  },
  paris: {
    1: { tempHighC: 8, tempHighF: 46, rainChance: "medium", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    2: { tempHighC: 9, tempHighF: 48, rainChance: "medium", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    3: { tempHighC: 13, tempHighF: 55, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    4: { tempHighC: 16, tempHighF: 61, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    5: { tempHighC: 20, tempHighF: 68, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    6: { tempHighC: 24, tempHighF: 75, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    7: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 25, tempHighF: 77, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 21, tempHighF: 70, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    10: { tempHighC: 16, tempHighF: 61, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    11: { tempHighC: 11, tempHighF: 52, rainChance: "medium", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    12: { tempHighC: 8, tempHighF: 46, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "❄️" },
  },
  london: {
    1: { tempHighC: 8, tempHighF: 46, rainChance: "medium", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    2: { tempHighC: 8, tempHighF: 46, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    3: { tempHighC: 11, tempHighF: 52, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    4: { tempHighC: 14, tempHighF: 57, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    5: { tempHighC: 18, tempHighF: 64, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    6: { tempHighC: 21, tempHighF: 70, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    7: { tempHighC: 23, tempHighF: 73, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 23, tempHighF: 73, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 20, tempHighF: 68, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    10: { tempHighC: 16, tempHighF: 61, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    11: { tempHighC: 12, tempHighF: 54, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    12: { tempHighC: 9, tempHighF: 48, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "🌧️" },
  },
  tokyo: {
    1: { tempHighC: 10, tempHighF: 50, rainChance: "low", crowdLevel: "quiet", weatherEmoji: "☀️" },
    2: { tempHighC: 10, tempHighF: 50, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    3: { tempHighC: 14, tempHighF: 57, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "🌧️" },
    4: { tempHighC: 19, tempHighF: 66, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    5: { tempHighC: 23, tempHighF: 73, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    6: { tempHighC: 26, tempHighF: 79, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    7: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 31, tempHighF: 88, rainChance: "high", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 27, tempHighF: 81, rainChance: "high", crowdLevel: "busy", weatherEmoji: "⛅" },
    10: { tempHighC: 22, tempHighF: 72, rainChance: "high", crowdLevel: "busy", weatherEmoji: "⛅" },
    11: { tempHighC: 17, tempHighF: 63, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    12: { tempHighC: 12, tempHighF: 54, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
  },
  uae: {
    1: { tempHighC: 24, tempHighF: 75, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    2: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    3: { tempHighC: 29, tempHighF: 84, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    4: { tempHighC: 33, tempHighF: 91, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    5: { tempHighC: 38, tempHighF: 100, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    6: { tempHighC: 40, tempHighF: 104, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    7: { tempHighC: 41, tempHighF: 106, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 42, tempHighF: 108, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 39, tempHighF: 102, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    10: { tempHighC: 35, tempHighF: 95, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    11: { tempHighC: 31, tempHighF: 88, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    12: { tempHighC: 26, tempHighF: 79, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
  },
  edinburgh: {
    1: { tempHighC: 7, tempHighF: 45, rainChance: "high", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    2: { tempHighC: 7, tempHighF: 45, rainChance: "high", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    3: { tempHighC: 9, tempHighF: 48, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    4: { tempHighC: 11, tempHighF: 52, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    5: { tempHighC: 14, tempHighF: 57, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    6: { tempHighC: 17, tempHighF: 63, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    7: { tempHighC: 19, tempHighF: 66, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 18, tempHighF: 64, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    9: { tempHighC: 16, tempHighF: 61, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    10: { tempHighC: 13, tempHighF: 55, rainChance: "high", crowdLevel: "moderate", weatherEmoji: "🌧️" },
    11: { tempHighC: 9, tempHighF: 48, rainChance: "high", crowdLevel: "quiet", weatherEmoji: "🌧️" },
    12: { tempHighC: 7, tempHighF: 45, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "❄️" },
  },
  singapore: {
    1: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    2: { tempHighC: 31, tempHighF: 88, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    3: { tempHighC: 32, tempHighF: 90, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "☀️" },
    4: { tempHighC: 32, tempHighF: 90, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    5: { tempHighC: 32, tempHighF: 90, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    6: { tempHighC: 32, tempHighF: 90, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    7: { tempHighC: 31, tempHighF: 88, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 31, tempHighF: 88, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 31, tempHighF: 88, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "☀️" },
    10: { tempHighC: 32, tempHighF: 90, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    11: { tempHighC: 31, tempHighF: 88, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    12: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
  },
  seoul: {
    1: { tempHighC: 2, tempHighF: 36, rainChance: "low", crowdLevel: "quiet", weatherEmoji: "❄️" },
    2: { tempHighC: 4, tempHighF: 39, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "❄️" },
    3: { tempHighC: 10, tempHighF: 50, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    4: { tempHighC: 17, tempHighF: 63, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    5: { tempHighC: 23, tempHighF: 73, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "☀️" },
    6: { tempHighC: 27, tempHighF: 81, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    7: { tempHighC: 29, tempHighF: 84, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    8: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    9: { tempHighC: 26, tempHighF: 79, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "☀️" },
    10: { tempHighC: 19, tempHighF: 66, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    11: { tempHighC: 11, tempHighF: 52, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    12: { tempHighC: 4, tempHighF: 39, rainChance: "low", crowdLevel: "quiet", weatherEmoji: "❄️" },
  },
  goldcoast: {
    1: { tempHighC: 29, tempHighF: 84, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    2: { tempHighC: 29, tempHighF: 84, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    3: { tempHighC: 28, tempHighF: 82, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    4: { tempHighC: 26, tempHighF: 79, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    5: { tempHighC: 24, tempHighF: 75, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    6: { tempHighC: 22, tempHighF: 72, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    7: { tempHighC: 21, tempHighF: 70, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    8: { tempHighC: 22, tempHighF: 72, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    9: { tempHighC: 24, tempHighF: 75, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    10: { tempHighC: 25, tempHighF: 77, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    11: { tempHighC: 27, tempHighF: 81, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    12: { tempHighC: 28, tempHighF: 82, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
  },
  hongkong: {
    1: { tempHighC: 19, tempHighF: 66, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
    2: { tempHighC: 19, tempHighF: 66, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "☀️" },
    3: { tempHighC: 22, tempHighF: 72, rainChance: "medium", crowdLevel: "moderate", weatherEmoji: "⛅" },
    4: { tempHighC: 25, tempHighF: 77, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    5: { tempHighC: 28, tempHighF: 82, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    6: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    7: { tempHighC: 31, tempHighF: 88, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    8: { tempHighC: 31, tempHighF: 88, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    9: { tempHighC: 30, tempHighF: 86, rainChance: "high", crowdLevel: "busy", weatherEmoji: "🌧️" },
    10: { tempHighC: 28, tempHighF: 82, rainChance: "medium", crowdLevel: "busy", weatherEmoji: "⛅" },
    11: { tempHighC: 24, tempHighF: 75, rainChance: "low", crowdLevel: "moderate", weatherEmoji: "☀️" },
    12: { tempHighC: 20, tempHighF: 68, rainChance: "low", crowdLevel: "busy", weatherEmoji: "☀️" },
  },
};

// TODO: Add verified monthly rows for regions not listed above (germany, spain, etc.).

/** Map combo / alias region IDs to a conditions table. */
export function resolveConditionsRegionId(
  regionId: string | null | undefined,
): string | null {
  if (!regionId) return null;
  if (regionId === "florida_combo") return "orlando";
  if (regionId === "uk_combo") return "london";
  if (DESTINATION_CONDITIONS[regionId]) return regionId;
  return null;
}

export function getMonthlyConditions(
  regionId: string | null | undefined,
  month: number,
): MonthlyConditions | null {
  const key = resolveConditionsRegionId(regionId);
  if (!key) return null;
  const m = DESTINATION_CONDITIONS[key];
  if (!m) return null;
  return m[month] ?? null;
}
