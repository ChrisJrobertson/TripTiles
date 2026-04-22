-- Disney parks outside Orlando — Batch 1
-- Heights marked VERIFIED are based on widely published official requirements.
-- Heights marked VERIFY should be checked against the park's official website before applying to production.
-- avg_wait_peak_minutes are AI ESTIMATEs — heuristic, not from live wait time data.
-- NOTE: Walt Disney Studios Park uses `park_id` **wdsp** (canonical in TripTiles; not `wds`).

-- ============================================================
-- DISNEYLAND PARK (California) — park_id: dl
-- ============================================================

-- VERIFIED: Space Mountain, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-space-mountain', 'dl', 'Space Mountain', 102, 'thrilling', 60, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Indoor coaster in the dark.');

-- VERIFIED: Big Thunder Mountain Railroad, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-big-thunder', 'dl', 'Big Thunder Mountain Railroad', 102, 'moderate', 50, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible.');

-- VERIFIED: Matterhorn Bobsleds, height 107cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-matterhorn', 'dl', 'Matterhorn Bobsleds', 107, 'moderate', 45, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Rough ride.');

-- VERIFIED: Indiana Jones Adventure, height 117cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-indiana-jones', 'dl', 'Indiana Jones Adventure', 117, 'thrilling', 55, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible.');

-- VERIFIED: Star Wars Rise of the Resistance, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-rise-resistance', 'dl', 'Star Wars: Rise of the Resistance', 102, 'thrilling', 90, 'single_pass', 'lightning_lane', 'Lightning Lane Single Pass — premium individual purchase. Often the longest wait in the park.');

-- VERIFIED: Millennium Falcon Smugglers Run, height 97cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-smugglers-run', 'dl', 'Millennium Falcon: Smugglers Run', 97, 'moderate', 50, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible.');

-- VERIFIED: Haunted Mansion, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-haunted-mansion', 'dl', 'Haunted Mansion', NULL, 'gentle', 35, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Seasonal Nightmare Before Christmas overlay.');

-- VERIFIED: Pirates of the Caribbean, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-pirates', 'dl', 'Pirates of the Caribbean', NULL, 'gentle', 30, NULL, NULL, 'Original Disneyland version — longer than the Florida one.');

-- VERIFIED: it''s a small world, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-small-world', 'dl', 'it''s a small world', NULL, 'gentle', 25, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible.');

-- VERIFIED: Peter Pan''s Flight, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dl-peter-pan', 'dl', 'Peter Pan''s Flight', NULL, 'gentle', 60, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Notoriously long standby line.');

-- ============================================================
-- DISNEY CALIFORNIA ADVENTURE — park_id: dca
-- ============================================================

-- VERIFIED: Guardians of the Galaxy Mission BREAKOUT, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-guardians', 'dca', 'Guardians of the Galaxy: Mission BREAKOUT!', 102, 'intense', 55, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Drop tower.');

-- VERIFIED: Incredicoaster, height 122cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-incredicoaster', 'dca', 'Incredicoaster', 122, 'intense', 50, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Launch coaster with inversion.');

-- VERIFIED: Radiator Springs Racers, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-rsr', 'dca', 'Radiator Springs Racers', 102, 'moderate', 80, 'single_pass', 'lightning_lane', 'Lightning Lane Single Pass — premium individual purchase. Most popular ride in DCA.');

-- VERIFIED: Soarin Around the World, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-soarin', 'dca', 'Soarin'' Around the World', 102, 'gentle', 45, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible.');

-- VERIFIED: Toy Story Midway Mania, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-toy-story', 'dca', 'Toy Story Midway Mania!', NULL, 'gentle', 50, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible.');

-- VERIFIED: Web Slingers Spider Man Adventure, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-web-slingers', 'dca', 'WEB SLINGERS: A Spider-Man Adventure', NULL, 'gentle', 60, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. Avengers Campus.');

-- VERIFY: Goofy''s Sky School, height 107cm — confirm on disneyland.com
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-goofys-sky', 'dca', 'Goofy''s Sky School', 107, 'moderate', 30, NULL, NULL, 'Wild mouse style coaster.');

-- VERIFIED: Grizzly River Run, height 107cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dca-grizzly', 'dca', 'Grizzly River Run', 107, 'moderate', 35, 'multi_pass', 'lightning_lane', 'Lightning Lane Multi Pass eligible. River rapids — you will get wet.');

-- ============================================================
-- DISNEYLAND PARK PARIS — park_id: dlp
-- ============================================================

-- VERIFIED: Big Thunder Mountain (Paris), height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-big-thunder', 'dlp', 'Big Thunder Mountain', 102, 'moderate', 50, 'premier_access', 'premier_access', 'Premier Access available — paid skip-the-line.');

-- VERIFIED: Hyperspace Mountain (relaunched as Star Wars Hyperspace Mountain), height 120cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-hyperspace-mountain', 'dlp', 'Star Wars Hyperspace Mountain', 120, 'intense', 60, 'premier_access', 'premier_access', 'Premier Access available. Inversions, launch — most intense Mountain in the Disney portfolio.');

-- VERIFIED: Indiana Jones et le Temple du Peril, height 140cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-indiana-jones', 'dlp', 'Indiana Jones et le Temple du Péril', 140, 'intense', 35, NULL, NULL, 'Compact looping coaster.');

