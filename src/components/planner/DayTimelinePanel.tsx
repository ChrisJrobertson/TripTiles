"use client";

import {
  getParkIdFromSlotValue,
  getSlotTimeFromValue,
  minutesToHHmm,
  snapMinutesToHalfHour,
  timeToMinutes,
  SLOT_DEFAULT_DURATION_MIN,
} from "@/lib/assignment-slots";
import { parkChromaTileStyle } from "@/lib/theme-colours";
import { normaliseThemeKey, type ThemeKey } from "@/lib/themes";
import type { Assignment, Park, SlotType } from "@/lib/types";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

const FIRST_H = 8;
const LAST_H = 22;
const RANGE_MIN = (LAST_H - FIRST_H) * 60;

type Props = {
  day: Assignment;
  parks: Park[];
  colourTheme: ThemeKey;
  /** Pro+ can edit times (drag / picker). */
  unlocked: boolean;
  onTimeChange: (slot: SlotType, timeHHmm: string) => void;
};

const ORDER: SlotType[] = ["am", "lunch", "pm", "dinner"];

export function DayTimelinePanel({
  day,
  parks,
  colourTheme,
  unlocked,
  onTimeChange,
}: Props) {
  const themeKey = normaliseThemeKey(colourTheme);
  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);

  const blocks = useMemo(() => {
    return ORDER.map((slot) => {
      const raw = day[slot];
      const id = getParkIdFromSlotValue(raw);
      const park = id ? parkById.get(id) : undefined;
      const time = getSlotTimeFromValue(slot, raw);
      const startMin = timeToMinutes(time) - FIRST_H * 60;
      const dur = SLOT_DEFAULT_DURATION_MIN[slot];
      return { slot, park, time, startMin, dur, id };
    }).filter((b) => b.id);
  }, [day, parkById]);

  const [drag, setDrag] = useState<{
    slot: SlotType;
    startY: number;
    originMin: number;
  } | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);

  const pxToMinDelta = useCallback((dy: number) => {
    const h = trackRef.current?.clientHeight ?? 360;
    return (dy / h) * RANGE_MIN;
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag || !unlocked) return;
      const dy = e.clientY - drag.startY;
      const next = snapMinutesToHalfHour(
        drag.originMin + pxToMinDelta(dy),
      );
      const clamped = Math.max(0, Math.min(RANGE_MIN - 30, next));
      const absMin = FIRST_H * 60 + clamped;
      onTimeChange(drag.slot, minutesToHHmm(absMin));
    },
    [drag, onTimeChange, pxToMinDelta, unlocked],
  );

  const endDrag = useCallback(() => {
    setDrag(null);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const startDrag = (slot: SlotType, startY: number, originMin: number) => {
    if (!unlocked) return;
    setDrag({ slot, startY, originMin });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag, { once: true });
  };

  if (!unlocked) {
    return (
      <div className="rounded-lg border border-royal/15 bg-cream/80 p-3">
        <p className="font-sans text-xs text-royal/75">
          <span className="rounded bg-gold/25 px-1.5 py-0.5 text-[0.65rem] font-semibold text-royal">
            Pro feature
          </span>{" "}
          Timeline view with custom times is included on Pro and above.
        </p>
        <Link
          href="/pricing"
          className="mt-2 inline-flex min-h-[44px] items-center font-sans text-sm font-semibold text-royal underline"
        >
          See plans →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 font-sans text-[0.65rem] text-royal/60">
        Drag a block up or down to shift its start time (30-minute steps). Times
        save to your trip.
      </p>
      <div
        ref={trackRef}
        className="relative h-[22rem] rounded-lg border border-royal/10 bg-white/80"
      >
        {Array.from({ length: LAST_H - FIRST_H + 1 }, (_, i) => FIRST_H + i).map(
          (h) => (
            <div
              key={h}
              className="pointer-events-none absolute left-0 right-0 border-t border-royal/5"
              style={{ top: `${((h - FIRST_H) * 60) / RANGE_MIN * 100}%` }}
            >
              <span className="absolute left-1 top-0.5 font-mono text-[0.6rem] text-royal/45">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ),
        )}
        {blocks.map(({ slot, park, startMin, dur }) => {
          if (!park) return null;
          const top = (startMin / RANGE_MIN) * 100;
          const height = (dur / RANGE_MIN) * 100;
          return (
            <button
              key={slot}
              type="button"
              className="absolute left-10 right-2 flex flex-col overflow-hidden rounded-lg border border-royal/10 text-left shadow-sm"
              style={{
                top: `${top}%`,
                height: `${Math.max(height, 6)}%`,
                ...parkChromaTileStyle(park.bg_colour, park.fg_colour, themeKey),
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                startDrag(slot, e.clientY, startMin);
              }}
            >
              <span className="truncate px-1.5 pt-1 font-sans text-[0.65rem] font-semibold leading-tight">
                {park.icon ? `${park.icon} ` : ""}
                {park.name}
              </span>
              <span className="mt-auto px-1.5 pb-1 font-mono text-[0.55rem] opacity-80">
                {getSlotTimeFromValue(slot, day[slot])}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 space-y-2 md:hidden">
        {blocks.map(({ slot, park }) =>
          park ? (
            <label
              key={`m-${slot}`}
              className="flex items-center gap-2 font-sans text-xs text-royal"
            >
              <span className="w-14 shrink-0 font-semibold uppercase">
                {slot}
              </span>
              <input
                type="time"
                step={1800}
                className="min-h-[44px] flex-1 rounded border border-royal/20 px-2"
                value={getSlotTimeFromValue(slot, day[slot])}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onTimeChange(slot, v.slice(0, 5));
                }}
              />
            </label>
          ) : null,
        )}
      </div>
    </div>
  );
}
