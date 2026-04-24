"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "triptiles_onboarding_v1_dismissed";

type Props = {
  hasTrip: boolean;
  hasAnyAssignment: boolean;
  embedded?: boolean;
};

export function FirstRunChecklist({
  hasTrip,
  hasAnyAssignment,
  embedded,
}: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(!hasAnyAssignment);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (hasAnyAssignment) setTipsOpen(false);
  }, [hasAnyAssignment]);

  function dismissForever() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  const steps = [
    { done: hasTrip, label: "Create a trip in the wizard" },
    {
      done: hasAnyAssignment,
      label: "Pick a park, then tap the calendar to place it",
    },
    {
      done: false,
      label: "View stamps in Passport",
      href: "/achievements" as const,
    },
  ];

  const list = (
    <ul className="space-y-1 font-sans text-xs leading-snug text-royal/80">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className={s.done ? "text-gold" : "text-royal/30"}
            aria-hidden
          >
            {s.done ? "✓" : "○"}
          </span>
          {"href" in s && s.href ? (
            <Link
              href={s.href}
              className="text-royal underline decoration-royal/25 underline-offset-2 hover:text-gold"
            >
              {s.label}
            </Link>
          ) : (
            <span>{s.label}</span>
          )}
        </li>
      ))}
    </ul>
  );

  if (embedded) {
    return (
      <details
        className="group rounded-lg border border-royal/10 bg-white/55 px-3 py-2 shadow-sm backdrop-blur-sm"
        open={tipsOpen}
        onToggle={(e) =>
          setTipsOpen((e.target as HTMLDetailsElement).open)
        }
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 font-sans text-sm font-medium text-royal [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">Organise checklist</span>
          <span className="text-royal/35 transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-2 border-t border-royal/10 pt-2">
          {list}
          <button
            type="button"
            onClick={dismissForever}
            className="mt-2 font-sans text-[0.65rem] font-medium text-royal/45 hover:text-royal"
          >
            Don&apos;t show again
          </button>
        </div>
      </details>
    );
  }

  return (
    <div className="mx-auto mb-6 max-w-3xl rounded-2xl border border-gold/40 bg-white/50 px-4 py-4 shadow-sm backdrop-blur-md sm:px-6">
      <div className="flex items-start justify-between gap-2">
        <p className="font-serif text-base font-semibold text-royal">
          Welcome — quick start
        </p>
        <button
          type="button"
          onClick={dismissForever}
          className="shrink-0 rounded-lg border border-royal/20 px-3 py-1.5 font-sans text-xs font-medium text-royal/70 hover:bg-cream"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-2">{list}</div>
    </div>
  );
}
