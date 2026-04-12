"use client";

import { updateProfileTemperatureUnitAction } from "@/actions/profile-preferences";
import type { TemperatureUnit } from "@/lib/types";
import { useState } from "react";

export function TemperatureUnitSettings({
  initial,
}: {
  initial: TemperatureUnit;
}) {
  const [unit, setUnit] = useState<TemperatureUnit>(initial);
  const [saving, setSaving] = useState(false);

  async function choose(next: TemperatureUnit) {
    if (next === unit || saving) return;
    setSaving(true);
    const res = await updateProfileTemperatureUnitAction(next);
    setSaving(false);
    if (res.ok) setUnit(next);
  }

  return (
    <fieldset className="mt-4">
      <legend className="font-sans text-sm font-semibold text-royal">
        Temperature unit
      </legend>
      <p className="mt-1 font-sans text-sm text-royal/65">
        How weather appears on your planner calendar (static monthly averages,
        not live forecasts).
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-royal/15 bg-cream/60 px-4 py-3 has-[:checked]:border-gold has-[:checked]:bg-white">
          <input
            type="radio"
            name="temperature_unit"
            className="h-5 w-5 accent-royal"
            checked={unit === "c"}
            disabled={saving}
            onChange={() => void choose("c")}
          />
          <span className="font-sans text-sm text-royal">Celsius (°C)</span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-royal/15 bg-cream/60 px-4 py-3 has-[:checked]:border-gold has-[:checked]:bg-white">
          <input
            type="radio"
            name="temperature_unit"
            className="h-5 w-5 accent-royal"
            checked={unit === "f"}
            disabled={saving}
            onChange={() => void choose("f")}
          />
          <span className="font-sans text-sm text-royal">Fahrenheit (°F)</span>
        </label>
      </div>
    </fieldset>
  );
}
