"use client";

import { PaymentsTab } from "@/components/planner/PaymentsTab";
import { TripBudgetView } from "@/components/planner/TripBudgetView";
import { TripChecklistView } from "@/components/planner/TripChecklistView";
import type { Trip } from "@/lib/types";
import type { TripPayment } from "@/types/payments";
import { useMemo, useState } from "react";

type PlanningSectionKey = "todo" | "payments" | "budget";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  onTripPatch: (patch: Partial<Trip>) => void;
  initialSection?: PlanningSectionKey | null;
};

const SECTION_META: Record<
  PlanningSectionKey,
  { title: string; icon: string; description: string }
> = {
  todo: {
    title: "To-do list",
    icon: "✓",
    description: "Checklist for prep, packing, and day-of essentials.",
  },
  payments: {
    title: "Payments schedule",
    icon: "💷",
    description: "Track deposits, balances, flights, and ticket due dates.",
  },
  budget: {
    title: "Budget overview",
    icon: "📊",
    description: "Set spending targets and monitor paid vs outstanding totals.",
  },
};

export function PlanningSections({
  trip,
  payments,
  onPaymentsChange,
  onTripPatch,
  initialSection = null,
}: Props) {
  const defaultOpen = useMemo(
    () => ({
      todo: true,
      payments: true,
      budget: false,
    }),
    [],
  );

  const [openBySection, setOpenBySection] = useState<Record<
    PlanningSectionKey,
    boolean
  >>(() => {
    if (!initialSection) return defaultOpen;
    return {
      ...defaultOpen,
      [initialSection]: true,
    };
  });

  const toggleSection = (key: PlanningSectionKey) => {
    setOpenBySection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="mt-8 w-full max-w-4xl space-y-4">
      {(["todo", "payments", "budget"] as const).map((key) => {
        const meta = SECTION_META[key];
        const isOpen = openBySection[key];
        const panelId = `planning-section-panel-${key}`;
        return (
          <div
            key={key}
            id={`planning-section-${key}`}
            className="overflow-hidden rounded-2xl border border-royal/12 bg-white shadow-sm"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleSection(key)}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 bg-cream/40 px-4 py-3 text-left transition hover:bg-cream/70"
            >
              <div className="min-w-0">
                <p className="font-serif text-lg font-semibold text-royal">
                  <span aria-hidden className="mr-2">
                    {meta.icon}
                  </span>
                  {meta.title}
                </p>
                <p className="mt-0.5 font-sans text-xs text-royal/65">
                  {meta.description}
                </p>
              </div>
              <span
                aria-hidden
                className="shrink-0 text-lg font-semibold text-royal/70"
              >
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen ? (
              <div id={panelId} className="border-t border-royal/10 p-4 sm:p-5">
                {key === "todo" ? <TripChecklistView trip={trip} embedded /> : null}
                {key === "payments" ? (
                  <PaymentsTab
                    trip={trip}
                    payments={payments}
                    onPaymentsChange={onPaymentsChange}
                    embedded
                  />
                ) : null}
                {key === "budget" ? (
                  <TripBudgetView
                    trip={trip}
                    onTripPatch={onTripPatch}
                    embedded
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
