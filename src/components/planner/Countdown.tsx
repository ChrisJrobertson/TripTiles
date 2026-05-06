"use client";

import { parseDate } from "@/lib/date-helpers";
import { useEffect, useState } from "react";

type Props = {
  startDate: string;
  endDate: string;
};

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Client-only countdown so SSR and hydration use the same initial markup (avoids React #418). */
export function Countdown({ startDate, endDate }: Props) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const today = new Date();
    const t0 = stripTime(today);
    const s0 = stripTime(start);
    const e0 = stripTime(end);

    if (t0 > e0) {
      setLine("");
      return;
    }

    if (t0 >= s0 && t0 <= e0) {
      setLine("holiday");
      return;
    }

    const days = Math.round((s0 - t0) / 86400000);

    if (days > 1) {
      setLine(`✨ ${days} days until your adventure! ✨`);
    } else if (days === 1) {
      setLine("✨ Tomorrow! ✨");
    } else if (days === 0) {
      setLine("✨ TODAY! Have a magical time! ✨");
    } else {
      setLine("");
    }
  }, [startDate, endDate]);

  if (line === null) {
    return (
      <p
        className="text-center font-sans text-sm font-semibold text-tt-magic"
        aria-busy="true"
      >
        <span className="inline-block min-h-[1.5em]" aria-hidden>
          {"\u00a0"}
        </span>
      </p>
    );
  }

  if (line === "") {
    return null;
  }

  if (line === "holiday") {
    return (
      <p className="text-center font-sans text-sm font-semibold text-tt-magic">
        ✨ Enjoying your holiday! ✨
      </p>
    );
  }

  return (
    <p className="text-center font-sans text-sm font-semibold text-tt-magic">
      {line}
    </p>
  );
}
