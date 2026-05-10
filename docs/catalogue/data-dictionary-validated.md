# Validated catalogue data dictionary (parks, rides, hours, skip lines)

This document is the **validation target** for TripTiles catalogue data: what must be true for planner copy, AI guardrails, and skip-line logic to stay **operator-accurate**. It extends [`data-dictionary.md`](data-dictionary.md) with **rules**, **enums**, and **known gaps** between the live schema and what you described (hours everywhere, premium passes, Lightning Lane vs Premier Access, single rider, “which line” correctness).

Source of truth for column names: Supabase `public` tables (`parks`, `attractions`, `regions`, `skip_line_systems`, `region_skip_line_systems`).

---

## 1. Scope: three levels

| Level | Table(s) | What “validated” means here |
|--------|-----------|-------------------------------|
| **Region** | `regions`, `region_skip_line_systems`, `skip_line_systems` | Which **paid skip products** exist for that destination (for wizard + copy). |
| **Park** | `parks` | Default **opening/closing** for a typical day, plus whether those values are **trusted**. |
| **Ride** | `attractions` | Per-attraction **skip product** (tier), **single-rider queue** fact, **virtual queue** if any — not buried only in prose. |

Trip-level preferences (e.g. Universal “single rider OK?”) live in trip JSON / wizard state, **not** in the catalogue; the catalogue must still say **whether the ride actually offers** a single-rider line.

---

## 2. Region: premium passes and systems (`skip_line_systems` + `region_skip_line_systems`)

### 2.1 Canonical IDs in `skip_line_systems`

These are the **database** IDs (from `20260508144000_skip_line_systems_and_region_mapping.sql`):

- `lightning_lane` — Disney Lightning Lane / Genie+ family (US wording in seed description)
- `universal_express` — Universal Express Pass
- `disneyland_paris_premier_access`
- `tokyo_disney_premier`
- `shanghai_disney_premier`
- `hongkong_disney_premier`
- `universal_japan_express`
- `universal_singapore_express`
- `none`

Every region should have **at least one** row in `region_skip_line_systems` (backfill uses `none` where no paid system is tracked).

### 2.2 Validation rules (region)

- **R1** — For each `regions.id`, there exists ≥1 row in `region_skip_line_systems`.
- **R2** — If `regions.has_disney = true`, the mapped systems should include the correct **Disney** product for that market (US: `lightning_lane`; Paris/Tokyo/Shanghai/HK: premier rows above — not the US name).
- **R3** — If `regions.has_universal = true`, mapped systems should include the correct **Universal** express id for that market (`universal_express` vs `universal_japan_express` vs `universal_singapore_express`).
- **R4** — `has_disney` / `has_universal` must stay consistent with **catalogue parks** in that region (`park_group` / operator), or the UI will warn in dev (`region-skip-line-ui.ts`).

### 2.3 Known drift: region IDs vs `attractions.skip_line_system`

Attraction seeds (e.g. Orlando) use values such as **`disney_lightning_lane`** and **`universal_express`**, while `region_skip_line_systems` references **`lightning_lane`** (not `disney_lightning_lane`). That is **not** the same string.

**Validation implication:** you cannot join region systems to attractions on raw string equality today. For a validated pipeline you should either:

- **Normalize** attraction `skip_line_system` to the same vocabulary as `skip_line_systems.id`, or  
- Maintain an explicit **mapping table** (e.g. `attraction_skip_line_system` → `skip_line_systems.id`).

Until then, treat `attractions.skip_line_system` as **legacy / app-facing** and `skip_line_systems.id` as **region / reference**.

---

## 3. Park: opening hours (`parks`)

| Column | Format | Validation |
|--------|--------|------------|
| `opens_at` | `HH:MM` (24h) | DB check constraint in migration |
| `closes_at` | `HH:MM` (24h) | Same |
| `hours_known` | boolean | **Must be `true` only** when `opens_at` / `closes_at` are sourced for that row’s meaning (typical baseline day, not a one-off event) |

### 3.1 Validation rules (park)

- **P1** — If `hours_known = true`, then `opens_at` and `closes_at` are **NOT NULL** and match `^\d{2}:\d{2}$`.
- **P2** — For **launch / “deep” honesty**, every **headline theme-park** catalogue row in a `deep` region should eventually satisfy P1 (today: universal gap — see [`gap-analysis.md`](gap-analysis.md)).
- **P3** — Seasonal parks: either keep `hours_known = false` until you have a **seasonal model**, or add a future **`park_hours_exceptions`** artefact (not shipped); do not imply one static pair is year-round without saying so.

