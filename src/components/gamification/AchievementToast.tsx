"use client";

import type { AchievementDefinition } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  achievement: AchievementDefinition;
  onDismiss: () => void;
};

export function AchievementToast({ achievement, onDismiss }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 320);
    }, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  function dismissNow() {
    setExiting(true);
    setTimeout(onDismiss, 320);
  }

  return (
    <div
      className={`pointer-events-auto w-full max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border-2 border-gold bg-cream px-4 py-3 text-left shadow-xl transition duration-300 ease-out ${
        exiting ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100"
      } `}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {achievement.icon}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block font-serif text-base font-semibold text-royal">
            {achievement.title}
          </span>
          <span className="mt-1 block font-sans text-sm leading-snug text-royal/80">
            {achievement.description}
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href="/achievements"
              className="font-sans text-sm font-semibold text-gold underline decoration-gold/40 underline-offset-4 transition hover:text-royal"
              onClick={(e) => e.stopPropagation()}
            >
              View in Passport
            </Link>
            <button
              type="button"
              onClick={dismissNow}
              className="font-sans text-xs font-medium text-royal/50 hover:text-royal"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
