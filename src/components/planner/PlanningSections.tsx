"use client";

import { KeyDatesPanel } from "@/components/planning/KeyDatesPanel";
import { FirstRunChecklist } from "@/components/planner/FirstRunChecklist";
import { OrganisePreferences } from "@/components/planner/OrganisePreferences";
import { OrganiseStay } from "@/components/planner/OrganiseStay";
import { PaymentsTab } from "@/components/planner/PaymentsTab";
import { TripBudgetView } from "@/components/planner/TripBudgetView";
import { TripChecklistView } from "@/components/planner/TripChecklistView";
import { useTripWorkspaceData } from "@/components/planner/state/TripWorkspaceData";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MONTHS_SHORT, parseDate } from "@/lib/date-helpers";
import type { Park, Trip } from "@/lib/types";
import {
  buildTripWorkspaceModel,
  organiseTone,
  organiseToneLabel,
  tripSetupStatus,
  type OrganiseTone,
  type WorkspaceArea,
} from "@/lib/trip-workspace-status";
import type { TripPayment } from "@/types/payments";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type PlanningSectionKey = "todo" | "payments" | "budget";
type OrganiseKey = "setup" | "accommodation" | "preferences" | "checklist" | "money";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  onTripPatch: (patch: Partial<Trip>) => void;
  regionLabelForKeyDates: string;
  regionCountryCode?: string | null;
  initialSection?: PlanningSectionKey | null;
  parks: Park[];
  onEditTrip: () => void;
  hasAnyAssignment: boolean;
};

const TONE_VARIANT: Record<OrganiseTone, "default" | "info" | "success" | "warning"> = {
  complete: "success",
  in_progress: "info",
  needs_attention: "warning",
  optional: "default",
};

