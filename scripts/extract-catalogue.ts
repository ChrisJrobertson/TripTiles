#!/usr/bin/env tsx
/**
 * extract-catalogue.ts
 *
 * Snapshots the full TripTiles catalogue (regions, parks,
 * attractions, skip-line mappings) into CSV files under
 * catalogue/snapshots/<YYYY-MM-DD>/.
 *
 * Purpose:
 *   - Single source of truth for what's currently in the live
 *     database
 *   - Auditable inventory before any sourced-CSV import work
 *   - Re-run anytime to track parity progress
 *
 * Reads from production via the Supabase service role key.
 * Writes nothing back to the database — read-only.
 *
 * Run:
 *   npm catalogue:extract
 *
 * Required env (already in .env.local for prod):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) {
      return `"${v.join('|').replace(/"/g, '""')}"`;
    }
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async function fetchRegionsInventory() {
  const { data: regions, error: rErr } = await supabase
    .from('regions')
    .select(
      'id, name, short_name, country, country_code, continent, flag_emoji, description, is_active, is_featured, has_disney, has_universal, data_quality_tier, sort_order',
    )
    .order('sort_order');
  if (rErr || !regions) {
    throw new Error(`regions: ${rErr?.message ?? 'no data'}`);
  }

  const { data: parks, error: pErr } = await supabase
    .from('parks')
    .select('id, region_ids, hours_known, latitude, official_url')
    .neq('is_custom', true);
  if (pErr || !parks) {
    throw new Error(`parks: ${pErr?.message ?? 'no data'}`);
  }

  const { data: attractions, error: aErr } = await supabase
    .from('attractions')
    .select('park_id');
  if (aErr || !attractions) {
    throw new Error(`attractions: ${aErr?.message ?? 'no data'}`);
  }

  const { data: skipLines, error: sErr } = await supabase
    .from('region_skip_line_systems')
    .select('region_id');
  if (sErr || !skipLines) {
    throw new Error(`skip-lines: ${sErr?.message ?? 'no data'}`);
  }

  const attractionsByPark = new Map<string, number>();
  for (const a of attractions) {
    attractionsByPark.set(
      a.park_id,
      (attractionsByPark.get(a.park_id) ?? 0) + 1,
    );
  }

  const skipLineByRegion = new Map<string, number>();
  for (const s of skipLines) {
    skipLineByRegion.set(
      s.region_id,
      (skipLineByRegion.get(s.region_id) ?? 0) + 1,
    );
  }

  return regions.map((r) => {
    const regionParks = parks.filter((p) =>
      (p.region_ids ?? []).includes(r.id),
    );
    return {
      id: r.id,
      name: r.name,
      short_name: r.short_name,
      country: r.country,
      country_code: r.country_code,
      continent: r.continent,
      flag_emoji: r.flag_emoji,
      is_active: r.is_active,
      is_featured: r.is_featured,
      has_disney: r.has_disney,
      has_universal: r.has_universal,
      data_quality_tier: r.data_quality_tier,
      sort_order: r.sort_order,
      description_chars: (r.description ?? '').length,
      parks_count: regionParks.length,
      parks_with_hours: regionParks.filter((p) => p.hours_known).length,
      parks_with_coords: regionParks.filter(
        (p) => p.latitude !== null,
      ).length,
      parks_with_url: regionParks.filter((p) => !!p.official_url)
        .length,
      attractions_count: regionParks.reduce(
        (sum, p) => sum + (attractionsByPark.get(p.id) ?? 0),
        0,
      ),
      skip_line_systems: skipLineByRegion.get(r.id) ?? 0,
    };
  });
}

async function fetchParksInventory() {
  const { data, error } = await supabase
    .from('parks')
    .select(
      'id, name, icon, park_group, region_ids, country, latitude, longitude, official_url, opens_at, closes_at, hours_known, affiliate_hotel_query, affiliate_ticket_url, sort_order',
    )
    .neq('is_custom', true)
    .order('sort_order');
  if (error || !data) {
    throw new Error(`parks: ${error?.message ?? 'no data'}`);
  }

  const { data: attractions } = await supabase
    .from('attractions')
    .select('park_id');
  const attractionsByPark = new Map<string, number>();
  for (const a of attractions ?? []) {
    attractionsByPark.set(
      a.park_id,
      (attractionsByPark.get(a.park_id) ?? 0) + 1,
    );
  }

  return data.map((p) => ({
    ...p,
    region_ids: (p.region_ids ?? []).join('|'),
    attractions_count: attractionsByPark.get(p.id) ?? 0,
  }));
}

async function fetchAttractionsInventory() {
  const { data, error } = await supabase
    .from('attractions')
    .select(
      'id, park_id, name, category, thrill_level, is_indoor, duration_minutes, height_requirement_cm, skip_line_system, skip_line_tier, avg_wait_peak_minutes, avg_wait_offpeak_minutes, is_seasonal, is_temporarily_closed, tags, official_url, sort_order',
    )
    .order('park_id');
  if (error || !data) {
    throw new Error(`attractions: ${error?.message ?? 'no data'}`);
  }
  return data.map((a) => ({
    ...a,
    tags: (a.tags ?? []).join('|'),
  }));
}

async function fetchSkipLineMappings() {
  const { data, error } = await supabase
    .from('region_skip_line_systems')
    .select('region_id, skip_line_system_id')
    .order('region_id');
  if (error || !data) {
    throw new Error(`skip-line mappings: ${error?.message ?? 'no data'}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = join(
    process.cwd(),
    'catalogue',
    'snapshots',
    stamp,
  );
  mkdirSync(outDir, { recursive: true });

  console.log(`Writing snapshot to ${outDir}\n`);

  console.log('  • regions...');
  const regions = await fetchRegionsInventory();
  writeFileSync(join(outDir, 'regions.csv'), toCsv(regions));
  console.log(`    ${regions.length} rows`);

  console.log('  • parks...');
  const parks = await fetchParksInventory();
  writeFileSync(join(outDir, 'parks.csv'), toCsv(parks));
  console.log(`    ${parks.length} rows`);

  console.log('  • attractions...');
  const attractions = await fetchAttractionsInventory();
  writeFileSync(
    join(outDir, 'attractions.csv'),
    toCsv(attractions),
  );
  console.log(`    ${attractions.length} rows`);

  console.log('  • skip-line mappings...');
  const skipLines = await fetchSkipLineMappings();
  writeFileSync(
    join(outDir, 'skip-line-mappings.csv'),
    toCsv(skipLines),
  );
  console.log(`    ${skipLines.length} rows`);

  const tierCounts: Record<string, number> = {};
  for (const r of regions) {
    const k = String(r.data_quality_tier);
    tierCounts[k] = (tierCounts[k] ?? 0) + 1;
  }

  const summary = [
    `# TripTiles catalogue snapshot — ${stamp}`,
    '',
    `- Regions: ${regions.length} (active: ${regions.filter((r) => r.is_active).length}, featured: ${regions.filter((r) => r.is_featured).length})`,
    `- Parks: ${parks.length} (catalogue, custom user tiles excluded)`,
    `- Attractions: ${attractions.length}`,
    `- Skip-line mappings: ${skipLines.length}`,
    '',
    '## Regions by data-quality tier',
    ...Object.entries(tierCounts)
      .sort()
      .map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Park-level data completeness (catalogue parks)',
    `- with opens_at/closes_at populated: ${parks.filter((p) => p.hours_known).length} / ${parks.length}`,
    `- with latitude/longitude: ${parks.filter((p) => p.latitude !== null).length} / ${parks.length}`,
    `- with official_url: ${parks.filter((p) => p.official_url).length} / ${parks.length}`,
    `- with affiliate_ticket_url: ${parks.filter((p) => p.affiliate_ticket_url).length} / ${parks.length}`,
    '',
  ].join('\n');

  writeFileSync(join(outDir, 'README.md'), summary);
  console.log('\n' + summary);
  console.log(`Done. Snapshot written to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