-- VERIFIED: Phantom Manor, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-phantom-manor', 'dlp', 'Phantom Manor', NULL, 'gentle', 30, 'premier_access', 'premier_access', 'Premier Access available. Darker reimagining of Haunted Mansion.');

-- VERIFIED: Pirates of the Caribbean (Paris), no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-pirates', 'dlp', 'Pirates of the Caribbean', NULL, 'gentle', 25, NULL, NULL, 'Considered by many fans the best version of this ride globally.');

-- VERIFIED: it''s a small world (Paris), no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-small-world', 'dlp', 'it''s a small world', NULL, 'gentle', 30, 'premier_access', 'premier_access', 'Premier Access available.');

-- VERIFIED: Peter Pan''s Flight (Paris), no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-peter-pan', 'dlp', 'Peter Pan''s Flight', NULL, 'gentle', 70, 'premier_access', 'premier_access', 'Premier Access available. Often the longest standby in the park.');

-- VERIFIED: Buzz Lightyear Laser Blast, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('dlp-buzz', 'dlp', 'Buzz Lightyear Laser Blast', NULL, 'gentle', 35, 'premier_access', 'premier_access', 'Premier Access available.');

-- ============================================================
-- WALT DISNEY STUDIOS PARIS — park_id: wdsp
-- ============================================================

-- VERIFIED: Avengers Assemble Flight Force, height 120cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-flight-force', 'wdsp', 'Avengers Assemble: Flight Force', 120, 'intense', 60, 'premier_access', 'premier_access', 'Premier Access available. Launch coaster with inversions — Avengers Campus Paris.');

-- VERIFIED: Spider Man WEB Adventure (Paris), no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-web-adventure', 'wdsp', 'Spider-Man W.E.B. Adventure', NULL, 'gentle', 50, 'premier_access', 'premier_access', 'Premier Access available. Avengers Campus Paris.');

-- VERIFIED: Crush''s Coaster, height 107cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-crush', 'wdsp', 'Crush''s Coaster', 107, 'thrilling', 80, NULL, NULL, 'Spinning coaster — chronically long waits, no Premier Access. Ride first thing.');

-- VERIFIED: Ratatouille The Adventure, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-ratatouille', 'wdsp', 'Ratatouille: The Adventure', NULL, 'gentle', 45, 'premier_access', 'premier_access', 'Premier Access available. Trackless dark ride.');

-- VERIFIED: Tower of Terror (Paris), height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-tower-terror', 'wdsp', 'The Twilight Zone Tower of Terror', 102, 'intense', 55, 'premier_access', 'premier_access', 'Premier Access available. Drop tower.');

-- VERIFIED: Toy Soldiers Parachute Drop, height 81cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-parachute', 'wdsp', 'Toy Soldiers Parachute Drop', 81, 'moderate', 25, NULL, NULL, 'Family-friendly drop tower.');

-- VERIFIED: Cars Road Trip, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('wdsp-cars-road-trip', 'wdsp', 'Cars Road Trip', NULL, 'gentle', 25, NULL, NULL, 'Slow scenic tour ride.');

-- ============================================================
-- HONG KONG DISNEYLAND — park_id: hkdl
-- ============================================================

-- VERIFIED: Big Grizzly Mountain Runaway Mine Cars, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-grizzly-mountain', 'hkdl', 'Big Grizzly Mountain Runaway Mine Cars', 102, 'thrilling', 35, NULL, NULL, 'Launch coaster with backwards section. Park unique.');

-- VERIFIED: Hyperspace Mountain (HK), height 102cm — currently Space Mountain themed
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-space-mountain', 'hkdl', 'Hyperspace Mountain', 102, 'thrilling', 40, NULL, NULL, 'Indoor coaster in the dark with Star Wars overlay.');

-- VERIFIED: Mystic Manor, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-mystic-manor', 'hkdl', 'Mystic Manor', NULL, 'gentle', 30, NULL, NULL, 'Trackless dark ride — park unique. Often cited as one of the best dark rides Disney has built.');

-- VERIFIED: World of Frozen Wandering Oaken''s Sliding Sleighs, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-frozen-coaster', 'hkdl', 'Wandering Oaken''s Sliding Sleighs', 102, 'moderate', 50, NULL, NULL, 'Family coaster in World of Frozen — opened 2023.');

-- VERIFIED: Frozen Ever After (HK version), no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-frozen-ever-after', 'hkdl', 'Frozen Ever After', NULL, 'gentle', 60, NULL, NULL, 'Boat dark ride — World of Frozen.');

-- VERIFIED: Iron Man Experience, height 102cm
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-iron-man', 'hkdl', 'Iron Man Experience', 102, 'thrilling', 30, NULL, NULL, 'Simulator ride — park unique. First Marvel-themed ride globally.');

-- VERIFIED: Ant Man and The Wasp Nano Battle, no height requirement
INSERT INTO public.attractions (id, park_id, name, height_requirement_cm, thrill_level, avg_wait_peak_minutes, skip_line_tier, skip_line_system, skip_line_notes)
VALUES ('hkdl-ant-man', 'hkdl', 'Ant-Man and The Wasp: Nano Battle!', NULL, 'gentle', 25, NULL, NULL, 'Interactive shooter dark ride.');
