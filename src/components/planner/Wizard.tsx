"use client";

import { daysBetween, formatDateISO, parseDate } from "@/lib/date-helpers";
import type { Destination, Trip, WizardData } from "@/lib/types";
import { useEffect, useState } from "react";

type Props = {
  isOpen: boolean;
  isFirstRun: boolean;
  initialData: Partial<Trip>;
  onClose: () => void;
  onComplete: (data: WizardData) => Promise<boolean | void>;
};

const DEST_OPTIONS: {
  value: Destination;
  label: string;
  emoji: string;
}[] = [
  { value: "orlando", label: "Orlando", emoji: "🏰" },
  { value: "paris", label: "Paris", emoji: "🗼" },
  { value: "tokyo", label: "Tokyo", emoji: "🗾" },
  { value: "cali", label: "California", emoji: "🌴" },
  { value: "cruise", label: "Cruise Only", emoji: "🚢" },
  { value: "custom", label: "Other", emoji: "🌍" },
];

function defaultDates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() + 90);
  const end = new Date(today);
  end.setDate(end.getDate() + 104);
  return {
    start_date: formatDateISO(start),
    end_date: formatDateISO(end),
  };
}

export function Wizard({
  isOpen,
  isFirstRun,
  initialData,
  onClose,
  onComplete,
}: Props) {
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState("My Family");
  const [adventureName, setAdventureName] = useState("A Magical Adventure");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [destination, setDestination] = useState<Destination>("orlando");
  const [hasCruise, setHasCruise] = useState(false);
  const [cruiseEmbark, setCruiseEmbark] = useState("");
  const [cruiseDisembark, setCruiseDisembark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setError(null);
    const defs = defaultDates();
    setFamilyName(initialData.family_name ?? "My Family");
    setAdventureName(initialData.adventure_name ?? "A Magical Adventure");
    setStartDate(initialData.start_date ?? defs.start_date);
    setEndDate(initialData.end_date ?? defs.end_date);
    setDestination((initialData.destination as Destination) ?? "orlando");
    setHasCruise(initialData.has_cruise ?? false);
    setCruiseEmbark(initialData.cruise_embark ?? "");
    setCruiseDisembark(initialData.cruise_disembark ?? "");
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  function validateStep1(): boolean {
    if (!familyName.trim() || !adventureName.trim()) {
      setError("Please enter both family name and adventure title.");
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep2(): boolean {
    const s = parseDate(startDate);
    const e = parseDate(endDate);
    if (e <= s) {
      setError("End date must be after start date.");
      return false;
    }
    if (daysBetween(s, e) > 60) {
      setError("Trip cannot be longer than 60 days.");
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep4(): boolean {
    if (!hasCruise) {
      setError(null);
      return true;
    }
    if (!cruiseEmbark || !cruiseDisembark) {
      setError("Enter both embark and disembark dates for your cruise.");
      return false;
    }
    const tripS = parseDate(startDate);
    const tripE = parseDate(endDate);
    const emb = parseDate(cruiseEmbark);
    const dis = parseDate(cruiseDisembark);
    if (dis <= emb) {
      setError("Disembark must be after embark.");
      return false;
    }
    if (emb < tripS || emb > tripE || dis < tripS || dis > tripE) {
      setError("Cruise dates must fall within your trip dates.");
      return false;
    }
    setError(null);
    return true;
  }

  async function finish(skipCruiseDetails?: boolean) {
    const data: WizardData = {
      family_name: familyName.trim(),
      adventure_name: adventureName.trim(),
      start_date: startDate,
      end_date: endDate,
      destination,
      has_cruise: skipCruiseDetails ? false : hasCruise,
      cruise_embark:
        !skipCruiseDetails && hasCruise ? cruiseEmbark : null,
      cruise_disembark:
        !skipCruiseDetails && hasCruise ? cruiseDisembark : null,
    };
    setSubmitting(true);
    try {
      const close = await onComplete(data);
      if (close !== false) onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[rgba(11,30,92,0.85)] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="my-auto w-full max-w-lg rounded-2xl border border-gold/40 bg-cream p-5 shadow-2xl sm:p-8 min-[0px]:min-h-[min(100%,36rem)] sm:min-h-0">
        <p className="font-sans text-sm font-medium text-royal/80">
          Step {step} of 4
        </p>
        <h2 className="mt-2 font-serif text-xl font-semibold text-royal">
          {isFirstRun ? "Plan your trip" : "Edit trip"}
        </h2>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="font-sans text-sm font-medium text-royal">
                Family / group name
              </span>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-3 text-base text-royal"
              />
            </label>
            <label className="block">
              <span className="font-sans text-sm font-medium text-royal">
                Adventure title
              </span>
              <input
                type="text"
                value={adventureName}
                onChange={(e) => setAdventureName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-3 text-base text-royal"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="font-sans text-sm font-medium text-royal">
                Start date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-3 text-base text-royal"
              />
            </label>
            <label className="block">
              <span className="font-sans text-sm font-medium text-royal">
                End date
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-3 text-base text-royal"
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DEST_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setDestination(o.value)}
                className={`rounded-xl border-2 px-3 py-4 text-center font-sans text-sm font-medium transition ${
                  destination === o.value
                    ? "border-royal bg-white shadow-md"
                    : "border-royal/15 bg-white/70 hover:border-gold/50"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {o.emoji}
                </span>
                <span className="mt-2 block text-royal">{o.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-6 space-y-4">
            <label className="flex items-center gap-2 font-sans text-sm text-royal">
              <input
                type="checkbox"
                checked={hasCruise}
                onChange={(e) => setHasCruise(e.target.checked)}
              />
              Include a cruise segment
            </label>
            {hasCruise ? (
              <>
                <label className="block">
                  <span className="font-sans text-sm font-medium text-royal">
                    Embark
                  </span>
                  <input
                    type="date"
                    value={cruiseEmbark}
                    onChange={(e) => setCruiseEmbark(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-2 text-base"
                  />
                </label>
                <label className="block">
                  <span className="font-sans text-sm font-medium text-royal">
                    Disembark
                  </span>
                  <input
                    type="date"
                    value={cruiseDisembark}
                    onChange={(e) => setCruiseDisembark(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-royal/25 px-3 py-2 text-base"
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
              className="rounded-lg border border-royal/30 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-royal/30 bg-white px-4 py-2 font-sans text-sm text-royal"
            >
              Cancel
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !validateStep1()) return;
                if (step === 2 && !validateStep2()) return;
                setStep((s) => s + 1);
              }}
              className="rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream"
            >
              Next
            </button>
          ) : (
            <>
              {step === 4 && hasCruise ? (
                <button
                  type="button"
                  onClick={() => void finish(true)}
                  disabled={submitting}
                  className="rounded-lg border border-royal/30 bg-white px-4 py-2 font-sans text-sm text-royal"
                >
                  Skip cruise details
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (step === 4 && !validateStep4()) return;
                  void finish(false);
                }}
                disabled={submitting}
                className="rounded-lg bg-gold px-4 py-2 font-sans text-sm font-semibold text-royal disabled:opacity-60"
              >
                {submitting ? "Saving…" : "All Done"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
