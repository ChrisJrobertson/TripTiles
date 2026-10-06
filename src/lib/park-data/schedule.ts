import { classifyFreshness } from "@/lib/park-data/freshness";
import type {
  ProvenanceKind,
  ScheduleKind,
} from "@/lib/park-data/types";
import { SYNTHETIC_THEME_PARK_HOURS } from "@/lib/planner/day-times";

export type NormalisedScheduleEntry = {
  parkId: string | null;
  provider: string;
  operatingDate: string;
  opensAt: string | null;
  closesAt: string | null;
  scheduleKind: ScheduleKind;
  timezone: string | null;
  provenanceKind: ProvenanceKind;
  observedAt: string | null;
  fetchedAt: string | null;
  staleAfter: string | null;
  description: string | null;
};

export type OperatingWindowSource =
  | "authoritative_schedule"
  | "stored_schedule"
  | "catalogue_hours"
  | "fallback_assumption"
  | "unknown";

export type SpecialHour = {
  kind: ScheduleKind;
  open: string;
  close: string;
  description: string | null;
  provider: string;
};

export type OperatingWindowResolution = {
  source: OperatingWindowSource;
  provenanceKind: ProvenanceKind;
  open: string | null;
  close: string | null;
  openMinutes: number | null;
  closeMinutes: number | null;
  timezone: string | null;
  provider: string | null;
  label: string;
  specialHours: SpecialHour[];
  earlyEntry: { open: string; close: string } | null;
};

export type CatalogueHours = {
  parkId: string;
  opensAt: string | null;
  closesAt: string | null;
  hoursKnown: boolean;
};

const FALLBACK_OPEN = SYNTHETIC_THEME_PARK_HOURS.open;
const FALLBACK_CLOSE = SYNTHETIC_THEME_PARK_HOURS.close;

