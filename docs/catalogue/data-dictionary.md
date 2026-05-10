# TripTiles catalogue data dictionary

The data we maintain to keep the planner working across all 43 regions. This is what every region needs filled in to reach Orlando-model parity.

Source of truth: live Supabase schema (project `hjbbojypllltfjfuojzn`). Fields below are listed in the order they currently exist in the database.

---

## Table: `regions` (43 rows)

One row per supported destination. Identity, capability flags, and the data-quality tier that drives Orlando-model parity tracking.

| Field | Type | Required | Purpose | Source |
|---|---|---|---|---|
| `id` | text | yes | Stable slug used in URLs and `parks.region_ids` | Manual, never change after launch |
| `name` | text | yes | Display name shown in pickers ("Orlando, Florida") | Editorial |
| `short_name` | text | yes | Compact label for chips and badges ("Orlando") | Editorial |
| `country` | text | yes | Country name for grouping ("United States") | Reference |
| `country_code` | text | yes | ISO 3166-1 alpha-2 ("US"), `XX` for at-sea/global | Reference |
| `continent` | text | yes | Continent grouping for region picker | Reference |
| `flag_emoji` | text | optional | Unicode flag for visual hint | Reference |
| `description` | text | optional | One-line region tagline shown on landing/picker | Editorial, ≤80 chars works well |
| `is_active` | bool | yes | If false, hidden from new trips | Operational |
| `is_featured` | bool | yes | Whether region appears on landing-page grid | Editorial |
| `sort_order` | int | yes | Display order across pickers | Editorial |
| `has_disney` | bool | yes | Whether region contains Disney parks (drives AI prompt branches) | Derived from parks |
| `has_universal` | bool | yes | Whether region contains Universal parks | Derived from parks |
| `data_quality_tier` | text | yes | `light` / `standard` / `deep` — Orlando-model parity status | Manual gate |

### What `data_quality_tier` means

| Tier | Definition | Current count |
|---|---|---|
| `deep` | Full Orlando-model parity: park-level metadata, attraction list with skip-line tiers, peak/off-peak waits, region narrative | 2 (orlando, florida_combo) |
| `standard` | Parks present, some attractions, partial skip-line metadata, basic narrative | 7 (cali, paris, tokyo, osaka, shanghai, hongkong, singapore) |
| `light` | Parks listed, no attraction-level data, generic fallbacks in AI output | 34 (everything else) |

Only `deep` regions can use the full ride-level planning UI (Lightning Lane / Express Pass tier strategy). `standard` regions show simplified planning. `light` regions degrade gracefully to date-and-park-only planning with honest "data coming soon" affordances.

---

## Table: `parks` (351 catalogue rows + user custom tiles)

One row per park, attraction, dining, transit, or activity tile that can be dropped into a planner slot. Despite the name, "park" is broader than theme park — it includes anything a user can schedule into a half-day slot.

| Field | Type | Required | Purpose | Source |
|---|---|---|---|---|
| `id` | text | yes | Stable slug used in trip assignments | Manual, never change after launch |
| `name` | text | yes | Display name | Editorial |
| `icon` | text | optional | Single emoji or short string shown on calendar tile | Reference (default 🎢) |
| `bg_colour` | text | yes | Hex colour for tile background | Editorial |
| `fg_colour` | text | yes | Hex colour for tile foreground | Editorial |
| `park_group` | text | yes | Bucket for filter UI (`disney`, `universal`, `seaworld`, `attractions`, `sights`, `dining`, `activities`, `excursions`, `disneyextra`, `travel`) | Reference |
| `region_ids` | text[] | yes | Which regions this park appears in (a park can belong to many regions, e.g. Magic Kingdom in `orlando` AND `florida_combo`) | Manual |
| `destinations` | text[] | yes | Legacy field, retained for backwards compatibility | Migration-only |
| `country` | text | optional | ISO country name | Backfilled from single-region parks |
| `latitude` | numeric | **gap** | For map view + travel-time calcs | **Sourced CSV — not yet populated for any park** |
| `longitude` | numeric | **gap** | Same | **Sourced CSV — not yet populated for any park** |
| `official_url` | text | **gap** | Link to operator's site | **Sourced CSV — not yet populated for any park** |
| `affiliate_hotel_query` | text | optional | Booking.com search query for nearby hotels | Editorial |
| `affiliate_ticket_url` | text | optional | Direct affiliate ticket link | Editorial |
| `is_custom` | bool | yes | True for user-created tiles, false for catalogue | Operational |
| `created_by` | uuid | optional | User who created (custom tiles only) | Operational |
| `agency_id` | uuid | optional | Agency owner (B2B, currently unused) | Operational |
| `sort_order` | int | optional | Display order within a region | Editorial |
| `opens_at` | text | **gap** | Park opening time, format `HH:MM` | **Sourced CSV — not yet populated for any park** |
| `closes_at` | text | **gap** | Park closing time, format `HH:MM` | **Sourced CSV — not yet populated for any park** |
| `hours_known` | bool | yes | Whether `opens_at` / `closes_at` are reliable | Defaults false; flips true when sourced |

### What's missing across all 351 catalogue parks

