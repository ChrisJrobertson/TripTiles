
-- ============================================================================
-- Cleanup: 18 parks have polluted region_ids arrays from a bad batch import.
-- Each park is tagged for its correct region PLUS every UK city + miami
-- combos. Some have duplicate entries within the array.
--
-- Strategy:
-- 1. Backup original region_ids to a new column for safety/reversibility
-- 2. Restore each affected park to its correct minimal region set
-- 3. Verify counts after the cleanup
-- ============================================================================

-- Step 1: backup original region_ids
alter table parks 
  add column if not exists region_ids_backup_pre_cleanup text[];

update parks 
set region_ids_backup_pre_cleanup = region_ids
where id in (
  'cavern', 'heltvln', 'winder', 'lonwe', 'cambpunt', 'rscspa',
  'thermae', 'elephhs', 'gotour', 'portmiad', 'portmia', 'airboat',
  'joesston', 'keylargo', 'keywest', 'naples', 'sanibel', 'sevenml',
  'versail'
)
and region_ids_backup_pre_cleanup is null;

-- Step 2: restore each park to its correct region(s)

-- UK city-specific venues (each gets its city + uk_combo, nothing else)
update parks set region_ids = ARRAY['liverpool', 'uk_combo']    where id = 'cavern';     -- Cavern Club, Liverpool
update parks set region_ids = ARRAY['lakedist', 'uk_combo']     where id = 'heltvln';    -- Helvellyn Hike, Lake District
update parks set region_ids = ARRAY['lakedist', 'uk_combo']     where id = 'winder';     -- Lake Windermere Cruise, Lake District
update parks set region_ids = ARRAY['london', 'uk_combo']       where id = 'lonwe';      -- London West End Show
update parks set region_ids = ARRAY['cambridge', 'uk_combo']    where id = 'cambpunt';   -- Punting on the Cam, Cambridge
update parks set region_ids = ARRAY['stratfm', 'uk_combo']      where id = 'rscspa';     -- RSC Stratford
update parks set region_ids = ARRAY['bath', 'uk_combo']         where id = 'thermae';    -- Thermae Bath Spa
update parks set region_ids = ARRAY['edinburgh', 'uk_combo']    where id = 'elephhs';    -- The Elephant House, Edinburgh
update parks set region_ids = ARRAY['belfast', 'uk_combo']      where id = 'gotour';     -- Game of Thrones Tour, Belfast

-- Miami / Florida combo venues (each gets miami + florida_combo)
update parks set region_ids = ARRAY['miami', 'cruise', 'florida_combo']  where id = 'portmiad';   -- Port Miami Disembark
update parks set region_ids = ARRAY['miami', 'cruise', 'florida_combo']  where id = 'portmia';    -- Port Miami Embark
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'airboat';    -- Everglades Airboat Tour
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'joesston';   -- Joe's Stone Crab
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'keylargo';   -- Key Largo Snorkelling
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'keywest';    -- Key West Day Trip
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'naples';     -- Naples Day Trip
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'sanibel';    -- Sanibel Island
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'sevenml';    -- Seven Mile Bridge Drive
update parks set region_ids = ARRAY['miami', 'florida_combo']            where id = 'versail';    -- Versailles Cuban
;
