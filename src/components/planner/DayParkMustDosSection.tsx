"use client";

import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { getParkIdsForDay, readMustDosMap, timingPillLabel } from "@/lib/must-dos";
import type { Park, Trip } from "@/lib/types";
import type { ParkMustDo } from "@/types/must-dos";
import { useMemo } from "react";

type Props = {
  trip: Trip;
  dateKey: string;
  parks: Park[];
  generatingParkId: string | null;
  onGenerateMustDos: (parkId: string) => void;
  onToggleMustDoDone: (
    parkId: string,
    mustDoId: string,
    nextDone: boolean,
  ) => void;
  /** Hide section title (e.g. when inside mobile sheet with its own header). */
  hideSectionTitle?: boolean;
};

export function DayParkMustDosSection({
  trip,
  dateKey,
  parks,
  generatingParkId,
  onGenerateMustDos,
  onToggleMustDoDone,
  hideSectionTitle = false,
}: Props) {
  const parkById = useMemo(
    () => new Map(parks.map((p) => [p.id, p])),
    [parks],
  );

  const mustMap = readMustDosMap(trip.preferences);
  const parkIds = useMemo(
    () => getParkIdsForDay(trip.assignments, dateKey),
    [trip.assignments, dateKey],
  );

  if (parkIds.length === 0) return null;

  return (
    <section
      className={
        hideSectionTitle ? "mt-0 border-0 pt-0" : "mt-6 border-t border-royal/10 pt-4"
      }
    >
      {hideSectionTitle ? null : (
        <>
          <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
            Ride must-dos (AI)
          </h2>
          <p className="mt-1 font-sans text-xs leading-relaxed text-royal/60">
            Suggested order and timing — verify on the day.
          </p>
        </>
      )}
      <div className={hideSectionTitle ? "mt-0 space-y-5" : "mt-3 space-y-5"}>
        {parkIds.map((parkId) => {
          const park = parkById.get(parkId);
          const name = park?.name?.trim() || "Park";
          const items: ParkMustDo[] =
            mustMap[dateKey]?.[parkId] ?? [];
          const url = park?.official_url?.trim();
          const pending = generatingParkId === parkId;

          return (
            <div
              key={parkId}
              className="rounded-xl border border-royal/12 bg-white/90 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-sans text-sm font-semibold text-royal">
                  {name}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {items.length > 0 ? (
                    <button
                      type="button"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-royal/15 text-base text-royal transition hover:bg-cream"
                      aria-label={`Regenerate must-dos for ${name}`}
                      title="Regenerate"
                      disabled={pending}
                      onClick={() => onGenerateMustDos(parkId)}
                    >
                      🔄
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-royal/20 bg-cream px-3 font-sans text-xs font-semibold text-royal disabled:opacity-60"
                    onClick={() => onGenerateMustDos(parkId)}
                  >
                    {pending ? (
                      <LogoSpinner size="sm" className="shrink-0" decorative />
                    ) : null}
                    {items.length > 0 ? "Smart Plan again" : "Smart Plan →"}
                  </button>
                </div>
              </div>

              {pending && items.length === 0 ? (
                <div className="mt-3 flex items-center gap-2 font-sans text-sm text-royal/70">
                  <LogoSpinner size="sm" decorative />
                  <span>Building your list…</span>
                </div>
              ) : null}

              {items.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {items.map((m) => (
                    <li
                      key={m.id}
                      className="flex gap-3 rounded-lg border border-royal/8 bg-cream/30 px-2 py-2"
                    >
                      <label className="flex min-h-11 flex-1 cursor-pointer gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0 rounded border-royal/35 accent-royal"
                          checked={m.done}
                          onChange={(e) =>
                            onToggleMustDoDone(
                              parkId,
                              m.id,
                              e.target.checked,
                            )
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-sans text-sm font-semibold text-[#0B1E5C]">
                              {m.title}
                            </span>
                            <span className="inline-flex rounded-full border border-royal/15 bg-white px-2 py-0.5 font-sans text-[10px] font-medium text-[#0B1E5C]/80">
                              {timingPillLabel(m.timing)}
                            </span>
                          </span>
                          {m.why ? (
                            <span className="mt-0.5 block text-sm text-[#0B1E5C]/70">
                              {m.why}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : !pending ? (
                <p className="mt-2 font-sans text-sm text-royal/55">
                  No must-dos yet — tap{" "}
                  <span className="font-semibold">Smart Plan →</span> for
                  ride-level ideas.
                </p>
              ) : null}

              {url ? (
                <p className="mt-3 font-sans text-xs text-royal/55">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-royal underline decoration-royal/25 underline-offset-2"
                  >
                    Check the {name} website for ride closures
                  </a>{" "}
                  →
                </p>
              ) : (
                <p className="mt-3 font-sans text-xs text-royal/50">
                  Check the official park site for hours and ride closures before
                  you travel.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
