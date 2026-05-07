import assert from "node:assert";
import type { AiDayTimeline } from "@/lib/types";
import {
  deriveDayPlanFromTimeline,
  type DerivedDayPlan,
} from "./derive-slots-from-timeline";

function assertPlan(
  actual: DerivedDayPlan,
  expect: DerivedDayPlan,
  label: string,
) {
  const slots: (keyof DerivedDayPlan)[] = ["am", "pm", "lunch", "dinner"];
  for (const k of slots) {
    const a = actual[k];
    const e = expect[k];
    assert.deepStrictEqual(
      a == null ? null : { ...a, entryIds: [...a.entryIds].sort() },
      e == null ? null : { ...e, entryIds: [...e.entryIds].sort() },
      `${label} — slot ${k}`,
    );
  }
}

const base: Pick<AiDayTimeline, "park_hours" | "must_do"> = {
  park_hours: { open: "09:00", close: "21:00" },
  must_do: ["A", "B", "C"],
};

function t(
  partial: Omit<AiDayTimeline, "generated_at" | "model">,
): AiDayTimeline {
  return {
    generated_at: "2026-01-01T12:00:00.000Z",
    model: "haiku-4.5",
    ...partial,
  };
}

assertPlan(deriveDayPlanFromTimeline(undefined), {
  am: null,
  pm: null,
  lunch: null,
  dinner: null,
}, "empty arg");

assertPlan(
  deriveDayPlanFromTimeline(
    t({
      ...base,
      timeline: [],
    }),
  ),
  { am: null, pm: null, lunch: null, dinner: null },
  "empty timeline arr",
);

const morningOnly = deriveDayPlanFromTimeline(
  t({
    ...base,
    timeline: [
      { time: "09:00", block: "morning", title: "Rope drop" },
      { time: "11:00", block: "morning", title: "Lands tour" },
    ],
  }),
);
assert(morningOnly.am?.label === "Rope drop");
assert(morningOnly.am?.sublabel === "+1 more");
assert(morningOnly.pm === null);

const fullDay = deriveDayPlanFromTimeline(
  t({
    ...base,
    timeline: [
      { time: "09:00", block: "morning", title: "MK — Main Street" },
      { time: "12:00", block: "lunch", title: "Be Our Guest", tag: "adr" },
      { time: "14:00", block: "afternoon", title: "Fantasyland" },
      { time: "18:30", block: "dinner", title: "California Grill" },
    ],
  }),
);
assert(fullDay.am?.label === "MK — Main Street");
assert(fullDay.lunch?.label === "Be Our Guest");
assert(fullDay.pm?.label === "Fantasyland");
assert(fullDay.dinner?.label === "California Grill");

const eveningInDinner = deriveDayPlanFromTimeline(
  t({
    ...base,
    timeline: [
      { time: "09:00", block: "morning", title: "Park open" },
      { time: "12:00", block: "lunch", title: "Quick service" },
      { time: "15:00", block: "afternoon", title: "Shows" },
      { time: "21:00", block: "evening", title: "Night spectacular" },
    ],
  }),
);
assert(eveningInDinner.dinner?.label === "Night spectacular");

console.log("derive-slots-from-timeline tests: OK");
