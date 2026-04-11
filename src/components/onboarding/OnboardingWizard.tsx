"use client";

import {
  createTripAction,
  updateTripMetadataAction,
  updateTripPreferencesPatchAction,
} from "@/actions/trips";
import type { Region } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

const VIBES: { id: string; label: string }[] = [
  { id: "packed", label: "Go go go — as many parks as possible" },
  { id: "balanced", label: "Balanced — parks with rest days" },
  { id: "relaxed", label: "Relaxed — lots of pool time" },
  { id: "foodie", label: "Foodie — focus on dining experiences" },
];

type Props = {
  firstName: string;
  regions: Region[];
};

export function OnboardingWizard({ firstName, regions }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [adventureName, setAdventureName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [vibe, setVibe] = useState<string>("balanced");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === regionId) ?? null,
    [regions, regionId],
  );

  const defaultAdventure = useMemo(() => {
    const n =
      selectedRegion?.short_name?.trim() ||
      selectedRegion?.name?.trim() ||
      "theme park";
    return `My ${n} adventure`;
  }, [selectedRegion]);

  const goPlanner = useCallback(() => {
    router.push("/planner");
    router.refresh();
  }, [router]);

  const finish = useCallback(async () => {
    if (!regionId || !startDate || !endDate) return;
    setBusy(true);
    setErr(null);
    const name =
      adventureName.trim() || defaultAdventure;
    const r = await createTripAction({
      familyName: "My family",
      adventureName: name,
      regionId,
      startDate,
      endDate,
      hasCruise: false,
    });
    if (!r.ok) {
      setErr(r.error);
      setBusy(false);
      return;
    }
    const meta = await updateTripMetadataAction({
      tripId: r.tripId,
      adults,
      children,
    });
    if (!meta.ok) {
      setErr(meta.error);
      setBusy(false);
      return;
    }
    const pref = await updateTripPreferencesPatchAction({
      tripId: r.tripId,
      patch: { onboarding_vibe: vibe },
    });
    if (!pref.ok) {
      setErr(pref.error);
      setBusy(false);
      return;
    }
    router.push("/planner");
    router.refresh();
  }, [
    regionId,
    startDate,
    endDate,
    adventureName,
    defaultAdventure,
    adults,
    children,
    vibe,
    router,
  ]);

  const featured = useMemo(
    () => regions.filter((r) => r.is_featured).slice(0, 24),
    [regions],
  );
  const grid = featured.length > 0 ? featured : regions.slice(0, 24);

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={goPlanner}
          className="font-sans text-sm font-medium text-royal/70 underline-offset-2 hover:text-royal"
        >
          Skip and go to planner
        </button>
      </div>

      <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8 shadow-lg">
        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-2 w-8 rounded-full ${
                i === step ? "bg-gold" : "bg-royal/15"
              }`}
              aria-label={`Step ${i + 1} of 4`}
            />
          ))}
        </div>

        {err ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800">
            {err}
          </p>
        ) : null}

        {step === 0 ? (
          <div className="mt-8 text-center">
            <h1 className="font-serif text-2xl font-semibold text-royal md:text-3xl">
              Welcome to TripTiles{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-3 font-sans text-sm leading-relaxed text-royal/75">
              Let&apos;s plan your first adventure in a couple of minutes.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-8 w-full rounded-lg bg-gradient-to-r from-gold to-[#b8924f] py-3 font-serif text-base font-semibold text-royal shadow-md"
            >
              Get started
            </button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-8">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Where are you going?
            </h1>
            <div className="mt-4 grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {grid.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRegionId(r.id);
                    setAdventureName("");
                    setStep(2);
                  }}
                  className={`rounded-xl border px-3 py-3 text-left font-sans text-sm transition ${
                    regionId === r.id
                      ? "border-gold bg-gold/15"
                      : "border-royal/15 bg-cream hover:border-gold/40"
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {r.flag_emoji ?? "🌍"}
                  </span>
                  <p className="mt-1 font-semibold text-royal">
                    {r.short_name?.trim() || r.name}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center font-sans text-xs text-royal/50">
              More destinations are available inside the planner.
            </p>
          </div>
        ) : null}

        {step === 2 && regionId ? (
          <div className="mt-8 space-y-4">
            <h1 className="font-serif text-xl font-semibold text-royal">
              Trip basics
            </h1>
            <label className="block font-sans text-sm text-royal">
              Adventure name
              <input
                className="mt-1 w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                value={adventureName}
                onChange={(e) => setAdventureName(e.target.value)}
                placeholder={defaultAdventure}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-sans text-sm text-royal">
                Start date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block font-sans text-sm text-royal">
                End date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block font-sans text-sm text-royal">
                Adults
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                />
              </label>
              <label className="block font-sans text-sm text-royal">
                Children
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border-2 border-royal/20 px-3 py-2"
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!startDate || !endDate}
              onClick={() => setStep(3)}
              className="w-full rounded-lg bg-royal py-3 font-serif text-sm font-semibold text-cream disabled:opacity-50"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full font-sans text-sm text-royal/60 underline"
            >
              Back
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-8 space-y-4">
            <h1 className="font-serif text-xl font-semibold text-royal">
              How do you travel?
            </h1>
            <div className="space-y-2">
              {VIBES.map((v) => (
                <label
                  key={v.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-royal/15 bg-cream px-3 py-2 has-[:checked]:border-gold/60"
                >
                  <input
                    type="radio"
                    name="vibe"
                    checked={vibe === v.id}
                    onChange={() => setVibe(v.id)}
                    className="mt-1 accent-royal"
                  />
                  <span className="font-sans text-sm text-royal">{v.label}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish()}
              className="w-full rounded-lg bg-gradient-to-r from-gold to-[#b8924f] py-3 font-serif text-base font-semibold text-royal shadow-md disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create my trip"}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full font-sans text-sm text-royal/60 underline"
            >
              Back
            </button>
          </div>
        ) : null}

        <p className="mt-8 text-center font-sans text-xs text-royal/45">
          <Link href="/" className="underline">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
