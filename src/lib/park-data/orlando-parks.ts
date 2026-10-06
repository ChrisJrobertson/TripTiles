/**
 * Orlando park identities confirmed from provider documents on 2026-10-06.
 *
 * ThemeParks.wiki:
 *   GET https://api.themeparks.wiki/v1/destinations
 *   GET https://api.themeparks.wiki/v1/entity/{id}
 * Queue-Times:
 *   GET https://queue-times.com/parks.json
 *
 * These are durable provider entity ids. Runtime ingestion must not map by name.
 * Provider coordinates are evidence for the mapping row. They are not a licence
 * to overwrite parks.latitude / parks.longitude.
 */

export type ProviderSupport = "supported" | "unsupported";

export type OrlandoParkIdentity = {
  parkId: string;
  canonicalName: string;
  resort: string;
  /** Minimum headline set for the Orlando intelligence foundation. */
  headline: boolean;
  themeParksWikiId: string | null;
  themeParksWikiName: string | null;
  queueTimesId: string | null;
  queueTimesName: string | null;
  queueTimesSupport: ProviderSupport;
  /** From the ThemeParks.wiki entity document. There is no parks.timezone column. */
  providerTimezone: string | null;
  providerLatitude: number | null;
  providerLongitude: number | null;
  providerObservedOn: "2026-10-06";
  note: string | null;
};

