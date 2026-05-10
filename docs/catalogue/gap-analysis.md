# TripTiles catalogue gap analysis

Snapshot taken from live Supabase (project `hjbbojypllltfjfuojzn`) on 10 May 2026.

This is the honest answer to "are all the regions correct" — measured against the Orlando-model parity definition agreed in the 8 May session.

---

## Headline numbers

- **43 regions**, all active, 18 featured
- **351 catalogue parks** (custom user tiles excluded)
- **100 attractions** populated, across 12 parks (339 parks have zero attraction data)
- **46 skip-line system mappings** across regions

### Regions by data-quality tier

| Tier | Count | What it means |
|---|---|---|
| `deep` | 2 | Full Orlando-model parity (orlando, florida_combo) |
| `standard` | 7 | Parks present + some attractions + basic narrative |
| `light` | 34 | Park names only, no attraction-level data |

### Park-level data — universal gaps

| Field | Populated | Out of |
|---|---|---|
| `latitude` / `longitude` | 0 | 351 |
| `official_url` | 0 | 351 |
| `opens_at` / `closes_at` (`hours_known = true`) | 0 | 351 |

**Even Orlando's "deep" tier ranking is misleading at park level** — its depth comes entirely from the 60 attractions seeded by Session 12A. The parks themselves still lack coordinates, hours, and official URLs.

---

## Per-region inventory (sorted by sort_order)

| Region | Tier | Featured | Disney | Universal | Parks | Attractions | Description |
|---|---|---|---|---|---|---|---|
| orlando — Orlando, Florida | `deep` | ✅ | ✅ | ✅ | 44 | 60 | 55 chars |
| cali — Anaheim & California | `standard` | ✅ | ✅ | ✅ | 35 | 18 | 58 chars |
| lasvegas — Las Vegas | `light` | — | — | — | 25 | 0 | 35 chars |
| toronto — Toronto | `light` | — | — | — | 26 | 0 | 43 chars |
| mexico — Mexico | `light` | — | — | — | 28 | 0 | 41 chars |
| miami — Miami & South Florida | `light` | ✅ | — | — | 63 | 0 | 60 chars |
| florida_combo — Florida Combo (Orlando + Miami) | `deep` | ✅ | ✅ | ✅ | 85 | 60 | 61 chars |
| paris — Paris | `standard` | ✅ | ✅ | — | 35 | 15 | 53 chars |
| uk — United Kingdom | `light` | ✅ | — | — | 33 | 0 | 53 chars |
| germany — Germany | `light` | ✅ | — | — | 30 | 0 | 48 chars |
| spain — Costa Daurada, Spain | `light` | ✅ | — | — | 30 | 0 | 47 chars |
| netherlands — Netherlands | `light` | — | — | — | 26 | 0 | 38 chars |
| denmark — Denmark | `light` | — | — | — | 26 | 0 | 47 chars |
| italy — Italy | `light` | — | — | — | 28 | 0 | 44 chars |
| belgium — Belgium | `light` | — | — | — | 26 | 0 | 29 chars |
| sweden — Sweden | `light` | — | — | — | 25 | 0 | 23 chars |
| finland — Finland | `light` | — | — | — | 25 | 0 | 23 chars |
| tokyo — Tokyo | `standard` | ✅ | ✅ | — | 40 | 0 | 46 chars |
| osaka — Osaka & Kansai | `standard` | — | — | ✅ | 26 | 0 | 45 chars |
| shanghai — Shanghai | `standard` | ✅ | ✅ | — | 30 | 0 | 34 chars |
| hongkong — Hong Kong | `standard` | ✅ | ✅ | — | 27 | 7 | 35 chars |
| singapore — Singapore | `standard` | ✅ | — | ✅ | 29 | 0 | 39 chars |
| seoul — Seoul | `light` | — | — | — | 26 | 0 | 24 chars |
| uae — Dubai & Abu Dhabi | `light` | ✅ | — | — | 36 | 0 | 66 chars |
| goldcoast — Gold Coast, Australia | `light` | ✅ | — | — | 29 | 0 | 46 chars |
| sydney — Sydney | `light` | — | — | — | 26 | 0 | 32 chars |
| cruise — Cruise Holiday | `light` | ✅ | — | — | 24 | 0 | 54 chars |
| london — London | `light` | ✅ | — | — | 50 | 0 | 73 chars |
| edinburgh — Edinburgh & Scotland | `light` | ✅ | — | — | 31 | 0 | 71 chars |
| bath — Bath & the Cotswolds | `light` | — | — | — | 30 | 0 | 73 chars |
| liverpool — Liverpool | `light` | — | — | — | 28 | 0 | 49 chars |
| york — York | `light` | — | — | — | 28 | 0 | 64 chars |
| manchester — Manchester | `light` | — | — | — | 27 | 0 | 56 chars |
| cambridge — Cambridge & Oxford | `light` | — | — | — | 29 | 0 | 60 chars |
| lakedist — Lake District | `light` | — | — | — | 27 | 0 | 62 chars |
| cornwall — Cornwall | `light` | — | — | — | 28 | 0 | 49 chars |
| highlands — Scottish Highlands | `light` | — | — | — | 27 | 0 | 52 chars |
| cardiff — Cardiff & Wales | `light` | — | — | — | 27 | 0 | 53 chars |
| belfast — Belfast & Northern Ireland | `light` | — | — | — | 27 | 0 | 56 chars |
| brighton — Brighton | `light` | — | — | — | 27 | 0 | 65 chars |
| stratfm — Stratford & Warwick | `light` | — | — | — | 27 | 0 | 59 chars |
| uk_combo — UK Multi-City Tour | `light` | ✅ | — | — | 138 | 0 | 61 chars |
| custom — Other / Multi-Region | `light` | — | — | — | 22 | 0 | 50 chars |

