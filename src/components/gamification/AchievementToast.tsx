"use client";

import type { AchievementDefinition } from "@/lib/types";
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
    }, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  function dismissNow() {
    setExiting(true);
    setTimeout(onDismiss, 320);
  }

  return (
    <button
      type="button"
      onClick={dismissNow}
      className={`pointer-events-auto flex w-full max-w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border-2 border-gold bg-cream px-4 py-3 text-left shadow-xl transition duration-300 ease-out ${
        exiting ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100"
      } `}
    >
      <span className="text-3xl leading-none" aria-hidden>
        {achievement.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-base font-semibold text-royal">
          {achievement.title}
        </span>
        <span className="mt-1 block font-sans text-sm leading-snug text-royal/80">
          {achievement.description}
        </span>
      </span>
    </button>
  );
}