export const ORLANDO_PARK_IDENTITIES: readonly OrlandoParkIdentity[] = [
  {
    parkId: "mk",
    canonicalName: "Magic Kingdom",
    resort: "Walt Disney World",
    headline: true,
    themeParksWikiId: "75ea578a-adc8-4116-a54d-dccb60765ef9",
    themeParksWikiName: "Magic Kingdom Park",
    queueTimesId: "6",
    queueTimesName: "Disney Magic Kingdom",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.4160036778,
    providerLongitude: -81.5811902834,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "ep",
    canonicalName: "EPCOT",
    resort: "Walt Disney World",
    headline: true,
    themeParksWikiId: "47f90d2c-e191-4239-a466-5892ef59a88b",
    themeParksWikiName: "EPCOT",
    queueTimesId: "5",
    queueTimesName: "Epcot",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.3762301397,
    providerLongitude: -81.5494047655,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "hs",
    canonicalName: "Hollywood Studios",
    resort: "Walt Disney World",
    headline: true,
    themeParksWikiId: "288747d1-8b4f-4a64-867e-ea7c9b27bad8",
    themeParksWikiName: "Disney's Hollywood Studios",
    queueTimesId: "7",
    queueTimesName: "Disney Hollywood Studios",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.3584111691,
    providerLongitude: -81.558689232,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "ak",
    canonicalName: "Animal Kingdom",
    resort: "Walt Disney World",
    headline: true,
    themeParksWikiId: "1c84a229-8862-4648-9c71-378ddd2c7693",
    themeParksWikiName: "Disney's Animal Kingdom Theme Park",
    queueTimesId: "8",
    queueTimesName: "Animal Kingdom",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.3553842507,
    providerLongitude: -81.5900898529,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "us",
    canonicalName: "Universal Studios Florida",
    resort: "Universal Orlando Resort",
    headline: true,
    themeParksWikiId: "eb3f4560-2383-4a36-9152-6b3e5ed6bc57",
    themeParksWikiName: "Universal Studios Florida",
    queueTimesId: "65",
    queueTimesName: "Universal Studios At Universal Orlando",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.477986,
    providerLongitude: -81.468386,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "ioa",
    canonicalName: "Islands of Adventure",
    resort: "Universal Orlando Resort",
    headline: true,
    themeParksWikiId: "267615cc-8943-4c2a-ae2c-5da728ca591f",
    themeParksWikiName: "Universal Islands of Adventure",
    queueTimesId: "64",
    queueTimesName: "Islands Of Adventure At Universal Orlando",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.47225,
    providerLongitude: -81.467594,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "eu",
    canonicalName: "Epic Universe",
    resort: "Universal Orlando Resort",
    headline: true,
    themeParksWikiId: "12dbb85b-265f-44e6-bccf-f1faa17211fc",
    themeParksWikiName: "Universal Epic Universe",
    queueTimesId: "334",
    queueTimesName: "Epic Universe",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.4414454548964,
    providerLongitude: -81.4486740912188,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "sw",
    canonicalName: "SeaWorld Orlando",
    resort: "SeaWorld Orlando",
    headline: true,
    themeParksWikiId: "27d64dee-d85e-48dc-ad6d-8077445cd946",
    themeParksWikiName: "SeaWorld Orlando",
    queueTimesId: "21",
    queueTimesName: "Seaworld Orlando",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.4109798106776,
    providerLongitude: -81.4609839717373,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "aq",
    canonicalName: "Aquatica Orlando",
    resort: "SeaWorld Orlando",
    headline: true,
    themeParksWikiId: "9e2867f8-68eb-454f-b367-0ed0fd72d72a",
    themeParksWikiName: "Aquatica Orlando",
    queueTimesId: "94",
    queueTimesName: "Aquatica Orlando",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.4157834490069,
    providerLongitude: -81.4564001169188,
    providerObservedOn: "2026-10-06",
    note: "Queue-Times park 94 was previously unlinked (park_id null). The migration fills that link only while park_id is null.",
  },
  {
    parkId: "dc",
    canonicalName: "Discovery Cove",
    resort: "SeaWorld Orlando",
    headline: true,
    themeParksWikiId: "91f5c7f3-373b-42e1-9f24-f769e4a3f7da",
    themeParksWikiName: "Discovery Cove Orlando",
    queueTimesId: null,
    queueTimesName: null,
    queueTimesSupport: "unsupported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.40508,
    providerLongitude: -81.46361,
    providerObservedOn: "2026-10-06",
    note: "Queue-Times parks.json on 2026-10-06 does not list Discovery Cove. Seed id 308 is not in that index and is not attached.",
  },
  {
    parkId: "vb",
    canonicalName: "Volcano Bay",
    resort: "Universal Orlando Resort",
    headline: false,
    themeParksWikiId: "fe78a026-b91b-470c-b906-9d2266b692da",
    themeParksWikiName: "Universal Volcano Bay",
    queueTimesId: "67",
    queueTimesName: "Universal Volcano Bay",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.461355,
    providerLongitude: -81.472286,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "tl",
    canonicalName: "Typhoon Lagoon",
    resort: "Walt Disney World",
    headline: false,
    themeParksWikiId: "b070cbc5-feaa-4b87-a8c1-f94cca037a18",
    themeParksWikiName: "Disney's Typhoon Lagoon Water Park",
    queueTimesId: null,
    queueTimesName: null,
    queueTimesSupport: "unsupported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.3650541008,
    providerLongitude: -81.5278921081,
    providerObservedOn: "2026-10-06",
    note: "Not present in the Queue-Times Walt Disney Attractions group on 2026-10-06.",
  },
  {
    parkId: "bb",
    canonicalName: "Blizzard Beach",
    resort: "Walt Disney World",
    headline: false,
    themeParksWikiId: "ead53ea5-22e5-4095-9a83-8c29300d7c63",
    themeParksWikiName: "Disney's Blizzard Beach Water Park",
    queueTimesId: null,
    queueTimesName: null,
    queueTimesSupport: "unsupported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.3525184499,
    providerLongitude: -81.5731637729,
    providerObservedOn: "2026-10-06",
    note: "Not present in the Queue-Times Walt Disney Attractions group on 2026-10-06.",
  },
  {
    parkId: "ll",
    canonicalName: "LEGOLAND Florida",
    resort: "LEGOLAND Florida",
    headline: false,
    themeParksWikiId: "bb285952-7e52-4a07-a312-d0a1ed91a9ac",
    themeParksWikiName: "LEGOLAND Florida",
    queueTimesId: "280",
    queueTimesName: "Legoland Florida",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 27.989351,
    providerLongitude: -81.688977,
    providerObservedOn: "2026-10-06",
    note: null,
  },
  {
    parkId: "bg",
    canonicalName: "Busch Gardens Tampa",
    resort: "Busch Gardens Tampa",
    headline: false,
    themeParksWikiId: "fc40c99a-be0a-42f4-a483-1e939db275c2",
    themeParksWikiName: "Busch Gardens Tampa",
    queueTimesId: "24",
    queueTimesName: "Busch Gardens Tampa",
    queueTimesSupport: "supported",
    providerTimezone: "America/New_York",
    providerLatitude: 28.0374,
    providerLongitude: -82.42144,
    providerObservedOn: "2026-10-06",
    note: "Already in the Orlando catalogue. Tampa, not the Orlando resort core.",
  },
  {
    parkId: "ds",
    canonicalName: "Disney Springs",
    resort: "Walt Disney World",
    headline: false,
    themeParksWikiId: null,
    themeParksWikiName: null,
    queueTimesId: null,
    queueTimesName: null,
    queueTimesSupport: "unsupported",
    providerTimezone: null,
    providerLatitude: null,
    providerLongitude: null,
    providerObservedOn: "2026-10-06",
    note: "Not a PARK on the Walt Disney World destination list or the Queue-Times Walt Disney Attractions group fetched 2026-10-06. No id was guessed.",
  },
] as const;

export const ORLANDO_HEADLINE_PARK_IDS = ORLANDO_PARK_IDENTITIES.filter(
  (park) => park.headline,
).map((park) => park.parkId);

export function orlandoIdentityByParkId(
  parkId: string,
): OrlandoParkIdentity | null {
  return ORLANDO_PARK_IDENTITIES.find((park) => park.parkId === parkId) ?? null;
}

export function orlandoExternalParkIds(providerId: string): string[] {
  const ids: string[] = [];
  for (const park of ORLANDO_PARK_IDENTITIES) {
    if (providerId === "themeparks_wiki" && park.themeParksWikiId) {
      ids.push(park.themeParksWikiId);
    }
    if (providerId === "queue_times" && park.queueTimesId) {
      ids.push(park.queueTimesId);
    }
  }
  return ids;
}
