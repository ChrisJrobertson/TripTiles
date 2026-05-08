# CSV alignment templates

These CSVs feed `scripts/import/alignment-import.ts`. **Remove or replace every `EXAMPLE_DELETE_BEFORE_IMPORT_*` row** before real imports.

## Rules (all importers)

- **`source_url`**: `http` or `https` only; must be the page you used for the row.
- **`source_date`**: `YYYY-MM-DD` (UTC calendar date you captured the data).
- **No placeholders** in text fields: `TODO`, `TBC`, `{{`, `${`, `Lorem ipsum`, etc.
- **Dry-run default**: run without `--apply`; fix `import-errors-*.csv` next to your CSV if the script exits non-zero.
- **Apply**: requires `SUPABASE_SERVICE_ROLE_KEY` plus `NEXT_PUBLIC_SUPABASE_URL`.
- **Protected regions / parks**: rows touching `ALIGNMENT_PROTECT_REGION_IDS` (default `orlando,cali`) are **rejected** unless you pass `--allow-protected` intentionally.

## Commands

```bash
# Dry-run (writes import-summary-*.json and import-errors-*.csv beside your CSV on failure)
node --env-file=.env.local --import tsx scripts/import/alignment-import.ts park-metadata --file path/to/data.csv

# Apply
node --env-file=.env.local --import tsx scripts/import/alignment-import.ts park-metadata --file path/to/data.csv --apply
```

## Template columns

### `park-metadata-template.csv`

| Column | Required | Notes |
|--------|----------|--------|
| park_id | yes | Built-in `parks.id` |
| country | no | |
| latitude, longitude | optional pair | Both required if either set |
| official_url | no | |
| icon | no | |
| source_url, source_date | yes | |

### `park-hours-template.csv`

| Column | Required | Notes |
|--------|----------|--------|
| park_id | yes | |
| opens_at, closes_at | yes | `HH:MM` (24h) |
| hours_known | yes | `true` / `false` |
| source_url, source_date | yes | |

### `park-areas-template.csv`

| park_id | name | sort_order | source_url | source_date |

### `attractions-template.csv`

| id | park_id | name | category | thrill_level | skip_line_system | height_requirement_cm | sort_order | source_url | source_date |

- **category**: `ride` | `show` | `character_meet` | `experience`
- **thrill_level**: `gentle` | `moderate` | `thrilling` | `intense`
- **skip_line_system**: must be a known id (see `skip_line_systems` table), e.g. `none`, `lightning_lane`, `universal_express`, …

### `skip-line-mapping-template.csv`

| attraction_id | skip_line_system | source_url | source_date |

### `region-briefings-template.csv` / `park-briefings-template.csv`

| region_id or park_id | locale | body | source_url | source_date |

## Reports

After applying migration `20260509120000_park_alignment_infrastructure.sql` to Supabase:

```bash
node --env-file=.env.local --import tsx scripts/report-park-alignment.ts
node --env-file=.env.local --import tsx scripts/report-park-alignment.ts --region-id paris
```

## Safe backfill (allowlisted)

```bash
node --env-file=.env.local --import tsx scripts/safe-backfill-park-alignment.ts
node --env-file=.env.local --import tsx scripts/safe-backfill-park-alignment.ts --apply
```

Only: (1) copy `regions.country` into empty `parks.country` when the park has exactly one `region_id`, excluding protected regions; (2) insert `region_skip_line_systems` = `none` for regions with no Disney/Universal flags and no existing mapping rows; (3) set `parks.icon` to the default 🎢 when null or blank (all built-in parks).

## Florida catalogue checksum (recommended)

Per-region counts + SHA-256 over canonical rows for `orlando`, `florida_combo`, and `miami` across `parks`, `attractions`, `park_areas`, `region_briefings`, and `park_briefings`:

```bash
npm run verify:florida-baseline
```

Save the JSON before bulk imports; re-run after — identical DB state yields identical hashes.

## Orlando baseline (legacy counts only)

```bash
npm run verify:orlando-baseline
```

Same as before: built-in parks containing `orlando` plus attraction count.
