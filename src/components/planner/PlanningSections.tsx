"use client";

import { KeyDatesPanel } from "@/components/planning/KeyDatesPanel";
import { PaymentsTab } from "@/components/planner/PaymentsTab";
import { TripBudgetView } from "@/components/planner/TripBudgetView";
import { TripChecklistView } from "@/components/planner/TripChecklistView";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
    <section className="mt-6 w-full max-w-5xl space-y-4">
      {(["todo", "payments", "budget"] as const).map((key) => {
        const meta = SECTION_META[key];
        const isOpen = openBySection[key];
        const panelId = `planning-section-panel-${key}`;
        return (
          <Card
            key={key}
            id={`planning-section-${key}`}
            className="overflow-hidden backdrop-blur-md"
            variant="elevated"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleSection(key)}
              className="flex min-h-11 w-full items-center justify-between gap-3 bg-tt-surface-warm px-4 py-3 text-left transition hover:bg-tt-bg-soft"
            >
              <SectionHeader
                title={meta.title}
                subtitle={meta.description}
                icon={meta.icon}
                className="min-w-0 flex-1"
              />
              <span
                aria-hidden
                className="shrink-0 text-lg font-semibold text-tt-royal/70"
              >
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen ? (
              <div id={panelId} className="border-t border-tt-line p-4 sm:p-5">
                {key === "todo" ? <TripChecklistView trip={trip} embedded /> : null}
                {key === "payments" ? (
                  <div className="space-y-8">
                    <PaymentsTab
                      trip={trip}
                      payments={payments}
                      onPaymentsChange={onPaymentsChange}
                      embedded
                    />
                    <KeyDatesPanel trip={trip} />
                  </div>
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
          </Card>
        );
      })}
    </section>
  );
}
