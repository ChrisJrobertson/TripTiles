export type ChecklistClimate = "hot" | "cold" | "mild";

export interface ChecklistTemplate {
  category: string;
  label: string;
  conditions?: {
    climate?: ChecklistClimate;
    hasKids?: boolean;
    hasCruise?: boolean;
  };
}

const HOT_REGIONS = new Set([
  "orlando",
  "cali",
  "miami",
  "lasvegas",
  "uae",
  "singapore",
  "goldcoast",
  "florida_combo",
]);

const UK_LIKE = new Set([
  "london",
  "edinburgh",
  "uk_combo",
  "bath",
  "liverpool",
  "york",
  "manchester",
  "cambridge",
  "lakedist",
  "cornwall",
  "highlands",
  "cardiff",
  "belfast",
  "brighton",
  "stratfm",
]);

const COLD_MONTHS = new Set([11, 12, 1, 2, 3]);

export function inferTripClimate(
  regionId: string,
  tripStartMonth: number,
): ChecklistClimate {
  if (HOT_REGIONS.has(regionId)) return "hot";
  if (regionId === "tokyo" || regionId === "seoul" || regionId === "hongkong") {
    if (tripStartMonth >= 6 && tripStartMonth <= 8) return "hot";
    return "mild";
  }
  if (UK_LIKE.has(regionId)) {
    return COLD_MONTHS.has(tripStartMonth) ? "cold" : "mild";
  }
  if (regionId === "paris") {
    return COLD_MONTHS.has(tripStartMonth) ? "cold" : "mild";
  }
  return "mild";
}