> "Parks" inflated for combo regions (`uk_combo` = 138 because every UK city park is listed under it; `florida_combo` = 85 because both Orlando and Miami parks appear there).

---

## What this means for launch

The decision on 8 May was: TripTiles will not launch unless every region is aligned to the Orlando model. If that's still the rule, the gap between today and launch-ready is:

### What's there
- Every region has a name, country, sort order, tier flag, capability flags, and a short description.
- Every region has at least one skip-line system mapped (mostly `none`).
- 351 parks are catalogued with names, icons (some), colours, region linkage, and group classification.
- 12 theme parks across orlando / cali / paris / hongkong have rich attraction data.

### What's missing
- **At park level (universal gap):** coordinates, hours, official URLs across all 351 parks. Even Orlando lacks these.
- **At attraction level:** 339 parks have zero attractions seeded. The 11 international parks scoped in the parity plan haven't been touched.
- **At narrative level:** no `briefing_text` column exists in production. P6 from the parity infrastructure plan was scoped but not shipped.
- **At sub-area level:** no `park_areas` table or `parks.areas` jsonb. P4's optional area work was scoped but not shipped.

### What honestly fillable means
The infrastructure built on `feat/parity-data-infrastructure` (importers, completeness views, validation rules forbidding placeholder text and AI-generated content) is the safe path. To actually fill it, in priority order:

| Priority | Region | Why | Effort |
|---|---|---|---|
| 1 | orlando + florida_combo | Already demos as `deep`. Top up with park hours, coords, URLs to make the tier honest. | ~2 hours sourced data entry per park × 7 parks = ~half a day |
| 2 | cali, paris, hongkong | Already `standard`, partial attraction data. Finish to `deep`. | ~2 days each |
| 3 | tokyo, shanghai, osaka, singapore | `standard`-tagged but zero attractions. Either fill or downgrade tag to `light`. | ~3 days each, OR 1 minute to retag |
| 4 | uk featured family parks (alton, thorpe, paultons, legoukw) | UK is the second-largest user base. | ~1 day total for the 4 parks |
| 5 | Everything else | Long tail. Honest "data coming soon" fallback is acceptable until traffic warrants the work. | Defer indefinitely |

### Two decisions worth making before any data work

1. **Drop or relabel?** The 5 regions tagged `standard` with zero attractions (tokyo, shanghai, osaka, singapore, plus seoul which is `light`) are pretending to be richer than they are. Either fill them or retag them to `light` so the AI prompt branches honestly.

2. **Ship P6 or skip it?** Without `briefing_text` columns, no region can graduate to true `deep` tier. If the launch is happening this month, accept that `deep` means "what Orlando has now" and move on; ship P6 post-launch when there's traffic to justify the work.

---

## Re-running this analysis

```bash
# Option A: TypeScript script (writes CSVs to catalogue/snapshots/<date>/)
pnpm tsx scripts/extract-catalogue.ts

# Option B: SQL queries (paste into Supabase SQL editor or run via MCP)
cat scripts/extract-catalogue.sql
```

Both produce the same data. The script writes timestamped snapshots so you can diff parity progress over time.
