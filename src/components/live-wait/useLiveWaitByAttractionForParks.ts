"use client";

import type { LiveWaitPublicItem } from "@/lib/live-wait/public-types";
import { useEffect, useMemo, useState } from "react";

type State =
  | { status: "idle" | "loading"; map: Map<string, LiveWaitPublicItem>; showAttribution: boolean }
  | {
      status: "ready" | "error";
      map: Map<string, LiveWaitPublicItem>;
      showAttribution: boolean;
    };

export function useLiveWaitByAttractionForParks(parkIds: string[]) {
  const sortedKey = useMemo(
    () => [...new Set(parkIds.filter(Boolean))].sort().join(","),
    [parkIds],
  );

  const [state, setState] = useState<State>({
    status: "idle",
    map: new Map(),
    showAttribution: false,
  });

  useEffect(() => {
    if (!sortedKey) {
      setState({ status: "ready", map: new Map(), showAttribution: false });
      return;
    }

    let cancelled = false;
    setState((s) => ({
      ...s,
      status: "loading",
    }));

    (async () => {
      try {
        const res = await fetch(
          `/api/live-wait/current?park_ids=${encodeURIComponent(sortedKey)}`,
          { method: "GET", cache: "no-store" },
        );
        const json = (await res.json()) as {
          items?: LiveWaitPublicItem[];
          showQueueTimesAttribution?: boolean;
        };
        const m = new Map<string, LiveWaitPublicItem>();
        for (const it of json.items ?? []) {
          if (it.attraction_id) m.set(it.attraction_id, it);
        }
        if (!cancelled) {
          setState({
            status: res.ok ? "ready" : "error",
            map: m,
            showAttribution: Boolean(json.showQueueTimesAttribution),
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            map: new Map(),
            showAttribution: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sortedKey]);

  return state;
}
