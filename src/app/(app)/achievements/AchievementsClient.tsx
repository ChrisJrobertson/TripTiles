"use client";

import type {
  Achievement,
  AchievementCategory,
  AchievementDefinition,
} from "@/lib/types";
import { useMemo, useState } from "react";

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  milestone: "Milestones",
  trips: "Trips",
  parks: "Parks",
  destinations: "Destinations",
  days: "Days",
  social: "Social",
  loyalty: "Loyalty",
};

const ALL_CATEGORIES: AchievementCategory[] = [
  "milestone",
  "trips",
  "parks",
  "destinations",
  "days",
  "social",
  "loyalty",
];

export type ProfileProgress = {
  trips_planned_count: number;
  days_planned_count: number;
};

type Props = {
  definitions: AchievementDefinition[];
  earned: Achievement[];
  progress: ProfileProgress;
};

function formatEarnedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function progressHint(
  def: AchievementDefinition,
  p: ProfileProgress,
): string | null {
  if (def.threshold == null) return null;
  if (def.category === "trips") {
    const n = Math.min(p.trips_planned_count, def.threshold);
    return `${n} / ${def.threshold} trips planned`;
  }
  if (def.category === "days") {
    const n = Math.min(p.days_planned_count, def.threshold);
    return `${n} / ${def.threshold} days planned`;
  }
  return null;
}

export function AchievementsClient({
  definitions,
  earned,
  progress,
}: Props) {
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");

  const earnedByKey = useMemo(() => {
    const m = new Map<string, Achievement>();
    for (const a of earned) m.set(a.achievement_key, a);
    return m;
  }, [earned]);

  const sorted = useMemo(() => {
    return [...definitions].sort((a, b) => {
      const ae = earnedByKey.has(a.key) ? 1 : 0;
      const be = earnedByKey.has(b.key) ? 1 : 0;
      if (ae !== be) return be - ae;
      return a.sort_order - b.sort_order;
    });
  }, [definitions, earnedByKey]);

  const visible = useMemo(() => {
    if (filter === "all") return sorted;
    return sorted.filter((d) => d.category === filter);
  }, [sorted, filter]);

  const total = definitions.length;
  const unlocked = earned.length;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(201, 169, 97, 0.12) 0%, transparent 45%),
            radial-gradient(circle at 80% 0%, rgba(11, 30, 92, 0.08) 0%, transparent 40%)`,
        }}
        aria-hidden
      />

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:pt-8">
        <div className="relative overflow-hidden rounded-2xl border border-royal/15 bg-white/80 p-6 shadow-sm shadow-royal/5 sm:p-8">
          <div
            className="absolute right-4 top-4 hidden h-16 w-24 rounded border border-dashed border-royal/20 sm:block"
            aria-hidden
          />
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-gold">
            Your collection
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-royal sm:text-4xl">
            Trip Passport
          </h1>
          <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-royal/75">
            Stamps you&apos;ve earned from planning adventures — and the ones
            still waiting for your next trip.
          </p>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-sans text-xs font-medium uppercase tracking-wide text-royal/50">
                Progress
              </p>
              <p className="mt-1 font-serif text-2xl text-royal">
                <span className="text-gold">{unlocked}</span>
                <span className="text-royal/40"> / </span>
                <span>{total}</span>
                <span className="ml-2 font-sans text-base font-normal text-royal/60">
                  stamps collected
                </span>
              </p>
            </div>
            <div className="w-full max-w-xs sm:w-56">
              <div
                className="h-2 overflow-hidden rounded-full bg-cream"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Collection progress"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/90 to-gold transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-right font-sans text-xs text-royal/50">
                {pct}% complete
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" aria-label="Filter stamps by category">
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 font-sans text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
              filter === "all"
                ? "bg-royal text-cream"
                : "bg-white/90 text-royal/80 ring-1 ring-royal/10 hover:bg-cream"
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const count = definitions.filter((d) => d.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={filter === cat}
                onClick={() => setFilter(cat)}
                className={`rounded-full px-3 py-1.5 font-sans text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                  filter === cat
                    ? "bg-royal text-cream"
                    : "bg-white/90 text-royal/80 ring-1 ring-royal/10 hover:bg-cream"
                }`}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 text-center font-sans text-sm text-royal/60">
            No stamps in this category yet.
          </p>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((def, i) => {
              const row = earnedByKey.get(def.key);
              const isEarned = Boolean(row);
              const hint = !isEarned ? progressHint(def, progress) : null;

              return (
                <li
                  key={def.key}
                  className="achievement-card-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                >
                  <article
                    className={`group relative flex h-full flex-col rounded-xl border p-4 transition ${
                      isEarned
                        ? "border-gold/40 bg-white shadow-md shadow-gold/10 ring-1 ring-gold/20"
                        : "border-royal/10 bg-white/70 ring-1 ring-royal/5"
                    }`}
                  >
                    {!isEarned && (
                      <span className="absolute right-3 top-3 rounded-full bg-royal/5 px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-royal/55">
                        Locked
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl ${
                          isEarned
                            ? "bg-gold/15"
                            : "bg-royal/5 grayscale opacity-70"
                        }`}
                        aria-hidden
                      >
                        {def.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-royal/45">
                          {CATEGORY_LABEL[def.category]}
                        </p>
                        <h2 className="font-serif text-lg font-semibold leading-snug text-royal">
                          {def.title}
                        </h2>
                        <p className="mt-1 font-sans text-sm leading-relaxed text-royal/70">
                          {def.description}
                        </p>
                        {isEarned && row ? (
                          <p className="mt-3 font-sans text-xs text-gold">
                            Earned {formatEarnedAt(row.earned_at)}
                          </p>
                        ) : hint ? (
                          <p className="mt-3 font-sans text-xs text-royal/55">
                            {hint}
                          </p>
                        ) : def.threshold != null && !hint ? (
                          <p className="mt-3 font-sans text-xs text-royal/45">
                            Keep planning to unlock
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