- `latitude` / `longitude` — 0 / 351 populated
- `official_url` — 0 / 351 populated
- `opens_at` / `closes_at` (when `hours_known = true`) — 0 / 351 populated

---

## Table: `attractions` (100 rows)

Ride / show / experience-level metadata, currently only populated for a subset of theme park parks (mostly Orlando from Session 12A's seed, plus Anaheim, Hong Kong, and Paris partial).

| Field | Type | Required | Purpose | Source |
|---|---|---|---|---|
| `id` | text | yes | Stable slug | Manual |
| `park_id` | text | yes | FK → `parks.id` | Manual |
| `name` | text | yes | Ride/experience display name | Editorial |
| `category` | text | yes | `ride`, `show`, `meet_greet`, `dining`, `experience` | Reference |
| `height_requirement_cm` | int | optional | Minimum rider height in cm | Sourced |
| `thrill_level` | text | yes | `gentle`, `moderate`, `thrilling`, `intense` | Sourced |
| `is_indoor` | bool | yes | Indoor flag (drives wet-weather fallbacks) | Sourced |
| `duration_minutes` | int | optional | Ride time in minutes | Sourced |
| `skip_line_system` | text | optional | Operator's system: `disney_lightning_lane`, `universal_express`, `premier_access`, `lightning_lane` (legacy), `none` | Reference |
| `skip_line_tier` | text | optional | Within that system: `single_pass`, `multi_pass`, `multi_pass_tier1`, `multi_pass_tier2`, `express`, `premier_access` | Reference |
| `skip_line_notes` | text | optional | Free text about LL/Express specifics | Editorial |
| `avg_wait_peak_minutes` | int | optional | Typical peak-season wait in minutes | Sourced |
| `avg_wait_offpeak_minutes` | int | optional | Typical off-peak wait in minutes | Sourced |
| `best_time_to_ride` | text | optional | Strategic guidance: "early morning", "during fireworks", etc. | Editorial |
| `sort_order` | int | yes | Display order within park | Editorial |
| `is_seasonal` | bool | yes | True if only operates seasonally | Operational |
| `is_temporarily_closed` | bool | yes | True if currently down for refurb (e.g. DINOSAUR) | Operational |
| `closure_note` | text | optional | "Reopens Q2 2026" if known | Editorial |
| `tags` | text[] | yes | Free-form tags: `roller_coaster`, `dark_ride`, `family`, `thrilling`, `simulator`, `boat_ride` etc. | Editorial |
| `official_url` | text | optional | Operator's page for the ride | Reference |

### Coverage of attractions across parks

Of the 351 catalogue parks, only the following currently have attractions seeded:

| Park | Region | Attractions |
|---|---|---|
| Magic Kingdom | orlando | 13 |
| EPCOT | orlando | 10 |
| Disneyland Park | cali | 10 |
| Hollywood Studios | orlando | 8 |
| California Adventure | cali | 8 |
| Universal Studios (Orlando) | orlando | 8 |
| Epic Universe | orlando | 8 |
| Disneyland Paris | paris | 8 |
| Walt Disney Studios | paris | 7 |
| Islands of Adventure | orlando | 7 |
| Hong Kong Disneyland | hongkong | 7 |
| Animal Kingdom | orlando | 6 |

Everything else is empty: 339 catalogue parks have zero attraction-level data.

---

## Table: `region_skip_line_systems` (46 rows)

Many-to-many mapping of which queue-skip systems are available in each region. Drives which "system" options the user sees in the booking-anchor UI.

| Field | Type | Purpose |
|---|---|---|
| `region_id` | text | FK → `regions.id` |
| `skip_line_system_id` | text | One of `disney_lightning_lane`, `universal_express`, `premier_access`, `lightning_lane`, `none` |

Composite PK on `(region_id, skip_line_system_id)`.

---

## What "Orlando-model parity" requires per region

For a region to graduate from `light` → `standard` → `deep`:

### `standard` tier (currently 7 regions)
- Region has `description` populated (≤80 chars)
- Region has at least one entry in `region_skip_line_systems` (or explicit `none`)
- All headline parks have `country` populated
- All headline parks have `icon` set (default 🎢 acceptable)

### `deep` tier (currently 2 regions: orlando, florida_combo)
Everything from `standard`, plus:
- All headline parks have `latitude` / `longitude` populated
- All headline parks have `official_url` populated
- All headline parks have `opens_at` / `closes_at` populated and `hours_known = true`
- Each headline theme-park park has at least 6 attractions seeded with thrill, height, skip-line tier, and peak/off-peak wait times
- Region has a 200-400 word narrative briefing for the AI Smart Plan prompt (not yet shipped — `regions.briefing_text` column doesn't exist in production)
- Each headline park has a 100-200 word park briefing (same — `parks.briefing_text` not shipped)

### What's still missing from the schema for full Orlando-model parity
- `regions.briefing_text` (P6 from the parity infrastructure plan)
- `parks.briefing_text` (P6)
- `parks.areas` / a `park_areas` table (P4) — for Fantasyland / Tomorrowland-style sub-areas
- A `park_must_dos` field or table — for "if you do nothing else, ride X" surfacing in PDFs

Until those ship, even fully-sourced region/park data can only hit the `standard` ceiling.
