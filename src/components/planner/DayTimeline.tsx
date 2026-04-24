"use client";

import type { ReactNode } from "react";
import { getSlotTimeFromValue, getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { SkipLineDayTimelineRow } from "@/lib/skip-line-day-timeline";
import type {
  AiDayTimeline,
  AiDayTimelineBlock,
  AiDayTimelineRowTag,
  Assignment,
  Park,
  SlotType,
} from "@/lib/types";

function parseHhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + m));
}

function formatMinToHhmm(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function addMin(hhmm: string, delta: number): string {
  return formatMinToHhmm(parseHhmmToMin(hhmm) + delta);
}

function subMin(hhmm: string, delta: number): string {
  return formatMinToHhmm(parseHhmmToMin(hhmm) - delta);
}

/**
 * v1 timeline display times (defaults match Smart Plan prompt). Custom `time` on
 * slot objects still wins. AM follows park gate open.
 */
function displayTimelineSlotTime(
  slot: SlotType,
  ass: Assignment,
  parkOpen: string,
): string {
  const v = ass[slot];
  if (v && typeof v === "object" && typeof v.time === "string" && v.time.trim()) {
    return getSlotTimeFromValue(slot, v);
  }
  if (slot === "am") return parkOpen;
  if (slot === "lunch") return "12:30";
  if (slot === "pm") return "14:00";
  if (slot === "dinner") return "18:30";
  return getSlotTimeFromValue(slot, v);
}

function isDiningStylePark(park: Park | undefined): boolean {
  if (!park) return false;
  if (park.park_group === "dining") return true;
  return /🍽|🥂|🍴/u.test(park.icon ?? "");
}

function isoLocalDateTime(dateKey: string, hhmm: string): string {
  return `${dateKey}T${hhmm}:00`;
}

const RICH_BLOCK_SECTIONS: {
  key: AiDayTimelineBlock;
  label: string;
  edge: "royal" | "gold";
}[] = [
  { key: "morning", label: "Morning", edge: "royal" },
  { key: "lunch", label: "Lunch", edge: "gold" },
  { key: "afternoon", label: "Afternoon", edge: "royal" },
  { key: "dinner", label: "Dinner", edge: "gold" },
  { key: "evening", label: "Evening", edge: "royal" },
];

function tagPillClass(tag: AiDayTimelineRowTag): string {
  switch (tag) {
    case "priority":
      return "bg-[#F5C4B3] text-[#712B13]";
    case "show":
      return "bg-[#CECBF6] text-[#3C3489]";
    case "adr":
      return "bg-[#FAC775] text-[#633806]";
    case "break":
    case "transport":
    default:
      return "bg-[#D3D1C7] text-[#444441]";
  }
}

function TagPill({ tag }: { tag: AiDayTimelineRowTag }) {
  return (
    <span
      className={`ml-2 inline align-middle rounded-md px-2 py-0.5 font-sans text-[11px] font-medium capitalize ${tagPillClass(
        tag,
      )}`}
    >
      {tag}
    </span>
  );
}

export type DayTimelineProps = {
  date: string;
  assignments: Assignment;
  parks: Record<string, Park | undefined>;
  dayNotes?: string;
  parkHoursOpen?: string;
  parkHoursClose?: string;
  /** AI hour-by-hour plan; when set, drives the timeline instead of slot defaults. */
  richTimeline?: AiDayTimeline | null;
  /** Guest skip-line return rows (from ride priorities) with optional clash hints. */
  skipLineReturnRows?: SkipLineDayTimelineRow[] | null;
};

function SkipLineReturnSection({
  date,
  rows,
}: {
  date: string;
  rows: SkipLineDayTimelineRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-4 border-l-2 border-amber-400/90 pl-3">
      <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.5px] text-amber-900/90 dark:text-amber-200/90">
        Skip-the-line (guest)
      </h3>
      <div className="mt-2 space-y-3">
        {rows.map((r, i) => (
          <div key={`${r.time}-${i}`} className="grid grid-cols-[54px_1fr] items-start gap-3">
            <time
              className="pt-0.5 font-sans text-xs font-medium tabular-nums text-royal/70 dark:text-neutral-300/90"
              dateTime={isoLocalDateTime(date, r.time)}
            >
              {r.time}
            </time>
            <div>
              <p
                className={`font-sans text-sm font-medium ${
                  r.warn ? "text-amber-900 dark:text-amber-200" : "text-royal dark:text-neutral-100"
                }`}
              >
                {r.title}
              </p>
              {r.subtitle ? (
                <p className="mt-0.5 font-sans text-xs text-royal/65 dark:text-neutral-300/80">
                  {r.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DayTimeline({
  date,
  assignments: ass,
  parks,
  dayNotes,
  parkHoursOpen = "09:00",
  parkHoursClose = "22:00",
  richTimeline,
  skipLineReturnRows = null,
}: DayTimelineProps) {
  if (richTimeline && richTimeline.timeline.length > 0) {
    const border = { royal: "border-royal", gold: "border-gold" } as const;
    function Row({
      time,
      children,
    }: {
      time: string;
      children: ReactNode;
    }) {
      return (
        <div className="grid grid-cols-[54px_1fr] items-start gap-3">
          <time
            className="pt-0.5 font-sans text-xs font-medium tabular-nums text-royal/70 dark:text-neutral-300/90"
            dateTime={isoLocalDateTime(date, time)}
          >
            {time}
          </time>
          <div className="min-w-0 text-sm leading-snug text-royal dark:text-neutral-100">
            {children}
          </div>
        </div>
      );
    }
    return (
      <section
        id="tt-day-timeline"
        className="rounded-lg border border-royal/10 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900/30"
        aria-label="Planned day timeline"
      >
        {skipLineReturnRows && skipLineReturnRows.length > 0 ? (
          <SkipLineReturnSection date={date} rows={skipLineReturnRows} />
        ) : null}
        <div className="space-y-5">
          {RICH_BLOCK_SECTIONS.map((sec) => {
            const rows = richTimeline.timeline
              .filter((r) => r.block === sec.key)
              .sort(
                (a, b) => parseHhmmToMin(a.time) - parseHhmmToMin(b.time),
              );
            if (rows.length === 0) return null;
            return (
              <div
                key={sec.key}
                className={`border-l-2 ${border[sec.edge]} pl-3`}
                style={{ borderRadius: 0 }}
              >
                <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/80 dark:text-neutral-200/90">
                  {sec.label}
                </h3>
                <div className="mt-2 space-y-3">
                  {rows.map((r, i) => (
                    <Row key={`${r.time}-${i}`} time={r.time}>
                      <p className="font-sans font-medium">
                        {r.title}
                        {r.tag ? <TagPill tag={r.tag} /> : null}
                      </p>
                      {r.subtitle ? (
                        <p className="mt-0.5 font-sans text-xs text-royal/60 dark:text-neutral-300/80">
                          {r.subtitle}
                        </p>
                      ) : null}
                    </Row>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const hasAny = (
    [
      getParkIdFromSlotValue(ass.am),
      getParkIdFromSlotValue(ass.pm),
      getParkIdFromSlotValue(ass.lunch),
      getParkIdFromSlotValue(ass.dinner),
    ] as (string | undefined)[]
  ).some(Boolean);

  if (!hasAny) return null;

  const open = parkHoursOpen;
  const close = parkHoursClose;

  const amId = getParkIdFromSlotValue(ass.am);
  const amTime = amId ? displayTimelineSlotTime("am", ass, open) : open;
  const ropeTime = amId ? subMin(amTime, 30) : null;

  const pmId = getParkIdFromSlotValue(ass.pm);
  const dinnerId = getParkIdFromSlotValue(ass.dinner);
  const dinnerTime = dinnerId
    ? displayTimelineSlotTime("dinner", ass, open)
    : null;

  let returnTime: string | null = null;
  if (pmId) {
    returnTime = subMin(close, 30);
  } else if (dinnerId && dinnerTime) {
    returnTime = addMin(dinnerTime, 30);
  }

  const border = {
    royal: "border-royal",
    gold: "border-gold",
  } as const;

  function Row({
    time,
    children,
  }: {
    time: string;
    children: ReactNode;
  }) {
    return (
      <div className="grid grid-cols-[54px_1fr] items-start gap-3">
        <time
          className="pt-0.5 font-sans text-xs font-medium tabular-nums text-royal/70 dark:text-neutral-300/90"
          dateTime={isoLocalDateTime(date, time)}
        >
          {time}
        </time>
        <div className="min-w-0 text-sm leading-snug text-royal dark:text-neutral-100">
          {children}
        </div>
      </div>
    );
  }

  return (
    <section
      id="tt-day-timeline"
      className="rounded-lg border border-royal/10 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900/30"
      aria-label="Planned day timeline"
    >
      {dayNotes ? (
        <p className="mb-4 font-sans text-sm leading-relaxed text-royal/75 dark:text-neutral-200/90">
          {dayNotes}
        </p>
      ) : null}

      {skipLineReturnRows && skipLineReturnRows.length > 0 ? (
        <SkipLineReturnSection date={date} rows={skipLineReturnRows} />
      ) : null}

      <div className="space-y-5">
        {amId ? (
          <div
            className={`border-l-2 ${border.royal} pl-3`}
            style={{ borderRadius: 0 }}
          >
            <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/80 dark:text-neutral-200/90">
              Morning
            </h3>
            <div className="mt-2 space-y-3">
              {ropeTime ? (
                <Row time={ropeTime}>
                  <span className="font-sans font-medium">Rope drop</span>
                  <p className="mt-0.5 font-sans text-xs text-royal/60 dark:text-neutral-300/80">
                    Arrive in time for park opening and security.
                  </p>
                </Row>
              ) : null}
              {amId
                ? (() => {
                    const park = parks[amId];
                    if (!park) {
                      return (
                        <Row time={amTime}>
                          <span className="font-sans font-medium">Park</span>
                        </Row>
                      );
                    }
                    const adr = isDiningStylePark(park);
                    return (
                      <Row time={amTime}>
                        <p className="font-sans font-medium">
                          {park.icon ? `${park.icon} ` : null}
                          {park.name}
                          {adr ? (
                            <span
                              className="ml-2 inline align-middle rounded-md bg-[#FAC775] px-2 py-0.5 font-sans text-[11px] font-medium text-[#633806]"
                              title="Meal or dining reservation to confirm"
                            >
                              ADR
                            </span>
                          ) : null}
                        </p>
                      </Row>
                    );
                  })()
                : null}
            </div>
          </div>
        ) : null}

        {(["lunch", "pm", "dinner"] as const).map((key) => {
          const id = getParkIdFromSlotValue(ass[key]);
          if (!id) return null;
          const park = parks[id];
          if (!park) {
            return (
              <div
                key={key}
                className={`border-l-2 ${key === "lunch" || key === "dinner" ? border.gold : border.royal} pl-3`}
                style={{ borderRadius: 0 }}
              >
                <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/80 dark:text-neutral-200/90">
                  {key === "lunch"
                    ? "Lunch"
                    : key === "pm"
                      ? "Afternoon"
                      : "Dinner"}
                </h3>
                <div className="mt-2">
                  <Row time={displayTimelineSlotTime(key, ass, open)}>
                    <span className="font-sans font-medium">Unknown park</span>
                  </Row>
                </div>
              </div>
            );
          }
          const t = displayTimelineSlotTime(key, ass, open);
          const adr = isDiningStylePark(park);
          const label =
            key === "lunch" ? "Lunch" : key === "pm" ? "Afternoon" : "Dinner";
          const b = key === "lunch" || key === "dinner" ? "gold" : "royal";
          return (
            <div
              key={key}
              className={`border-l-2 ${border[b]} pl-3`}
              style={{ borderRadius: 0 }}
            >
              <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/80 dark:text-neutral-200/90">
                {label}
              </h3>
              <div className="mt-2">
                <Row time={t}>
                  <p className="font-sans font-medium">
                    {park.icon ? `${park.icon} ` : null}
                    {park.name}
                    {adr ? (
                      <span
                        className="ml-2 inline align-middle rounded-md bg-[#FAC775] px-2 py-0.5 font-sans text-[11px] font-medium text-[#633806]"
                        title="Meal or dining reservation to confirm"
                      >
                        ADR
                      </span>
                    ) : null}
                  </p>
                </Row>
              </div>
            </div>
          );
        })}

        {returnTime ? (
          <div
            className={`border-l-2 ${border.royal} pl-3`}
            style={{ borderRadius: 0 }}
          >
            <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/80 dark:text-neutral-200/90">
              Evening
            </h3>
            <div className="mt-2">
              <Row time={returnTime}>
                <span className="font-sans font-medium">Return to resort</span>
                <p className="mt-0.5 font-sans text-xs text-royal/60 dark:text-neutral-300/80">
                  {pmId
                    ? "Head back before the park winds down for the night."
                    : "After dinner, wind down at your resort."}
                </p>
              </Row>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