---

## 4. Ride: skip lines, single rider, “which line” (`attractions`)

### 4.1 Shipped columns (today)

| Column | Use |
|--------|-----|
| `skip_line_system` | Which **operator product** applies (app/seed vocabulary; see drift above). |
| `skip_line_tier` | Role in that product, e.g. `single_pass` (often ILL), `multi_pass_tier1`, `multi_pass_tier2`, `express`. |
| `skip_line_notes` | Free text; **not sufficient alone** for machine validation. |
| `best_time_to_ride` | Strategy prose; **must not** be the only place that states single-rider or VQ facts. |

### 4.2 Validation rules (ride) — **target state**

These are the rules you want enforced once data exists:

- **A1 (operator match)** — For a ride in a **Disney** park (`park_group` / operator rules), `skip_line_system` must not be `universal_express` (and vice versa for Universal parks).
- **A2 (tier vs product)** — If tier is `single_pass`, copy and tools should treat as **individual / paid one-shot** style (name varies by resort). If `multi_pass_tier1` / `multi_pass_tier2`, treat as **bundle / multi-select** style.
- **A3 (single rider)** — For **thrill rides**, `single_rider_line` must be one of `yes | no | unknown` (see §4.3). **Forbidden:** implying single rider in `best_time_to_ride` when `single_rider_line = no`.
- **A4 (virtual queue)** — If the ride uses a **virtual queue** (boarding group, etc.), `virtual_queue_mode` must not be `none` (see §4.3). VQ must not only appear in prose.
- **A5 (shows / meets)** — For `category` in (`show`, `character_meet`), skip-line columns may be null; do not apply coaster-style LL rules.

### 4.3 Recommended schema additions (not in production yet)

To make **A3–A4** auditable in CSV/SQL checks, add:

| Proposed column | Type | Allowed values | Purpose |
|-----------------|------|----------------|---------|
| `single_rider_line` | text + check | `yes`, `no`, `unknown` | Factual: does this attraction operate a **single-rider queue**? |
| `virtual_queue_mode` | text + check | `none`, `boarding_group`, `paid_return`, `unknown` | Structured VQ / return-time pattern (refine enum when you model each operator). |

Until these ship, mark single-rider and VQ as **NOT VALIDATED** in automation: they can only be inferred from `best_time_to_ride` / `skip_line_notes`, which is error-prone.

### 4.4 `skip_line_tier` vocabulary (attraction seeds)

Orlando-style seeds use at least: `single_pass`, `multi_pass_tier1`, `multi_pass_tier2`, `express`.  
**Validation:** document allowed tiers **per `skip_line_system` family** in import scripts; reject unknown tiers in CI when importing CSV.

---

## 5. Coverage reality check (why validation cannot pass globally yet)

From [`gap-analysis.md`](gap-analysis.md) (May 2026 snapshot):

- **Park hours:** `latitude` / `longitude` / `official_url` / trusted hours — **not** populated catalogue-wide for all parks.
- **Rides:** only **12** catalogue parks have any `attractions` rows; **339** have **zero** rides.
- **Deep tier:** still **weak on park-level** metadata; “deep” is driven largely by **attraction depth** in Orlando/Florida, not full park hours.

So: the **dictionary and rules** here are valid as a **spec**; **data** cannot satisfy them everywhere until imports and schema additions are done.

---

## 6. Suggested validation workflow (operational)

1. **CSV import** (sourced only): parks (hours + coords + URL), then attractions (skip + proposed `single_rider_line` / `virtual_queue_mode` when columns exist).  
2. **CI or SQL checks:** R1–R4, P1, A1–A5 on seeded subset (e.g. Orlando first).  
3. **Align identifiers:** fix `disney_lightning_lane` vs `lightning_lane` as part of import or mapping layer.  
4. **Human spot-check:** premium product **names** in guest-facing copy must match **that resort** (Premier Access vs Lightning Lane vs Express).

---

## 7. Related code (for implementers)

- Region vs catalogue flags: [`src/lib/region-skip-line-ui.ts`](../../src/lib/region-skip-line-ui.ts)  
- Attraction TypeScript types (narrower than DB): [`src/types/attractions.ts`](../../src/types/attractions.ts)  
- AI guardrails on single rider / pass names: [`src/actions/ai.ts`](../../src/actions/ai.ts)  
- Extract snapshot for counts: `pnpm tsx scripts/extract-catalogue.ts`

---

## 8. Changelog

- **2026-05-10** — Initial validated dictionary: region systems, park hours rules, ride skip/single-rider/VQ target schema, identifier drift called out.
