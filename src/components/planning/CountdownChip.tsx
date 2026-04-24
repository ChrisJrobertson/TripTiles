"use client";

import { useMemo } from "react";

export type CountdownChipVariant = "urgent" | "warning" | "normal" | "done";

type Props = {
  targetDate: Date | string;
  label?: string;
  variant?: CountdownChipVariant;
  /** When set, shows paid state and ignores countdown bands. */
  paidAt?: string | null;
  /** Past dates render as “N days ago” (muted) instead of overdue wording. */
  treatPastAsMilestone?: boolean;
};

const DAY_MS = 86_400_000;

function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
}

function toDateKey(input: Date | string): string | null {
  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const t = Date.parse(input);
    if (!Number.isFinite(t)) return null;
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatPaidDayUk(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}

function variantClasses(v: CountdownChipVariant): string {
  switch (v) {
    case "done":
      return "border border-emerald-200 bg-emerald-50 font-semibold text-emerald-900";
    case "urgent":
      return "border border-red-200 bg-red-50 font-bold text-red-900";
    case "warning":
      return "border border-amber-200 bg-amber-50 font-medium text-amber-950";
    case "normal":
    default:
      return "border border-royal/10 bg-cream font-medium text-royal/75";
  }
}

export function CountdownChip({
  targetDate,
  label,
  variant: variantProp,
  paidAt,
  treatPastAsMilestone = false,
}: Props) {
  const { text, variant } = useMemo(() => {
    if (paidAt) {
      const day = formatPaidDayUk(paidAt);
      const paidLabel = day ? `Paid ${day}` : "Paid";
      return { text: `✅ ${paidLabel}`, variant: "done" as const };
    }

    const key = toDateKey(targetDate);
    if (!key) return { text: null as string | null, variant: "normal" as const };

    const target = parseDateKey(key);
    if (!target) return { text: null, variant: "normal" as const };

    const today = startOfToday();
    const diffDays = Math.round((target.getTime() - today.getTime()) / DAY_MS);

    if (treatPastAsMilestone && diffDays < 0) {
      const n = Math.abs(diffDays);
      return {
        text: `${n} ${n === 1 ? "day" : "days"} ago`,
        variant: "normal" as const,
      };
    }

    if (diffDays < 0) {
      const n = Math.abs(diffDays);
      return {
        text: `Overdue by ${n} ${n === 1 ? "day" : "days"}`,
        variant: "urgent" as const,
      };
    }

    if (diffDays === 0) {
      return { text: "Due today", variant: "urgent" as const };
    }

    if (diffDays <= 7) {
      return {
        text: `Due in ${diffDays} ${diffDays === 1 ? "day" : "days"}`,
        variant: "urgent" as const,
      };
    }
    if (diffDays <= 30) {
      return {
        text: `Due in ${diffDays} days`,
        variant: "warning" as const,
      };
    }
    return {
      text: `Due in ${diffDays} days`,
      variant: "normal" as const,
    };
  }, [paidAt, targetDate, treatPastAsMilestone]);

  if (!text) return null;

  const displayVariant: CountdownChipVariant = paidAt
    ? "done"
    : (variantProp ?? variant);
  const mutedPast = treatPastAsMilestone && text.endsWith("ago");

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs whitespace-normal ${mutedPast ? "border border-royal/10 bg-cream font-medium text-royal/50" : variantClasses(displayVariant)}`}
      title={label}
    >
      {text}
    </span>
  );
}
