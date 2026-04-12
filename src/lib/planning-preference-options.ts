import type { PlanningPace } from "@/lib/types";

export const PRIORITY_OPTIONS: { id: string; label: string; emoji: string }[] =
  [
    { id: "thrill_rides", label: "Thrill rides", emoji: "🎢" },
    { id: "toddler_friendly", label: "Toddler-friendly", emoji: "👶" },
    { id: "dining", label: "Great dining", emoji: "🍕" },
    { id: "shows", label: "Shows & entertainment", emoji: "🎭" },
    { id: "water", label: "Water parks & pools", emoji: "💦" },
    { id: "characters", label: "Character meet & greets", emoji: "📸" },
    { id: "shopping", label: "Shopping & downtime", emoji: "🛍️" },
    { id: "evenings", label: "Evening events & fireworks", emoji: "🌙" },
  ];

export const PACE_OPTIONS: {
  id: PlanningPace;
  emoji: string;
  title: string;
  body: string;
}[] = [
  {
    id: "relaxed",
    emoji: "🐢",
    title: "Relaxed",
    body: "Pool mornings, one park per day, early bedtimes",
  },
  {
    id: "balanced",
    emoji: "🚶",
    title: "Balanced",
    body: "A good mix of parks and downtime",
  },
  {
    id: "intense",
    emoji: "🏃",
    title: "Go go go!",
    body: "Maximise every minute — we will sleep on the plane",
  },
];
