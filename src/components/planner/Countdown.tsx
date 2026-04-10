"use client";

import { parseDate } from "@/lib/date-helpers";

type Props = {
  startDate: string;
  endDate: string;
};

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function Countdown({ startDate, endDate }: Props) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const today = new Date();
  const t0 = stripTime(today);
  const s0 = stripTime(start);
  const e0 = stripTime(end);

  if (t0 > e0) {
    return null;
  }

  if (t0 >= s0 && t0 <= e0) {
    return (
      <p className="text-center text-base font-bold italic text-magic">
        ✨ Enjoying your holiday! ✨
      </p>
    );
  }

  const days = Math.round((s0 - t0) / 86400000);

  let line: string;
  if (days > 1) {
    line = `✨ ${days} days until your adventure! ✨`;
  } else if (days === 1) {
    line = "✨ Tomorrow! ✨";
  } else if (days === 0) {
    line = "✨ TODAY! Have a magical time! ✨";
  } else {
    return null;
  }

  return (
    <p className="text-center text-base font-bold italic text-magic">{line}</p>
  );
}
