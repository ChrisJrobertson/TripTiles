
-- ============================================================================
-- Add a "Florida Combo" region for Orlando + Miami trips
-- This is a common use case: 10 days Orlando parks + 4 days Miami beach
-- ============================================================================

insert into regions (id, name, short_name, country, country_code, continent, flag_emoji, description, is_featured, sort_order) values
  ('florida_combo', 'Florida Combo (Orlando + Miami)', 'FL Combo', 'United States', 'US', 'North America', '🇺🇸', 'Orlando theme parks combined with Miami beaches and day trips', true, 16)
on conflict (id) do nothing;

-- Populate the combo region with ALL parks from both Orlando and Miami
update parks
set region_ids = array_append(region_ids, 'florida_combo')
where ('orlando' = any(region_ids) or 'miami' = any(region_ids))
  and not ('florida_combo' = any(region_ids));

-- Add a combo-specific achievement
insert into achievement_definitions (key, title, description, icon, category, threshold, sort_order) values
  ('dest_florida_combo', 'Sunshine State Sweep', 'Planned a combined Orlando + Miami trip', '🌴', 'destinations', 1, 57)
on conflict (key) do nothing;
;
