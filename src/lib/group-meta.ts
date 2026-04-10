export const GROUP_META: Record<
  string,
  { label: string; openByDefault: boolean }
> = {
  travel: { label: "Travel & Cruise", openByDefault: true },
  disney: { label: "Theme Parks", openByDefault: true },
  disneyextra: { label: "Water Parks & Extras", openByDefault: false },
  universal: { label: "More Theme Parks", openByDefault: false },
  seaworld: { label: "Marine / Wildlife Parks", openByDefault: false },
  attractions: { label: "Other Attractions", openByDefault: false },
  sights: { label: "City Sights & Day Trips", openByDefault: false },
  excursions: { label: "Cruise Excursions", openByDefault: false },
  dining: { label: "Dining", openByDefault: false },
  activities: { label: "Activities & Rest", openByDefault: false },
};

export const GROUP_ORDER = [
  "travel",
  "disney",
  "disneyextra",
  "universal",
  "seaworld",
  "attractions",
  "sights",
  "excursions",
  "dining",
  "activities",
] as const;