function localDateKey(d = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatRange(startIso: string, endIso: string): string {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
}

function partyLine(trip: Trip): string {
  const bits: string[] = [];
  if (trip.adults > 0) bits.push(`${trip.adults} adult${trip.adults === 1 ? "" : "s"}`);
  if (trip.children > 0) {
    bits.push(`${trip.children} child${trip.children === 1 ? "" : "ren"}`);
  }
  return bits.join(", ");
}

function areaTone(
  area: WorkspaceArea | undefined,
  whenNotStarted: "needs_attention" | "optional",
): OrganiseTone | null {
  if (!area) return null;
  return organiseTone(area.status, whenNotStarted);
}

export function PlanningSections({
  trip,
  payments,
  onPaymentsChange,
  onTripPatch,
  regionLabelForKeyDates,
  regionCountryCode = null,
  initialSection = null,
  parks,
  onEditTrip,
  hasAnyAssignment,
}: Props) {
  const { checklistItems, budgetItems, setChecklistItems, setBudgetItems } =
    useTripWorkspaceData();
  const [todayKey] = useState(localDateKey);

  const checklist = useMemo(() => {
    if (!checklistItems) return null;
    return {
      total: checklistItems.length,
      checked: checklistItems.filter((item) => item.is_checked).length,
    };
  }, [checklistItems]);

  const parkById = useMemo(() => new Map(parks.map((park) => [park.id, park])), [parks]);
  const model = useMemo(
    () =>
      buildTripWorkspaceModel({
        trip,
        parkById,
        payments,
        todayKey,
        checklist,
        budgetItems,
        tripHrefBase: `/trip/${trip.id}`,
      }),
    [budgetItems, checklist, parkById, payments, todayKey, trip],
  );

  const setup = tripSetupStatus(trip);
  const accommodation = model.areas.find((area) => area.id === "accommodation");
  const preferences = model.areas.find((area) => area.id === "preferences");
  const checklistArea = model.areas.find((area) => area.id === "checklist");
  const budgetArea = model.areas.find((area) => area.id === "budget");

  const setupState = setup.status;
  const stayState = accommodation?.status ?? "loading";
  const preferenceState = preferences?.status ?? "loading";
  const checklistState = checklistArea?.status ?? "loading";
  const budgetState = budgetArea?.status ?? "loading";
  const revealIncomplete = (status: string) => status !== "ready" && status !== "loading";

  const [open, setOpen] = useState<Record<OrganiseKey, boolean>>(() => ({
    setup: setupState !== "ready",
    accommodation: revealIncomplete(stayState),
    preferences: revealIncomplete(preferenceState),
    checklist: initialSection === "todo" || revealIncomplete(checklistState),
    money:
      initialSection === "payments" ||
      initialSection === "budget" ||
      budgetState === "needs_attention",
  }));

  const seen = useRef<{
    tripId: string;
    setup: string;
    stay: string;
    preference: string;
    checklist: string;
    budget: string;
  } | null>(null);

  useEffect(() => {
    const prev = seen.current;
    const sameTrip = prev?.tripId === trip.id;
    seen.current = {
      tripId: trip.id,
      setup: setupState,
      stay: stayState,
      preference: preferenceState,
      checklist: checklistState,
      budget: budgetState,
    };
    const reveal = (status: string) => status !== "ready" && status !== "loading";
    if (!prev) return;
    if (!sameTrip) {
      setOpen({
        setup: setupState !== "ready",
        accommodation: reveal(stayState),
        preferences: reveal(preferenceState),
        checklist: initialSection === "todo" || reveal(checklistState),
        money:
          initialSection === "payments" ||
          initialSection === "budget" ||
          budgetState === "needs_attention",
      });
      return;
    }
    setOpen((current) => ({
      setup: prev.setup === setupState ? current.setup : setupState !== "ready",
      accommodation: prev.stay === stayState ? current.accommodation : reveal(stayState),
      preferences:
        prev.preference === preferenceState ? current.preferences : reveal(preferenceState),
      checklist:
        prev.checklist === checklistState ? current.checklist : reveal(checklistState),
      money: prev.budget === budgetState ? current.money : budgetState === "needs_attention",
    }));
  }, [
    budgetState,
    checklistState,
    initialSection,
    preferenceState,
    setupState,
    stayState,
    trip.id,
  ]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const fromInitial =
      initialSection === "todo"
        ? "organise-checklist"
        : initialSection === "payments"
          ? "organise-payments"
          : initialSection === "budget"
            ? "organise-budget"
            : "";
    const id = hash || fromInitial;
    if (!id) return;
    const node = document.getElementById(id);
    node?.scrollIntoView({ block: "start" });
  }, [initialSection, trip.id]);

  const toggle = (key: OrganiseKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="mt-4 w-full max-w-5xl overflow-hidden rounded-tt-lg border border-tt-line bg-tt-surface">
      <header className="border-b border-tt-line-soft px-3 py-3 sm:px-4">
        <h2 className="font-heading text-sm font-semibold text-tt-royal">
          Get this holiday ready
        </h2>
        <p className="mt-1 font-sans text-sm text-tt-ink-muted">
          What’s already saved, and what still helps the plan.
        </p>
        <FirstRunChecklist hasTrip hasAnyAssignment={hasAnyAssignment} embedded />
      </header>

      <OrganiseBlock
        id="organise-setup"
        title="Trip setup"
        detail={
          setup.status === "ready"
            ? `${regionLabelForKeyDates} · ${formatRange(trip.start_date, trip.end_date)}`
            : setup.detail
        }
        tone={organiseTone(setup.status, "needs_attention")}
        open={open.setup}
        onToggle={() => toggle("setup")}
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label="Destination" value={regionLabelForKeyDates} />
          <Fact label="Dates" value={formatRange(trip.start_date, trip.end_date)} />
          <Fact label="Party" value={partyLine(trip) || "Party size not set"} />
          {trip.has_cruise ? (
            <Fact
              label="Cruise"
              value={
                trip.cruise_embark && trip.cruise_disembark
                  ? `${trip.cruise_embark} – ${trip.cruise_disembark}`
                  : "Dates still to add"
              }
            />
          ) : null}
        </dl>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onEditTrip}>
          Edit trip details
        </Button>
      </OrganiseBlock>

      <OrganiseBlock
        id="organise-accommodation"
        title="Accommodation"
        detail={accommodation?.detail ?? "Checking what’s saved"}
        tone={areaTone(accommodation, "needs_attention")}
        open={open.accommodation}
        onToggle={() => toggle("accommodation")}
      >
        <OrganiseStay
          trip={trip}
          payments={payments}
          budgetItems={budgetItems}
          onPaymentsChange={onPaymentsChange}
          onEditBudget={() => setOpen((prev) => ({ ...prev, money: true }))}
        />
      </OrganiseBlock>

      <OrganiseBlock
        id="organise-preferences"
        title="Planning preferences"
        detail={preferences?.detail ?? "Pace and must-dos are not set"}
        tone={areaTone(preferences, "needs_attention")}
        open={open.preferences}
        onToggle={() => toggle("preferences")}
      >
        <OrganisePreferences trip={trip} parks={parks} onTripPatch={onTripPatch} />
      </OrganiseBlock>

      <OrganiseBlock
        id="organise-checklist"
        title="Checklist"
        detail={checklistArea?.detail ?? "Checking what’s saved"}
        tone={areaTone(checklistArea, "needs_attention")}
        open={open.checklist}
        onToggle={() => toggle("checklist")}
      >
        <TripChecklistView
          trip={trip}
          embedded
          showProgress={false}
          items={checklistItems}
          onItemsChange={setChecklistItems}
        />
      </OrganiseBlock>

      <OrganiseBlock
        id="organise-payments"
        title="Payments and budget"
        detail={budgetArea?.detail ?? "Checking what’s saved"}
        tone={areaTone(budgetArea, "optional")}
        open={open.money}
        onToggle={() => toggle("money")}
      >
        <div className="space-y-8">
          <div id="planning-section-payments">
            <h3 className="font-heading text-sm font-semibold text-tt-royal">Payments</h3>
            <div className="mt-3">
              <PaymentsTab
                trip={trip}
                payments={payments}
                onPaymentsChange={onPaymentsChange}
                embedded
                showTitleRow={false}
              />
            </div>
          </div>
          <KeyDatesPanel
            trip={trip}
            regionLabel={regionLabelForKeyDates}
            regionCountryCode={regionCountryCode}
            onTripPatch={onTripPatch}
            embedded
          />
          <div id="organise-budget">
            <h3 className="font-heading text-sm font-semibold text-tt-royal">Budget</h3>
            <div className="mt-3" id="planning-section-budget">
              <TripBudgetView
                trip={trip}
                onTripPatch={onTripPatch}
                embedded
                items={budgetItems}
                onItemsChange={setBudgetItems}
              />
            </div>
          </div>
        </div>
      </OrganiseBlock>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-sans text-xs font-medium text-tt-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-sans text-sm text-tt-ink">{value}</dd>
    </div>
  );
}

function OrganiseBlock({
  id,
  title,
  detail,
  tone,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  detail: string;
  tone: OrganiseTone | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  return (
    <div id={id} className="scroll-mt-24 border-t border-tt-line-soft">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-11 w-full items-start justify-between gap-3 px-3 py-3 text-left sm:px-4"
      >
        <span className="min-w-0">
          <span className="block font-heading text-sm font-semibold text-tt-royal">{title}</span>
          <span className="mt-0.5 block font-sans text-xs leading-relaxed text-tt-ink-muted">
            {detail}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {tone ? (
            <Badge variant={TONE_VARIANT[tone]} className="px-2 py-0.5">
              {organiseToneLabel(tone)}
            </Badge>
          ) : null}
          <span aria-hidden className="font-sans text-sm text-tt-ink-muted">
            {open ? "–" : "+"}
          </span>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="px-3 pb-4 sm:px-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