export const BASE_CHECKLIST: ChecklistTemplate[] = [
  { category: "packing_essentials", label: "Passports (check expiry dates!)" },
  { category: "packing_essentials", label: "Travel insurance documents" },
  {
    category: "packing_essentials",
    label: "Booking confirmations (printed + digital)",
  },
  {
    category: "packing_essentials",
    label: "Credit/debit cards + some local cash",
  },
  { category: "packing_essentials", label: "Phone chargers and power bank" },
  {
    category: "packing_essentials",
    label: "Comfortable walking shoes (broken in!)",
  },
  { category: "packing_essentials", label: "Prescription medications" },
  { category: "packing_essentials", label: "Travel adaptors" },
  {
    category: "packing_clothing",
    label: "Sunscreen (SPF 50+)",
    conditions: { climate: "hot" },
  },
  {
    category: "packing_clothing",
    label: "Sun hats for everyone",
    conditions: { climate: "hot" },
  },
  { category: "packing_clothing", label: "Sunglasses", conditions: { climate: "hot" } },
  {
    category: "packing_clothing",
    label: "Ponchos or rain jackets (afternoon storms)",
    conditions: { climate: "hot" },
  },
  {
    category: "packing_clothing",
    label: "Refillable water bottles",
    conditions: { climate: "hot" },
  },
  {
    category: "packing_clothing",
    label: "Cooling towels or portable fan",
    conditions: { climate: "hot" },
  },
  {
    category: "packing_clothing",
    label: "Swimwear and pool gear",
    conditions: { climate: "hot" },
  },
  {
    category: "packing_clothing",
    label: "Light layers (AC can be cold!)",
    conditions: { climate: "hot" },
  },
  {
    category: "packing_clothing",
    label: "Warm waterproof coat",
    conditions: { climate: "cold" },
  },
  {
    category: "packing_clothing",
    label: "Thermal layers / base layers",
    conditions: { climate: "cold" },
  },
  {
    category: "packing_clothing",
    label: "Waterproof shoes or boots",
    conditions: { climate: "cold" },
  },
  {
    category: "packing_clothing",
    label: "Hats, gloves, and scarves",
    conditions: { climate: "cold" },
  },
  { category: "packing_clothing", label: "Umbrella", conditions: { climate: "cold" } },
  {
    category: "packing_clothing",
    label: "Layers (weather can be unpredictable)",
    conditions: { climate: "mild" },
  },
  {
    category: "packing_clothing",
    label: "Light rain jacket",
    conditions: { climate: "mild" },
  },
  {
    category: "packing_clothing",
    label: "Comfortable trainers",
    conditions: { climate: "mild" },
  },
  {
    category: "packing_kids",
    label: "Autograph book and thick pen",
    conditions: { hasKids: true },
  },
  {
    category: "packing_kids",
    label: "Stroller or buggy (even for older kids — long days)",
    conditions: { hasKids: true },
  },
  { category: "packing_kids", label: "Snacks for queues", conditions: { hasKids: true } },
  {
    category: "packing_kids",
    label: "Change of clothes in day bag",
    conditions: { hasKids: true },
  },
  {
    category: "packing_kids",
    label: "Favourite toy or comfort item",
    conditions: { hasKids: true },
  },
  {
    category: "packing_kids",
    label: "Kids' headphones for flights",
    conditions: { hasKids: true },
  },
  {
    category: "packing_kids",
    label: "Nappies/wipes if needed",
    conditions: { hasKids: true },
  },
  {
    category: "packing_essentials",
    label: "Formal/smart outfit for cruise dining",
    conditions: { hasCruise: true },
  },
  {
    category: "packing_essentials",
    label: "Magnetic hooks for cabin walls",
    conditions: { hasCruise: true },
  },
  {
    category: "packing_essentials",
    label: "Lanyard for cruise key card",
    conditions: { hasCruise: true },
  },
  {
    category: "packing_essentials",
    label: "Motion sickness tablets",
    conditions: { hasCruise: true },
  },
  { category: "packing_tech", label: "Camera or GoPro" },
  { category: "packing_tech", label: "Portable battery pack (10000mAh+)" },
  { category: "packing_tech", label: "Universal travel adaptor" },
  {
    category: "packing_tech",
    label: "Tablet loaded with films for travel days",
  },
  {
    category: "before_you_go",
    label:
      "Download park apps (My Disney Experience, Universal Orlando, etc.)",
  },
  {
    category: "before_you_go",
    label: "Check dining reservation windows and book",
  },
  { category: "before_you_go", label: "Print your TripTiles itinerary PDF" },
  { category: "before_you_go", label: "Notify bank of travel dates" },
  {
    category: "before_you_go",
    label: "Arrange airport parking or transfers",
  },
  {
    category: "before_you_go",
    label: "Check passport validity (6 months from travel)",
  },
  { category: "before_you_go", label: "Buy travel insurance" },
  { category: "before_you_go", label: "Check ESTA/visa requirements" },
  {
    category: "before_you_go",
    label: "Set up mobile data / buy a local SIM",
  },
  {
    category: "at_the_park",
    label: "Arrive at rope drop for shortest queues",
  },
  {
    category: "at_the_park",
    label: "Stay hydrated — free ice water at quick service",
  },
  {
    category: "at_the_park",
    label: "Use rider swap for rides with height restrictions",
  },
  {
    category: "at_the_park",
    label: "Take a mid-day break (return for evening events)",
  },
];

export function generateChecklist(trip: {
  regionId: string;
  startDate: string;
  children: number;
  includesCruise: boolean;
}): ChecklistTemplate[] {
  const d = new Date(`${trip.startDate}T12:00:00`);
  const month = Number.isFinite(d.getTime()) ? d.getMonth() + 1 : 7;
  const climate = inferTripClimate(trip.regionId, month);
  const hasKids = trip.children > 0;
  const hasCruise = trip.includesCruise;

  return BASE_CHECKLIST.filter((item) => {
    const c = item.conditions;
    if (!c) return true;
    if (c.climate != null && c.climate !== climate) return false;
    if (c.hasKids && !hasKids) return false;
    if (c.hasCruise && !hasCruise) return false;
    return true;
  });
}
