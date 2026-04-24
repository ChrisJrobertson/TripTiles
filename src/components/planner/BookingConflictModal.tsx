"use client";

import { formatDateISO, parseDate } from "@/lib/date-helpers";
import type { BookingAnchor } from "@/lib/booking-anchor-risk";
import { useEffect, useId, useRef, type ReactNode } from "react";

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
  const keepBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) keepBtnRef.current?.focus();
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
      <p className="font-sans text-sm leading-relaxed text-royal/90">
        You’ve booked {a.rideName} for {a.returnTimeHhmm} on {dLabel} at{" "}
        {a.parkName}. Changing this slot to {newParkName} can leave that
        booking hard to use — you’d still need to be at {a.parkName} in time
        for your window.
      </p>
    );
  } else if (action === "slot-clear" && anchors.length === 1) {
    const a = anchors[0]!;
    body = (
      <p className="font-sans text-sm leading-relaxed text-royal/90">
        {a.rideName} is booked for {a.returnTimeHhmm} on {dLabel} at{" "}
        {a.parkName}. Clearing this slot can make that plan harder to follow on
        the day.
      </p>
    );
  } else if (action === "ride-remove" && anchors.length === 1) {
    const a = anchors[0]!;
    body = (
      <p className="font-sans text-sm leading-relaxed text-royal/90">
        You’ve set a {a.returnTimeHhmm} return for {a.rideName} at {a.parkName}{" "}
        on {dLabel}. Removing it from the list can still leave the booking
        live in the app you used — this only changes TripTiles.
      </p>
    );
  } else {
    body = (
      <ul className="list-inside list-disc space-y-1.5 font-sans text-sm leading-relaxed text-royal/90">
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
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-royal/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Close"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-royal/15 bg-cream p-4 shadow-2xl sm:rounded-2xl">
        <h2
          id={titleId}
          className="font-['Fraunces',serif] text-lg font-semibold text-[#0B1E5C]"
        >
          {titleForAction(action)}
        </h2>
        <div className="mt-3" data-iso={iso}>
          {body}
        </div>
        <div className="mt-4 flex gap-2 rounded-md bg-[#FEF3C7] px-3 py-2 text-sm text-[#B45309]">
          <span className="shrink-0 pt-0.5">
            <AmberTriangle className="text-[#B45309]" />
          </span>
          <p>
            If any of these were paid bookings (Single Pass / Individual
            Lightning Lane), clearing them will not refund your payment. Check
            before continuing.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            ref={keepBtnRef}
            className="min-h-11 w-full rounded-lg bg-[#0B1E5C] px-4 font-sans text-sm font-semibold text-white sm:w-auto"
            onClick={onKeepBooking}
          >
            Keep booking, undo change
          </button>
          <button
            type="button"
            className="min-h-11 w-full rounded-lg border border-[#0B1E5C]/20 bg-[#FAF8F3] px-4 font-sans text-sm font-semibold text-[#0B1E5C] sm:w-auto"
            onClick={onProceedKeepBooking}
          >
            Change and keep tracking
          </button>
          <button
            type="button"
            className="min-h-11 w-full font-sans text-sm font-medium text-red-700 hover:bg-red-50 sm:w-auto"
            onClick={onProceedClearBooking}
          >
            Change and clear booking
          </button>
        </div>
      </div>
    </div>
  );
}
