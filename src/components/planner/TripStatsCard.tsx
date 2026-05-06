"use client";

import {
  buildTripStatsShareText,
  computeTripStats,
  type TripStatsSummary,
} from "@/lib/compute-trip-stats";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MetricPill } from "@/components/ui/MetricPill";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
    <Card
      as="section"
      className="mb-4 p-3 backdrop-blur-md sm:p-4"
      variant="elevated"
    >
      <button
        type="button"
        className="flex w-full min-h-11 items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <SectionHeader
          title="Your trip at a glance"
          icon="📊"
          subtitle={`${destinationLabel} overview`}
          className="flex-1"
        />
        <span className="text-tt-royal/50">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill label="Trip length" value={`${stats.totalDays} days`} icon="🗓️" />
            <MetricPill label="Park days" value={stats.parkDays} icon="🎢" variant="magic" />
            <MetricPill label="Rest days" value={stats.restDays} icon="😴" variant="warm" />
            <MetricPill
              label="Meals"
              value={`${stats.mealSlotsFilled} planned`}
              icon="🍽️"
              variant="warning"
            />
          </div>
          {stats.mostVisitedName ? (
            <p className="mt-3 font-sans text-sm text-tt-ink-muted">
              🏰 Most visited{" "}
              <span className="font-semibold text-tt-royal">
                {stats.mostVisitedName} ({stats.mostVisitedDayCount}{" "}
                {stats.mostVisitedDayCount === 1 ? "day" : "days"})
              </span>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="info">
              👟 ~{stats.estimatedMiles} miles /{" "}
              {Math.round(stats.estimatedMiles * 1.60934)} km
            </Badge>
            <Badge variant={stats.completenessPct >= 80 ? "success" : "default"}>
              📋 {stats.completenessPct}% complete
            </Badge>
          </div>
          {stats.namedRestaurantCount > 0 ? (
            <p className="mt-2 font-sans text-xs text-tt-ink-soft">
              {stats.namedRestaurantCount} named restaurant
              {stats.namedRestaurantCount === 1 ? "" : "s"} on the plan
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => void copyShare()}
          >
            Share my stats
          </Button>

          {upcomingPayments.length > 0 ? (
            <div className="mt-5 rounded-tt-lg border border-tt-line bg-tt-surface-warm p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-heading text-base font-semibold text-tt-royal">
                  💷 Coming up
                </h4>
                <button
                  type="button"
                  onClick={onViewAllPayments}
                  className="font-sans text-xs font-semibold text-tt-royal/75 underline-offset-2 hover:text-tt-royal hover:underline"
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
                      className="rounded-tt-md border border-tt-line-soft bg-tt-surface px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate font-sans text-sm font-medium text-tt-ink">
                          {payment.label}
                        </p>
                        <p className="font-sans text-sm font-semibold text-tt-royal">
                          {formatMoney(payment.amount_pence, payment.currency)}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 font-sans text-xs">
                        <p className="text-tt-ink-soft">Due {payment.due_date}</p>
                        <p
                          className={
                            countdown.isOverdue
                              ? "font-semibold text-red-700"
                              : "text-tt-ink-muted"
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
                        <p className="mt-1 font-sans text-[11px] text-tt-ink-soft">
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
    </Card>
  );
}