/** Minutes from midnight. Hours 00–30 cover a posted close after midnight. */
export function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 30 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesToHhmm(total: number): string | null {
  if (!Number.isFinite(total) || total < 0 || total > 30 * 60) return null;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dayDiff(fromDate: string, toDate: string): number | null {
  const start = Date.parse(`${fromDate}T00:00:00Z`);
  const end = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

/**
 * Wall-clock time in the timestamp's own offset, shifted when the close falls
 * on the next park-local date. This does not convert through the server timezone.
 */
export function parkLocalHHmm(iso: string, operatingDate: string): string | null {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      iso.trim(),
    );
  if (!match) return null;
  const date = match[1]!;
  let hour = Number(match[2]);
  const minute = Number(match[3]);
  const diff = dayDiff(operatingDate, date);
  if (diff == null || diff < 0 || diff > 1) return null;
  hour += diff * 24;
  if (hour > 30 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function emptyResolution(
  source: OperatingWindowSource,
  provenanceKind: ProvenanceKind,
  label: string,
  specialHours: SpecialHour[] = [],
): OperatingWindowResolution {
  return {
    source,
    provenanceKind,
    open: null,
    close: null,
    openMinutes: null,
    closeMinutes: null,
    timezone: null,
    provider: null,
    label,
    specialHours,
    earlyEntry: null,
  };
}

function specialsFrom(
  entries: readonly NormalisedScheduleEntry[],
): { specialHours: SpecialHour[]; earlyEntry: { open: string; close: string } | null } {
  const specialHours: SpecialHour[] = [];
  let earlyEntry: { open: string; close: string } | null = null;
  for (const entry of entries) {
    if (entry.scheduleKind === "operating") continue;
    if (!entry.opensAt || !entry.closesAt) continue;
    specialHours.push({
      kind: entry.scheduleKind,
      open: entry.opensAt,
      close: entry.closesAt,
      description: entry.description,
      provider: entry.provider,
    });
    if (entry.scheduleKind === "early_entry" && !earlyEntry) {
      earlyEntry = { open: entry.opensAt, close: entry.closesAt };
    }
  }
  return { specialHours, earlyEntry };
}

function chooseOperating(
  entries: readonly NormalisedScheduleEntry[],
  preferredProvider: string,
): NormalisedScheduleEntry | null {
  const operating = entries.filter(
    (entry) =>
      entry.scheduleKind === "operating" &&
      entry.opensAt &&
      entry.closesAt &&
      (hhmmToMinutes(entry.opensAt) ?? -1) < (hhmmToMinutes(entry.closesAt) ?? -1),
  );
  if (operating.length === 0) return null;
  const preferred = operating.filter((entry) => entry.provider === preferredProvider);
  const pool = preferred.length > 0 ? preferred : operating;
  return [...pool].sort((a, b) => {
    const af = a.fetchedAt ? Date.parse(a.fetchedAt) : 0;
    const bf = b.fetchedAt ? Date.parse(b.fetchedAt) : 0;
    return bf - af;
  })[0] ?? null;
}

export function resolveOperatingWindow(input: {
  date: string;
  schedules: readonly NormalisedScheduleEntry[];
  catalogue: CatalogueHours | null;
  preferredProvider: string;
  now?: Date;
}): OperatingWindowResolution {
  const dated = input.schedules.filter((entry) => entry.operatingDate === input.date);
  const { specialHours, earlyEntry } = specialsFrom(dated);

  if (dated.length > 0) {
    const operating = chooseOperating(dated, input.preferredProvider);
    if (!operating || !operating.opensAt || !operating.closesAt) {
      return {
        ...emptyResolution(
          "unknown",
          "AUTHORITATIVE_FACT",
          "This date was published without a regular operating window. No fallback hours were applied.",
          specialHours,
        ),
        timezone: dated.find((entry) => entry.timezone)?.timezone ?? null,
        provider: dated[0]?.provider ?? null,
        earlyEntry,
      };
    }
    const openMinutes = hhmmToMinutes(operating.opensAt);
    const closeMinutes = hhmmToMinutes(operating.closesAt);
    const freshness = classifyFreshness({
      observedAt: operating.observedAt ?? operating.fetchedAt,
      fetchedAt: operating.fetchedAt,
      staleAfter: operating.staleAfter,
      now: input.now,
    });
    const fresh = freshness === "LIVE" || freshness === "RECENT";
    const label = fresh
      ? `Posted hours ${operating.opensAt}–${operating.closesAt}.`
      : `Stored schedule ${operating.opensAt}–${operating.closesAt} is past its freshness window. Not a live confirmation.`;
    return {
      source: fresh ? "authoritative_schedule" : "stored_schedule",
      provenanceKind: fresh ? "AUTHORITATIVE_FACT" : "HISTORICAL_OBSERVATION",
      open: operating.opensAt,
      close: operating.closesAt,
      openMinutes,
      closeMinutes,
      timezone: operating.timezone,
      provider: operating.provider,
      label,
      specialHours,
      earlyEntry,
    };
  }

  const catalogue = input.catalogue;
  if (
    catalogue?.hoursKnown &&
    catalogue.opensAt &&
    catalogue.closesAt
  ) {
    const openMinutes = hhmmToMinutes(catalogue.opensAt);
    const closeMinutes = hhmmToMinutes(catalogue.closesAt);
    if (
      openMinutes != null &&
      closeMinutes != null &&
      openMinutes < closeMinutes
    ) {
      return {
        source: "catalogue_hours",
        provenanceKind: "AUTHORITATIVE_FACT",
        open: catalogue.opensAt,
        close: catalogue.closesAt,
        openMinutes,
        closeMinutes,
        timezone: null,
        provider: null,
        label: `Catalogue hours ${catalogue.opensAt}–${catalogue.closesAt}. Not this date's posted schedule.`,
        specialHours: [],
        earlyEntry: null,
      };
    }
  }

  const openMinutes = hhmmToMinutes(FALLBACK_OPEN);
  const closeMinutes = hhmmToMinutes(FALLBACK_CLOSE);
  return {
    source: "fallback_assumption",
    provenanceKind: "FALLBACK_ASSUMPTION",
    open: FALLBACK_OPEN,
    close: FALLBACK_CLOSE,
    openMinutes,
    closeMinutes,
    timezone: null,
    provider: null,
    label: `Fallback assumption ${FALLBACK_OPEN}–${FALLBACK_CLOSE}. Not a confirmed operating time.`,
    specialHours: [],
    earlyEntry: null,
  };
}

/**
 * Minutes passed into the deterministic sequencer.
 * Early entry moves the start only when it meets the posted open.
 */
export function sequencerMinutesFromResolution(
  resolution: OperatingWindowResolution,
  opts: { hasEarlyEntry: boolean },
): { openMinutes: number; closeMinutes: number; usedEarlyEntry: boolean } | null {
  if (resolution.source === "unknown") return null;
  if (resolution.openMinutes == null || resolution.closeMinutes == null) return null;
  let open = resolution.openMinutes;
  let usedEarlyEntry = false;
  if (opts.hasEarlyEntry && resolution.earlyEntry) {
    const earlyOpen = hhmmToMinutes(resolution.earlyEntry.open);
    const earlyClose = hhmmToMinutes(resolution.earlyEntry.close);
    if (
      earlyOpen != null &&
      earlyClose != null &&
      earlyOpen < open &&
      open - earlyClose <= 30 &&
      earlyOpen < resolution.closeMinutes
    ) {
      open = earlyOpen;
      usedEarlyEntry = true;
    }
  }
  if (open >= resolution.closeMinutes) return null;
  return {
    openMinutes: open,
    closeMinutes: resolution.closeMinutes,
    usedEarlyEntry,
  };
}
