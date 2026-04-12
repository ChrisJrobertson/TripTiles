/**
 * Informational dining suggestions by planner region (not assignable tiles).
 * Keys match `regions.id` where possible; combo keys are handled in `getRegionalDining`.
 */

export interface DiningRecommendation {
  name: string;
  type: "chain" | "local_favourite" | "fast_food";
  description: string;
  priceRange: "$" | "$$" | "$$$";
}

function dedupeByName(items: DiningRecommendation[]): DiningRecommendation[] {
  const seen = new Set<string>();
  const out: DiningRecommendation[] = [];
  for (const x of items) {
    const k = x.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/** Shared UK set for regional cities (not London / Edinburgh-specific lists). */
const UK_SHARED: DiningRecommendation[] = [
  {
    name: "Nando's",
    type: "chain",
    description: "Peri-peri chicken — reliable family favourite",
    priceRange: "$$",
  },
  {
    name: "Wagamama",
    type: "chain",
    description: "Asian-inspired — noodles and rice bowls",
    priceRange: "$$",
  },
  {
    name: "Pizza Express",
    type: "chain",
    description: "Italian chain — good kids' menu, dough balls",
    priceRange: "$$",
  },
  {
    name: "Prezzo",
    type: "chain",
    description: "Italian — another solid family option",
    priceRange: "$$",
  },
  {
    name: "Harvester",
    type: "chain",
    description: "Carvery and salad bar — classic family dining",
    priceRange: "$$",
  },
  {
    name: "Toby Carvery",
    type: "chain",
    description: "Sunday roast carvery — kids eat cheap",
    priceRange: "$$",
  },
];

export const REGIONAL_DINING: Record<string, DiningRecommendation[]> = {
  orlando: [
    {
      name: "LongHorn Steakhouse",
      type: "chain",
      description: "Steakhouse chain — generous portions, family-friendly",
      priceRange: "$$",
    },
    {
      name: "The Cheesecake Factory",
      type: "chain",
      description: "Huge menu, massive portions, something for everyone",
      priceRange: "$$",
    },
    {
      name: "Olive Garden",
      type: "chain",
      description: "Italian-American — unlimited breadsticks, kids love it",
      priceRange: "$$",
    },
    {
      name: "Chick-fil-A",
      type: "chain",
      description: "Chicken sandwiches — fast, reliable, closed Sundays",
      priceRange: "$",
    },
    {
      name: "Texas Roadhouse",
      type: "chain",
      description: "Steakhouse — free peanuts, hand-cut steaks, loud and fun",
      priceRange: "$$",
    },
    {
      name: "Buca di Beppo",
      type: "chain",
      description: "Italian family-style — big shareable platters",
      priceRange: "$$",
    },
    {
      name: "Bahama Breeze",
      type: "chain",
      description: "Caribbean-inspired — relaxed vibe, good cocktails",
      priceRange: "$$",
    },
    {
      name: "Bubba Gump Shrimp Co.",
      type: "chain",
      description: "Seafood chain — touristy but fun for families",
      priceRange: "$$",
    },
    {
      name: "Outback Steakhouse",
      type: "chain",
      description: "Australian-themed steakhouse — solid family option",
      priceRange: "$$",
    },
    {
      name: "Raising Cane's",
      type: "chain",
      description: "Chicken fingers — simple menu, kids' favourite",
      priceRange: "$",
    },
  ],
  cali: [
    {
      name: "In-N-Out Burger",
      type: "chain",
      description: "California classic — fresh burgers, must-try for visitors",
      priceRange: "$",
    },
    {
      name: "The Cheesecake Factory",
      type: "chain",
      description: "Huge menu, massive portions, something for everyone",
      priceRange: "$$",
    },
    {
      name: "Chick-fil-A",
      type: "chain",
      description: "Chicken sandwiches — fast, reliable, closed Sundays",
      priceRange: "$",
    },
    {
      name: "Olive Garden",
      type: "chain",
      description: "Italian-American — unlimited breadsticks, kids love it",
      priceRange: "$$",
    },
    {
      name: "BJ's Restaurant & Brewhouse",
      type: "chain",
      description: "Deep-dish pizza, burgers, great desserts",
      priceRange: "$$",
    },
    {
      name: "Rubio's Coastal Grill",
      type: "chain",
      description: "Fish tacos — fresh, Baja-style, great value",
      priceRange: "$",
    },
    {
      name: "Red Robin",
      type: "chain",
      description: "Burgers and bottomless fries — family-friendly",
      priceRange: "$$",
    },
    {
      name: "El Pollo Loco",
      type: "chain",
      description: "Grilled chicken — Mexican-inspired, good value",
      priceRange: "$",
    },
  ],
  miami: [
    {
      name: "Flanigan's Seafood",
      type: "chain",
      description: "Local seafood chain — ribs and fish, South Florida staple",
      priceRange: "$$",
    },
    {
      name: "The Cheesecake Factory",
      type: "chain",
      description: "Huge menu, massive portions, something for everyone",
      priceRange: "$$",
    },
    {
      name: "Pollo Tropical",
      type: "chain",
      description: "Caribbean-style chicken — fast, fresh, regional chain",
      priceRange: "$",
    },
    {
      name: "Publix Deli",
      type: "chain",
      description: "Supermarket deli — famous Pub Subs, perfect for beach lunches",
      priceRange: "$",
    },
    {
      name: "LongHorn Steakhouse",
      type: "chain",
      description: "Steakhouse chain — generous portions, family-friendly",
      priceRange: "$$",
    },
    {
      name: "Shake Shack",
      type: "chain",
      description: "Burgers and shakes — multiple Miami locations",
      priceRange: "$$",
    },
  ],
  lasvegas: [
    {
      name: "In-N-Out Burger",
      type: "chain",
      description: "California classic — multiple Vegas locations",
      priceRange: "$",
    },
    {
      name: "The Cheesecake Factory",
      type: "chain",
      description: "Huge menu — locations at Forum Shops and more",
      priceRange: "$$",
    },
    {
      name: "Raising Cane's",
      type: "chain",
      description: "Chicken fingers — simple menu, kids' favourite",
      priceRange: "$",
    },
    {
      name: "Heart Attack Grill",
      type: "chain",
      description: "Vegas novelty — huge burgers, hospital theme",
      priceRange: "$$",
    },
    {
      name: "Hash House A Go Go",
      type: "chain",
      description: "Massive portions — great brunch spot",
      priceRange: "$$",
    },
    {
      name: "Chick-fil-A",
      type: "chain",
      description: "Chicken sandwiches — fast, reliable, closed Sundays",
      priceRange: "$",
    },
  ],
  paris: [
    {
      name: "Hippopotamus",
      type: "chain",
      description: "Steakhouse chain — family-friendly, reliable across Paris",
      priceRange: "$$",
    },
    {
      name: "Flunch",
      type: "chain",
      description: "Self-service buffet — cheap and cheerful, kids eat well",
      priceRange: "$",
    },
    {
      name: "Léon de Bruxelles",
      type: "chain",
      description: "Mussels and frites — fun for families",
      priceRange: "$$",
    },
    {
      name: "Buffalo Grill",
      type: "chain",
      description: "American-style grill — steaks, burgers, kids' menu",
      priceRange: "$$",
    },
    {
      name: "Paul",
      type: "chain",
      description: "Bakery chain — pastries, sandwiches, great for breakfast",
      priceRange: "$",
    },
    {
      name: "Brioche Dorée",
      type: "chain",
      description: "Bakery chain — quick lunches, croissants, good value",
      priceRange: "$",
    },
  ],
  london: [
    {
      name: "Wagamama",
      type: "chain",
      description: "Asian-inspired — fast, family-friendly, noodles and rice",
      priceRange: "$$",
    },
    {
      name: "Nando's",
      type: "chain",
      description: "Peri-peri chicken — a UK institution, kids love it",
      priceRange: "$$",
    },
    {
      name: "Pizza Express",
      type: "chain",
      description: "Italian — reliable, Piccadilly has the original",
      priceRange: "$$",
    },
    {
      name: "GBK (Gourmet Burger Kitchen)",
      type: "chain",
      description: "Burgers — step up from fast food",
      priceRange: "$$",
    },
    {
      name: "Dishoom",
      type: "chain",
      description: "Bombay-inspired — iconic, worth the queue",
      priceRange: "$$$",
    },
    {
      name: "The Ivy",
      type: "chain",
      description: "British brasserie — great for a family treat",
      priceRange: "$$$",
    },
    {
      name: "Leon",
      type: "chain",
      description: "Healthy fast food — good for quick lunches",
      priceRange: "$",
    },
    {
      name: "Honest Burgers",
      type: "chain",
      description: "British burger chain — rosemary chips are famous",
      priceRange: "$$",
    },
  ],
  edinburgh: [
    {
      name: "Nando's",
      type: "chain",
      description: "Peri-peri chicken — reliable and family-friendly",
      priceRange: "$$",
    },
    {
      name: "Wagamama",
      type: "chain",
      description: "Asian-inspired — noodles, katsu curry, kids' menu",
      priceRange: "$$",
    },
    {
      name: "Mums Great Comfort Food",
      type: "local_favourite",
      description: "Scottish comfort food — haggis, pies, homely",
      priceRange: "$$",
    },
    {
      name: "Pizza Express",
      type: "chain",
      description: "Italian chain — reliable, good kids' menu",
      priceRange: "$$",
    },
  ],
  tokyo: [
    {
      name: "CoCo Ichibanya",
      type: "chain",
      description: "Curry house chain — customisable curry, huge portions",
      priceRange: "$",
    },
    {
      name: "Ichiran Ramen",
      type: "chain",
      description: "Solo-booth ramen — iconic experience, Shibuya location",
      priceRange: "$$",
    },
    {
      name: "Genki Sushi",
      type: "chain",
      description: "Conveyor belt sushi — fun for kids, great value",
      priceRange: "$",
    },
    {
      name: "Saizeriya",
      type: "chain",
      description: "Italian-Japanese — absurdly cheap, family-friendly",
      priceRange: "$",
    },
    {
      name: "Mos Burger",
      type: "chain",
      description: "Japanese burger chain — rice burgers, unique flavours",
      priceRange: "$",
    },
    {
      name: "Yoshinoya",
      type: "chain",
      description: "Beef bowl chain — fast, cheap, filling",
      priceRange: "$",
    },
  ],
  uae: [
    {
      name: "The Cheesecake Factory",
      type: "chain",
      description: "Dubai Mall and Yas Island locations",
      priceRange: "$$",
    },
    {
      name: "Texas Roadhouse",
      type: "chain",
      description: "American steakhouse — family-friendly, good value",
      priceRange: "$$",
    },
    {
      name: "Nando's",
      type: "chain",
      description: "Peri-peri chicken — popular across the UAE",
      priceRange: "$$",
    },
    {
      name: "Shakespeare and Co.",
      type: "chain",
      description: "European café — great breakfast, literary theme",
      priceRange: "$$",
    },
    {
      name: "Al Fanar",
      type: "local_favourite",
      description: "Traditional Emirati — authentic local dining experience",
      priceRange: "$$",
    },
  ],
  goldcoast: [
    // VERIFY: exact venue name may vary on the Gold Coast strip
    {
      name: "Pancakes in Paradise",
      type: "chain",
      description: "Pancakes and crepes — Surfers Paradise institution",
      priceRange: "$$",
    },
    {
      name: "Grill'd",
      type: "chain",
      description: "Healthy burgers — Australian chain, great for families",
      priceRange: "$$",
    },
    {
      name: "Nando's",
      type: "chain",
      description: "Peri-peri chicken — multiple Gold Coast locations",
      priceRange: "$$",
    },
    {
      name: "Betty's Burgers",
      type: "chain",
      description: "Australian burger chain — concrete shakes are famous",
      priceRange: "$$",
    },
  ],
  singapore: [
    {
      name: "Ya Kun Kaya Toast",
      type: "chain",
      description: "Kaya toast and soft-boiled eggs — essential local breakfast",
      priceRange: "$",
    },
    {
      name: "Din Tai Fung",
      type: "chain",
      description: "Taiwanese dumplings — Michelin-starred chain",
      priceRange: "$$",
    },
    {
      name: "Toast Box",
      type: "chain",
      description: "Local café chain — similar to Ya Kun, good for kids",
      priceRange: "$",
    },
    {
      name: "Jumbo Seafood",
      type: "chain",
      description: "Chilli crab — iconic Singapore dish, family-friendly",
      priceRange: "$$$",
    },
  ],
  seoul: [
    {
      name: "Myeongdong Kyoja",
      type: "local_favourite",
      description: "Famous noodle soup — must-visit, always a queue",
      priceRange: "$$",
    },
    {
      name: "Tosokchon Samgyetang",
      type: "local_favourite",
      description: "Ginseng chicken soup — traditional, family-friendly",
      priceRange: "$$",
    },
    {
      name: "Isaac Toast",
      type: "chain",
      description: "Korean toast sandwiches — cheap, delicious breakfast",
      priceRange: "$",
    },
    {
      name: "BHC Chicken",
      type: "chain",
      description: "Korean fried chicken chain — crispy, sweet, addictive",
      priceRange: "$",
    },
  ],
  uk_shared: UK_SHARED,
};

/** Regions that use `uk_shared` when no dedicated list exists. */
export const UK_REGION_IDS_USING_SHARED_LIST: readonly string[] = [
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
];

export function getRegionalDining(regionId: string | null): DiningRecommendation[] {
  if (!regionId) return [];
  if (regionId === "florida_combo") {
    return dedupeByName([
      ...(REGIONAL_DINING.orlando ?? []),
      ...(REGIONAL_DINING.miami ?? []),
    ]);
  }
  if (regionId === "uk_combo") {
    return [...(REGIONAL_DINING.uk_shared ?? [])];
  }
  const direct = REGIONAL_DINING[regionId];
  if (direct && regionId !== "uk_shared") return [...direct];
  if (UK_REGION_IDS_USING_SHARED_LIST.includes(regionId)) {
    return [...(REGIONAL_DINING.uk_shared ?? [])];
  }
  return [];
}

/** Single paragraph for Smart Plan user message; null if none. */
export function formatRegionalDiningForPrompt(
  regionId: string | null,
): string | null {
  const list = getRegionalDining(regionId);
  if (list.length === 0) return null;
  const names = list.map((d) => d.name).join(", ");
  return `Popular nearby restaurants in this area include: ${names}. You may mention 1–2 of these as lunch or dinner suggestions in itinerary notes only — do not assign them to calendar slots; they are not park tiles.`;
}

// TODO: Add verified dining recommendations for: germany, spain, netherlands,
// denmark, italy, belgium, sweden, finland, osaka, shanghai, hongkong,
// toronto, mexico, and any other active regions not listed above.
