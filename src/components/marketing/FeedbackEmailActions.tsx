"use client";

import {
  marketingLinkAccentLg,
  marketingLinkUnderline,
} from "@/components/marketing/marketing-classes";
import { getPublicSiteUrl } from "@/lib/site";
import { useMemo, useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  { id: "bug", label: "Something broke", prefix: "[Bug]" },
  { id: "ux", label: "Confusing UX", prefix: "[UX]" },
  { id: "idea", label: "Feature idea", prefix: "[Idea]" },
  { id: "billing", label: "Billing", prefix: "[Billing]" },
  { id: "other", label: "Other", prefix: "[Feedback]" },
] as const;

type CatId = (typeof CATEGORIES)[number]["id"];

function buildMailto(email: string, category: CatId): string {
  const origin = getPublicSiteUrl() || "TripTiles";
  const prefix =
    CATEGORIES.find((c) => c.id === category)?.prefix ?? "[Feedback]";
  const subject = encodeURIComponent(`${prefix} TripTiles feedback`);
  const body = encodeURIComponent(
    `\n\n---\nCategory: ${category}\nApp: ${origin}\n`,
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function FeedbackEmailActions() {
  const email =
    process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || "feedback@example.com";
  const [category, setCategory] = useState<CatId>("other");

  const mailto = useMemo(
    () => buildMailto(email, category),
    [email, category],
  );

  return (
    <div className="mt-8 space-y-4">
      <label className="block font-sans text-sm font-semibold text-tt-royal">
        What kind of feedback?
        <select
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
      </label>
      <a href={mailto} className={marketingLinkAccentLg}>
        Email us
      </a>
      <p className="font-sans text-xs text-tt-royal/50">
        We add a short tag to the subject line so replies stay organised.
      </p>
      <p className="font-sans text-sm text-tt-royal/55">
        <Link href="/" className={marketingLinkUnderline}>
          ← Home
        </Link>
      </p>
    </div>
  );
}
