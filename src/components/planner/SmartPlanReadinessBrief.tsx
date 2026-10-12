"use client";

import type { SmartPlanReadiness } from "@/lib/smart-plan-readiness";
import Link from "next/link";

type Props = {
  readiness: SmartPlanReadiness;
  onOpenOrganise?: () => void;
};

export function SmartPlanReadinessBrief({ readiness, onOpenOrganise }: Props) {
  const helpfulLead =
    readiness.helpful.length === 1
      ? "1 thing would improve your plan"
      : `${readiness.helpful.length} things would improve your plan`;

  return (
    <section
      aria-label="Smart Plan readiness"
      className="space-y-3 rounded-lg border border-tt-line bg-tt-surface px-3 py-3 sm:px-4"
    >
      <div>
        <h3 className="font-heading text-base font-semibold text-tt-royal">
          {readiness.headline}
        </h3>
        <p className="mt-1 font-sans text-sm leading-relaxed text-tt-ink-muted">
          {readiness.scopeNote}
        </p>
      </div>

      <ul className="space-y-1 font-sans text-sm text-tt-ink">
        {readiness.required.map((check) => (
          <li key={check.id} className="break-words">
            <span aria-hidden="true">{check.ok ? "✓ " : "→ "}</span>
            <span className="font-medium">{check.label}</span>
            <span className="text-tt-ink-muted"> — {check.detail}</span>
          </li>
        ))}
      </ul>

      {readiness.helpful.length > 0 ? (
        <div>
          <p className="font-sans text-sm font-medium text-tt-ink">{helpfulLead}</p>
          <ul className="mt-1 space-y-1 font-sans text-sm text-tt-ink-muted">
            {readiness.helpful.map((item) => (
              <li key={item.id} className="break-words">
                → {item.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!readiness.required.find((check) => check.id === "pace")?.ok ? (
        <Link
          href={readiness.organisePreferencesHref}
          onClick={onOpenOrganise}
          className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-tt-royal underline decoration-tt-line underline-offset-4"
        >
          Choose a pace in Organise
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-tt-ink-muted">
            Stays as it is
          </p>
          <ul className="mt-1 space-y-1 font-sans text-sm text-tt-ink">
            {readiness.fixed.slice(0, 4).map((line) => (
              <li key={line} className="break-words">
                {line}
              </li>
            ))}
            {readiness.fixed.length > 4 ? (
              <li className="text-tt-ink-muted">
                {readiness.fixed.length - 4} more stay unchanged. The preview lists them.
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-tt-ink-muted">
            May change
          </p>
          {readiness.mayChange.length === 0 ? (
            <p className="mt-1 font-sans text-sm text-tt-ink-muted">
              Nothing on the calendar needs to move.
            </p>
          ) : (
            <ul className="mt-1 space-y-1 font-sans text-sm text-tt-ink">
              {readiness.mayChange.slice(0, 4).map((line) => (
                <li key={line} className="break-words">
                  {line}
                </li>
              ))}
              {readiness.mayChange.length > 4 ? (
                <li className="text-tt-ink-muted">
                  {readiness.mayChange.length - 4} more in the preview.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
