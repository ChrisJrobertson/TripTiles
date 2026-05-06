"use client";

import { formatDateISO, parseDate } from "@/lib/date-helpers";
import type { BookingAnchor } from "@/lib/booking-anchor-risk";
import { useEffect, useId, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";

export type { BookingAnchor };

export type BookingConflictAction =
  | "park-change"
  | "slot-clear"
  | "ride-remove"
  | "day-replace";

type Props = {
  open: boolean;
  anchors: BookingAnchor[];
  action: BookingConflictAction;
  newParkName?: string;
  onKeepBooking: () => void;
  onProceedKeepBooking: () => void;
  onProceedClearBooking: () => void;
  onDismiss: () => void;
  /** YYYY-MM-DD for body copy. */
  dayDate: string;
};

function titleForAction(a: BookingConflictAction): string {
  switch (a) {
    case "park-change":
      return "Keep your booking?";
    case "slot-clear":
      return "You’ve got a booking here";
    case "ride-remove":
      return "This ride has a booking";
    case "day-replace":
    default:
      return "This day has bookings";
  }
}

function shortUkDate(dateKey: string): string {
  const d = parseDate(`${dateKey}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Subtle warning icon (no extra icon dependency).
 */
function AmberTriangle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3L2 20h20L12 3z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function BookingConflictModal({
  open,
  anchors,
  action,
  newParkName,
  onKeepBooking,
  onProceedKeepBooking,
  onProceedClearBooking,
  onDismiss,
  dayDate,
}: Props) {
  const titleId = useId();
  useEffect(() => {
    if (open)
      document.getElementById("booking-conflict-keep-primary")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const dLabel = shortUkDate(dayDate);
  const iso = formatDateISO(parseDate(`${dayDate}T12:00:00`));

  let body: ReactNode;
  if (action === "park-change" && newParkName && anchors.length === 1) {
    const a = anchors[0]!;
    body = (
      <p className="font-sans text-sm leading-relaxed text-tt-royal/90">
        You’ve booked {a.rideName} for {a.returnTimeHhmm} on {dLabel} at{" "}
        {a.parkName}. Changing this slot to {newParkName} can leave that
        booking hard to use — you’d still need to be at {a.parkName} in time
        for your window.
      </p>
    );
  } else if (action === "slot-clear" && anchors.length === 1) {
    const a = anchors[0]!;
    body = (
      <p className="font-sans text-sm leading-relaxed text-tt-royal/90">
        {a.rideName} is booked for {a.returnTimeHhmm} on {dLabel} at{" "}
        {a.parkName}. Clearing this slot can make that plan harder to follow on
        the day.
      </p>
    );
  } else if (action === "ride-remove" && anchors.length === 1) {
    const a = anchors[0]!;
    body = (
      <p className="font-sans text-sm leading-relaxed text-tt-royal/90">
        You’ve set a {a.returnTimeHhmm} return for {a.rideName} at {a.parkName}{" "}
        on {dLabel}. Removing it from the list can still leave the booking live
        in the app you used — this only changes TripTiles.
      </p>
    );
  } else {
    body = (
      <ul className="list-inside list-disc space-y-1.5 font-sans text-sm leading-relaxed text-tt-royal/90">
        {anchors.map((a) => (
          <li key={a.rideId}>
            <span className="font-medium">{a.rideName}</span> – return{" "}
            {a.returnTimeHhmm} at {a.parkName}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ModalShell
      zClassName="z-[130]"
      bottomSheetOnMobile
      overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
      maxWidthClass="max-w-md"
      role="dialog"
      aria-modal={true}
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div className="p-4 sm:p-5">
        <h2
          id={titleId}
          className="font-heading text-lg font-semibold text-tt-royal"
        >
          {titleForAction(action)}
        </h2>
        <div className="mt-3" data-iso={iso}>
          {body}
        </div>
        <div className="mt-4 flex gap-2 rounded-tt-md border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          <span className="shrink-0 pt-0.5">
            <AmberTriangle className="text-amber-800" />
          </span>
          <p>
            If any of these were paid bookings (Single Pass / Individual
            Lightning Lane), clearing them will not refund your payment. Check
            before continuing.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="primary"
            id="booking-conflict-keep-primary"
            className="w-full min-h-11 sm:w-auto"
            onClick={onKeepBooking}
          >
            Keep booking, undo change
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full min-h-11 sm:w-auto"
            onClick={onProceedKeepBooking}
          >
            Change and keep tracking
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-11 text-red-700 hover:bg-red-50 sm:w-auto"
            onClick={onProceedClearBooking}
          >
            Change and clear booking
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
