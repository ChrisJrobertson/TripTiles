"use client";

import { parseDate } from "@/lib/date-helpers";
import type { Trip } from "@/lib/types";
import { useEffect, useState } from "react";

type Props = {
  trip: Trip | null;
  /** Compact one-line chip for the trip header row. */
  variant?: "card" | "inline";
};

function daysUntil(iso: string): number {
  const t = parseDate(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = t.getTime() - start.getTime();
  return Math.ceil(diff / 86400000);
}

function buildItems(d: number): { title: string; hint: string }[] {
  const out: { title: string; hint: string }[] = [];
  if (d > 90) {
    out.push({
      title: "Booking window",
      hint: "Research flights and resort — no rush yet.",
    });
  } else if (d > 30) {
    out.push({
      title: "Dining & extras",
      hint: "Many table-service venues open ~60 days ahead — set reminders.",
    });
  } else if (d > 7) {
    out.push({
      title: "Final stretch",
      hint: "Confirm park reservations, check refurb schedules, pack lists.",
    });
  } else if (d >= 0) {
    out.push({
      title: "Almost go time",
      hint: "Double-check official park hours and weather the day before.",
    });
  } else {
    out.push({
      title: "On holiday",
      hint: "Enjoy — tweak the calendar anytime for your next visit.",
    });
  }
  return out;
}

function buildLabel(d: number): string {
  if (d < 0) return "Trip in progress or past";
  if (d === 0) return "Starts today";
  if (d === 1) return "Starts tomorrow";
  return `Starts in ${d} days`;
}

/** Computes “today”-relative copy after mount so SSR and first client paint match (avoids React #418). */
export function TripTimeline({ trip, variant = "card" }: Props) {
  const [ready, setReady] = useState(false);
  const [d, setD] = useState(0);

  useEffect(() => {
    if (!trip?.start_date) return;
    setD(daysUntil(trip.start_date));
    setReady(true);
  }, [trip?.start_date]);

  if (!trip?.start_date) return null;

  if (!ready) {
    if (variant === "inline") {
      return (
        <div className="max-w-xl rounded-lg border border-royal/10 bg-cream/60 px-3 py-2 font-sans text-xs leading-snug text-royal/85">
          <span className="invisible" aria-hidden>
            Starts in 0 days
          </span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-royal/10 bg-white/80 px-4 py-3 font-sans text-sm text-royal shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">
          Timeline
        </p>
        <p className="invisible mt-1 font-medium" aria-hidden>
          Placeholder
        </p>
      </div>
    );
  }

  const items = buildItems(d);
  if (items.length === 0) return null;

  const label = buildLabel(d);
  const first = items[0];
  if (!first) return null;

  if (variant === "inline") {
    return (
      <div className="max-w-xl rounded-lg border border-royal/10 bg-cream/60 px-3 py-2 font-sans text-xs leading-snug text-royal/85">
        <span className="font-semibold text-royal">{label}</span>
        <span className="mx-1.5 text-royal/30" aria-hidden>
          ·
        </span>
        <span className="text-royal/75">{first.title}</span>
        <span className="text-royal/55"> — {first.hint}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-royal/10 bg-white/80 px-4 py-3 font-sans text-sm text-royal shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold">
        Timeline
      </p>
      <p className="mt-1 font-medium text-royal">{label}</p>
      {items.map((it) => (
        <p key={it.title} className="mt-2 text-royal/75">
          <span className="font-semibold text-royal/90">{it.title}. </span>
          {it.hint}
        </p>
      ))}
    </div>
  );
}
