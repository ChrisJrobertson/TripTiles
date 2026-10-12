"use client";

import { orlandoIdentityByParkId } from "@/lib/park-data/orlando-parks";
import { useEffect, useMemo, useState } from "react";

type ParkFact = {
  parkId: string;
  parkName: string;
  hours: string | null;
  hoursKind: "Posted" | "Stored" | "TYPICAL" | "ESTIMATE" | "Unknown";
  hoursDetail: string;
  providerLabel: string | null;
  closed: boolean;
  waits: {
    count: number;
    freshness: "LIVE" | "NOT_CURRENT" | "NONE";
    providerLabel: string | null;
    observedAt: string | null;
  };
};

function supportedIds(parkIds: string[]): string[] {
  return [...new Set(parkIds.filter(Boolean))].filter((id) => {
    const row = orlandoIdentityByParkId(id);
    return Boolean(row?.themeParksWikiId || row?.queueTimesId);
  });
}

function observedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    timeZone: "America/New_York",
  }).format(new Date(time));
}

/**
 * Short factual context for a supported Orlando park day.
 * Hours and waits come from stored provider facts. A fallback window is labelled ESTIMATE.
 */
export function ParkDayFacts({
  parkIds,
  date,
}: {
  parkIds: string[];
  date: string;
}) {
  const ids = useMemo(() => supportedIds(parkIds), [parkIds]);
  const key = ids.join(",");
  const [parks, setParks] = useState<ParkFact[]>([]);

  useEffect(() => {
    if (!key || !date) {
      setParks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/park-data/day-facts?park_ids=${encodeURIComponent(key)}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { parks?: ParkFact[] };
        if (!cancelled) setParks(res.ok ? (json.parks ?? []) : []);
      } catch {
        if (!cancelled) setParks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, date]);

  if (parks.length === 0) return null;

  const showThemeParks = parks.some(
    (park) =>
      park.providerLabel === "ThemeParks.wiki" ||
      park.waits.providerLabel?.includes("ThemeParks.wiki"),
  );
  const showQueueTimes = parks.some((park) =>
    park.waits.providerLabel?.includes("Queue-Times"),
  );

  return (
    <section className="mt-3 rounded-lg border border-royal/12 bg-white/80 px-3 py-2 font-sans text-[11px] leading-relaxed text-royal/80">
      {parks.map((park) => {
        const observed = observedLabel(park.waits.observedAt);
        const waitLine =
          park.waits.freshness === "LIVE"
            ? `Waits · LIVE · ${park.waits.count} attractions${park.waits.providerLabel ? ` · ${park.waits.providerLabel}` : ""}`
            : park.waits.freshness === "NOT_CURRENT"
              ? `Waits · not current${observed ? ` · last observed ${observed} ET` : ""}${park.waits.providerLabel ? ` · ${park.waits.providerLabel}` : ""}`
              : "Waits · none stored";
        const hoursLine = park.closed
          ? `Hours · Unknown · ${park.hoursDetail}`
          : `Hours ${park.hours ?? "unavailable"} · ${park.hoursKind}${park.providerLabel ? ` · ${park.providerLabel}` : ""}`;
        return (
          <p key={park.parkId}>
            <span className="font-semibold text-royal">{park.parkName}. </span>
            {hoursLine}. {waitLine}.
          </p>
        );
      })}
      {showThemeParks || showQueueTimes ? (
        <p className="mt-1 text-royal/55">
          {showThemeParks ? (
            <a
              href="https://themeparks.wiki/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-royal underline decoration-gold/40 underline-offset-2"
            >
              Powered by ThemeParks.wiki
            </a>
          ) : null}
          {showThemeParks && showQueueTimes ? " · " : null}
          {showQueueTimes ? (
            <a
              href="https://queue-times.com/en-US"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-royal underline decoration-gold/40 underline-offset-2"
            >
              Powered by Queue-Times.com
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
