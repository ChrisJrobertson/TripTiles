"use client";

import {
  getRidePrioritiesForTrip,
  updateRidePriorityMeta,
} from "@/actions/ride-priorities";
import {
  collectBookingAnchors,
  type BookingAnchor,
} from "@/lib/booking-anchor-risk";
import type { Park } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Live ride rows for a trip + optional client refresh; enriches anchors with park names.
 */
export function useBookingAnchors(
  tripId: string | null,
  date: string,
  parks: Park[],
): {
  anchors: BookingAnchor[];
  clearAnchor: (attractionId: string) => Promise<void>;
  clearAllAnchors: () => Promise<void>;
} {
  const [rows, setRows] = useState<Awaited<
    ReturnType<typeof getRidePrioritiesForTrip>
  > | null>(null);
  const parkById = useMemo(
    () => new Map(parks.map((p) => [p.id, p] as const)),
    [parks],
  );

  useEffect(() => {
    if (!tripId) {
      setRows(null);
      return;
    }
    let c = false;
    void (async () => {
      try {
        const all = await getRidePrioritiesForTrip(tripId);
        if (!c) setRows(all);
      } catch {
        if (!c) setRows([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [tripId]);

  const dayRows = useMemo(
    () => (rows ?? []).filter((r) => r.day_date === date),
    [rows, date],
  );

  const anchors = useMemo(
    () => collectBookingAnchors(dayRows, parkById),
    [dayRows, parkById],
  );

  const clearAnchor = useCallback(
    async (attractionId: string) => {
      if (!tripId) return;
      await updateRidePriorityMeta(tripId, attractionId, date, {
        skipLineReturnHhmm: null,
      });
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.attraction_id === attractionId && r.day_date === date
                ? { ...r, skip_line_return_hhmm: null }
                : r,
            )
          : prev,
      );
    },
    [tripId, date],
  );

  const clearAllAnchors = useCallback(async () => {
    if (!tripId) return;
    const list = collectBookingAnchors(dayRows, parkById);
    await Promise.all(
      list.map((a) =>
        updateRidePriorityMeta(tripId, a.attractionId, date, {
          skipLineReturnHhmm: null,
        }),
      ),
    );
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.day_date === date && r.skip_line_return_hhmm
              ? { ...r, skip_line_return_hhmm: null }
              : r,
          )
        : prev,
    );
  }, [tripId, date, dayRows, parkById]);

  return { anchors, clearAnchor, clearAllAnchors };
}
