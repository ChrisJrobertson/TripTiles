"use client";

import { useEffect, useState, type FormEvent } from "react";

const MAX_CHARS = 500;
const DEFAULT_FREE_CAP = 5;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Successful AI runs for this trip (free tier display). */
  generationsUsedThisTrip: number;
  freeTierCap?: number;
  /** Hide the “Free plan: X of 5” line for paid tiers. */
  showFreeTierNote?: boolean;
  isGenerating: boolean;
  submitError: string | null;
  onGenerate: (prompt: string) => Promise<void>;
};

export function SmartPlanModal({
  isOpen,
  onClose,
  generationsUsedThisTrip,
  freeTierCap = DEFAULT_FREE_CAP,
  showFreeTierNote = true,
  isGenerating,
  submitError,
  onGenerate,
}: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (isOpen) setText("");
  }, [isOpen]);

  if (!isOpen) return null;

  const remaining = MAX_CHARS - text.length;
  const over = remaining < 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (over || isGenerating) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    await onGenerate(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-royal/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-plan-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-gold/40 bg-cream p-6 shadow-xl sm:p-8">
        <h2
          id="smart-plan-title"
          className="font-serif text-xl font-semibold text-royal"
        >
          Smart Plan ✨
        </h2>
        <p className="mt-2 font-sans text-sm text-royal/75">
          Tell us about your family and how you like to travel — we&apos;ll draft
          a day-by-day plan you can tweak.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-3">
          <label className="block">
            <span className="font-sans text-sm font-medium text-royal">
              Your trip style &amp; priorities
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              rows={6}
              maxLength={MAX_CHARS}
              placeholder={`We're a family of 4 with two kids aged 8 and 10. The kids love roller coasters and Star Wars. My wife hates queueing. We want one rest day in the middle. Budget is moderate.`}
              className="mt-2 w-full resize-y rounded-lg border border-royal/25 px-3 py-3 font-sans text-sm text-royal placeholder:text-royal/35"
              disabled={isGenerating}
            />
            <span
              className={`mt-1 block text-right font-sans text-xs ${
                over ? "text-red-600" : "text-royal/50"
              }`}
            >
              {text.length} / {MAX_CHARS}
            </span>
          </label>

          {showFreeTierNote ? (
            <p className="font-sans text-xs text-royal/65">
              Free plan:{" "}
              <strong className="font-semibold text-royal">
                {Math.min(generationsUsedThisTrip, freeTierCap)} of{" "}
                {freeTierCap}
              </strong>{" "}
              generations used for this trip
            </p>
          ) : (
            <p className="font-sans text-xs text-royal/60">
              Your plan includes premium AI models and higher limits.
            </p>
          )}

          {submitError ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-900"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-lg border border-royal/30 bg-white px-4 py-2.5 font-sans text-sm font-medium text-royal disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || over || !text.trim()}
              className="min-w-[12rem] flex-1 rounded-lg bg-gold px-4 py-3 font-serif text-sm font-semibold text-royal shadow-sm transition hover:brightness-105 disabled:opacity-60"
            >
              {isGenerating ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-royal/30 border-t-royal"
                    aria-hidden
                  />
                  Generating your plan…
                </span>
              ) : (
                "Generate plan ✨"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
