"use client";

import {
  buildTripStatsShareText,
  computeTripStats,
  type TripStatsSummary,
} from "@/lib/compute-trip-stats";
import { copyTextToClipboard } from "@/lib/clipboard-access";
import { currencyApproximationText, formatMoney } from "@/lib/format";
import type { Park, Trip } from "@/lib/types";
import type { TripPayment } from "@/types/payments";
import { useMemo, useState } from "react";

type Props = {
  trip: Trip;
  parks: Park[];
  payments: TripPayment[];
  destinationLabel: string;
  onToast: (msg: string) => void;
  onViewAllPayments: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
}

function daysDiffFromToday(dateKey: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const target = parseDateKey(dateKey);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function formatCountdown(diffDays: number): { text: string; isOverdue: boolean } {
  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return {
      text: `overdue by ${days} ${days === 1 ? "day" : "days"}`,
      isOverdue: true,
    };
  }
  if (diffDays < 14) {
    return {
      text: diffDays === 0 ? "due today" : `in ${diffDays} ${diffDays === 1 ? "day" : "days"}`,
      isOverdue: false,
    };
  }
  const weeks = Math.round(diffDays / 7);
  return {
    text: `in ${weeks} ${weeks === 1 ? "week" : "weeks"}`,
    isOverdue: false,
  };
}

export function TripStatsCard({
  trip,
  parks,
  payments,
  destinationLabel,
  onToast,
  onViewAllPayments,
}: Props) {
  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);
  const stats: TripStatsSummary = useMemo(
    () => computeTripStats(trip, parkById),
    [trip, parkById],
  );
  const upcomingPayments = useMemo(() => {
    const ninetyDaysOut = new Date();
    ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);
    const cutoff = new Date(
      ninetyDaysOut.getFullYear(),
      ninetyDaysOut.getMonth(),
      ninetyDaysOut.getDate(),
      12,
    );
    return payments
      .filter((p) => p.due_date && !p.paid_at)
      .map((p) => {
        const dueDate = parseDateKey(p.due_date!);
        return { ...p, dueDate };
      })
      .filter((p) => p.dueDate.getTime() <= cutoff.getTime())
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 3);
  }, [payments]);
  const [open, setOpen] = useState(true);

  async function copyShare() {
    const text = buildTripStatsShareText(stats, destinationLabel);
    try {
      await copyTextToClipboard(text);
      onToast("Stats copied — share it with your group!");
    } catch {
      onToast("Couldn’t copy — try again.");
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-royal/12 bg-cream p-4 shadow-sm">
      <button
        type="button"
        className="flex w-full min-h-[44px] items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h3 className="font-serif text-lg font-semibold text-royal">
          📊 Your trip at a glance
        </h3>
        <span className="text-royal/50">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <>
          <p className="mt-2 font-sans text-sm leading-relaxed text-royal/80">
            <span className="whitespace-nowrap">🗓️ {stats.totalDays} days</span>
            {" · "}
            <span className="whitespace-nowrap">🎢 {stats.parkDays} park days</span>
            {" · "}
            <span className="whitespace-nowrap">😴 {stats.restDays} rest days</span>
            {" · "}
            <span className="whitespace-nowrap">
              🍽️ {stats.mealSlotsFilled} meals planned
            </span>
          </p>
          {stats.mostVisitedName ? (
            <p className="mt-2 font-sans text-sm text-royal">
              🏰 Most visited:{" "}
              <span className="font-semibold">
                {stats.mostVisitedName} ({stats.mostVisitedDayCount}{" "}
                {stats.mostVisitedDayCount === 1 ? "day" : "days"})
              </span>
            </p>
          ) : null}
          <p className="mt-1 font-sans text-sm text-royal">
            👟 Est. walking: ~{stats.estimatedMiles} miles (
            {Math.round(stats.estimatedMiles * 1.60934)} km)
          </p>
          <p className="mt-1 font-sans text-sm text-royal">
            📋 Plan completeness: {stats.completenessPct}%
          </p>
          {stats.namedRestaurantCount > 0 ? (
            <p className="mt-1 font-sans text-xs text-royal/65">
              {stats.namedRestaurantCount} named restaurant
              {stats.namedRestaurantCount === 1 ? "" : "s"} on the plan
            </p>
          ) : null}
          <button
            type="button"
            className="mt-4 min-h-[44px] w-full rounded-lg border border-royal/25 bg-white px-4 font-sans text-sm font-semibold text-royal transition hover:bg-cream"
            onClick={() => void copyShare()}
          >
            Share my stats
          </button>

          {upcomingPayments.length > 0 ? (
            <div className="mt-5 rounded-xl border border-royal/12 bg-white p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-serif text-base font-semibold text-royal">
                  💷 Coming up
                </h4>
                <button
                  type="button"
                  onClick={onViewAllPayments}
                  className="font-sans text-xs font-semibold text-royal/75 underline-offset-2 hover:text-royal hover:underline"
                >
                  View all payments
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {upcomingPayments.map((payment) => {
                  const diffDays = daysDiffFromToday(payment.due_date!);
                  const countdown = formatCountdown(diffDays);
                  return (
                    <li
                      key={payment.id}
                      className="rounded-lg border border-royal/10 bg-cream/45 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-royal">
                          {payment.label}
                        </p>
                        <p className="font-sans text-sm font-semibold text-royal">
                          {formatMoney(payment.amount_pence, payment.currency)}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-sans text-xs">
                        <p className="text-royal/65">Due {payment.due_date}</p>
                        <p
                          className={
                            countdown.isOverdue
                              ? "font-semibold text-red-700"
                              : "text-royal/70"
                          }
                        >
                          {countdown.text}
                        </p>
                      </div>
                      {currencyApproximationText(
                        payment.amount_pence,
                        payment.currency,
                        { tripCurrency: trip.budget_currency },
                      ) ? (
                        <p className="mt-1 font-sans text-[11px] text-royal/55">
                          {currencyApproximationText(
                            payment.amount_pence,
                            payment.currency,
                            { tripCurrency: trip.budget_currency },
                          )}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
