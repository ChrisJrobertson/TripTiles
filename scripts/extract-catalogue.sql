-- ============================================================
-- extract-catalogue.sql
--
-- Read-only inventory of the TripTiles catalogue: regions,
-- parks, attractions, and skip-line mappings, with computed
-- completeness metrics per region.
--
-- Run any block individually in the Supabase SQL editor, via
-- MCP, or via psql. Export each result as CSV from the editor.
--
-- This is the SQL equivalent of scripts/extract-catalogue.ts
-- ============================================================

-- ------------------------------------------------------------
-- 1. Regions inventory + completeness
-- ------------------------------------------------------------
SELECT
  r.id,
  r.name,
  r.short_name,
  r.country,
  r.country_code,
  r.continent,
  r.flag_emoji,
  r.is_active,
  r.is_featured,
  r.has_disney,
  r.has_universal,
  r.data_quality_tier,
  r.sort_order,
  COALESCE(LENGTH(r.description), 0) AS description_chars,
  (SELECT COUNT(*) FROM parks p
    WHERE r.id = ANY(p.region_ids) AND p.is_custom IS NOT TRUE) AS parks_count,
  (SELECT COUNT(*) FROM parks p
    WHERE r.id = ANY(p.region_ids) AND p.is_custom IS NOT TRUE
      AND p.hours_known = true) AS parks_with_hours,
  (SELECT COUNT(*) FROM parks p
    WHERE r.id = ANY(p.region_ids) AND p.is_custom IS NOT TRUE
      AND p.latitude IS NOT NULL) AS parks_with_coords,
  (SELECT COUNT(*) FROM parks p
    WHERE r.id = ANY(p.region_ids) AND p.is_custom IS NOT TRUE
      AND p.official_url IS NOT NULL AND p.official_url <> '') AS parks_with_url,
  (SELECT COUNT(*) FROM attractions a
    JOIN parks p ON a.park_id = p.id
    WHERE r.id = ANY(p.region_ids)) AS attractions_count,
  (SELECT COUNT(*) FROM region_skip_line_systems rs
    WHERE rs.region_id = r.id) AS skip_line_systems
FROM regions r
ORDER BY r.sort_order, r.id;

-- ------------------------------------------------------------
-- 2. Parks inventory (catalogue parks only)
-- ------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.icon,
  p.park_group,
  array_to_string(p.region_ids, '|') AS region_ids,
  p.country,
  p.latitude,
  p.longitude,
  p.official_url,
  p.opens_at,
  p.closes_at,
  p.hours_known,
  p.affiliate_hotel_query,
  p.affiliate_ticket_url,
  p.sort_order,
  (SELECT COUNT(*) FROM attractions a WHERE a.park_id = p.id) AS attractions_count
FROM parks p
WHERE p.is_custom IS NOT TRUE
ORDER BY p.region_ids, p.sort_order, p.name;

-- ------------------------------------------------------------
-- 3. Attractions inventory
-- ------------------------------------------------------------
SELECT
  a.id,
  a.park_id,
  p.name AS park_name,
  array_to_string(p.region_ids, '|') AS region_ids,
  a.name,
  a.category,
  a.thrill_level,
  a.is_indoor,
  a.duration_minutes,
  a.height_requirement_cm,
  a.skip_line_system,
  a.skip_line_tier,
  a.avg_wait_peak_minutes,
  a.avg_wait_offpeak_minutes,
  a.is_seasonal,
  a.is_temporarily_closed,
  array_to_string(a.tags, '|') AS tags,
  a.official_url,
  a.sort_order
FROM attractions a
JOIN parks p ON a.park_id = p.id
ORDER BY p.region_ids, a.park_id, a.sort_order, a.name;

-- ------------------------------------------------------------
-- 4. Region → skip-line system mappings
-- ------------------------------------------------------------
SELECT
  region_id,
  skip_line_system_id
FROM region_skip_line_systems
ORDER BY region_id, skip_line_system_id;

-- ------------------------------------------------------------
-- 5. Top-line summary (single row)
-- ------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM regions) AS regions_total,
  (SELECT COUNT(*) FROM regions WHERE is_active) AS regions_active,
  (SELECT COUNT(*) FROM regions WHERE is_featured) AS regions_featured,
  (SELECT COUNT(*) FROM parks WHERE is_custom IS NOT TRUE) AS parks_total,
  (SELECT COUNT(*) FROM parks WHERE is_custom IS NOT TRUE AND hours_known) AS parks_with_hours,
  (SELECT COUNT(*) FROM parks WHERE is_custom IS NOT TRUE AND latitude IS NOT NULL) AS parks_with_coords,
  (SELECT COUNT(*) FROM parks WHERE is_custom IS NOT TRUE AND official_url IS NOT NULL AND official_url <> '') AS parks_with_url,
  (SELECT COUNT(*) FROM attractions) AS attractions_total,
  (SELECT COUNT(*) FROM region_skip_line_systems) AS skip_line_mappings;
