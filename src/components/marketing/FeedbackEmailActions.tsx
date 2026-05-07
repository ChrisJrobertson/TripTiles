"use client";

import { getPublicSiteUrl } from "@/lib/site";
import Link from "next/link";
import { useMemo, useState } from "react";

const CATEGORIES = [
  { id: "bug", label: "Bug", prefix: "[Bug] " },
  { id: "idea", label: "Idea", prefix: "[Idea] " },
  { id: "park_data", label: "Park data", prefix: "[Park data] " },
  { id: "compliment", label: "Compliment", prefix: "[Compliment] " },
  { id: "other", label: "Other", prefix: "[Other] " },
] as const;

type CatId = (typeof CATEGORIES)[number]["id"];

function feedbackEmailConfigured(): string | null {
  const v = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim();
  return v || null;
}

function buildMailto(email: string, category: CatId): string {
  const origin = getPublicSiteUrl() || "TripTiles";
  const prefix =
    CATEGORIES.find((c) => c.id === category)?.prefix ?? "[Other] ";
  const subject = encodeURIComponent(`${prefix}TripTiles feedback`);
  const body = encodeURIComponent(
    `\n\n---\nCategory: ${category}\nApp: ${origin}\n`,
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

const EMAIL_CTA_CLASSES =
  "inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-tt-md bg-tt-royal px-5 py-3 font-sans text-base font-semibold text-white shadow-tt-sm transition hover:bg-tt-royal-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal sm:w-auto";

export function FeedbackEmailActions() {
  const email = feedbackEmailConfigured();
  const [category, setCategory] = useState<CatId>("idea");

  const mailto = useMemo(
    () => (email ? buildMailto(email, category) : ""),
    [email, category],
  );

  if (!email) {
    return (
      <div className="mt-6 space-y-4">
        <p className="font-sans text-sm leading-relaxed text-tt-ink-muted">
          Feedback is temporarily unavailable here — please use the in-app
          feedback widget from your planner or settings instead. We still read
          everything.
        </p>
        <button
          type="button"
          disabled
          className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-tt-md border border-tt-line bg-tt-bg-soft px-5 py-3 font-sans text-base font-semibold text-tt-ink-soft opacity-70 sm:w-auto"
        >
          Email us
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="feedback-category"
          className="block font-sans text-sm font-semibold text-tt-royal"
        >
          What&apos;s this about?
        </label>
        <select
          id="feedback-category"
          className="mt-2 w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2.5 font-sans text-sm text-tt-royal shadow-tt-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal"
          value={category}
          onChange={(e) => setCategory(e.target.value as CatId)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <a href={mailto} className={EMAIL_CTA_CLASSES}>
        Email us
      </a>
      <p className="font-sans text-xs text-tt-ink-soft">
        We add a short tag to the subject line so replies stay organised.
      </p>
      <p className="font-sans text-sm text-tt-ink-muted">
        <Link
          href="/"
          className="font-semibold text-tt-gold underline underline-offset-2 hover:text-tt-gold/90"
        >
          ← Home
        </Link>
      </p>
    </div>
  );
}
