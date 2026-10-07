
-- ============================================================================
-- Add Miami as a region for Florida combo trips (Orlando + Miami)
-- and pure Miami/South Florida holidays
-- ============================================================================

insert into regions (id, name, short_name, country, country_code, continent, flag_emoji, description, is_featured, sort_order) values
  ('miami', 'Miami & South Florida', 'Miami', 'United States', 'US', 'North America', '🇺🇸', 'Beaches, Everglades, cruise port, Key West and Cuban culture', true, 15)
on conflict (id) do nothing;

-- ============================================================================
-- Seed Miami-specific parks and attractions
-- Carefully curated for families combining Orlando + Miami, cruise travellers,
-- and pure Miami holidaymakers
-- ============================================================================

insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, region_ids, sort_order) values

-- Theme parks & animal attractions (the "park" bit of the trip)
('seaqm',    'Miami Seaquarium',       null, '#006B9F', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['miami'], 700),
('junglei',  'Jungle Island',          null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['miami'], 701),
('zoomia',   'Zoo Miami',              null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['miami'], 702),
('monkey',   'Monkey Jungle',          null, '#8B6914', '#FFFFFF', 'attractions', array['custom']::destination[], array['miami'], 703),
('gatorpk',  'Everglades Alligator Farm', null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['miami'], 704),
('fruitspice','Fruit & Spice Park',   null, '#FF6B35', '#FFFFFF', 'attractions', array['custom']::destination[], array['miami'], 705),

-- Beaches (the main event for most Miami trips)
('mbeach',   'Miami Beach',            null, '#00A8B5', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 710),
('southbch', 'South Beach',            null, '#FF69B4', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 711),
('keybisc',  'Key Biscayne',           null, '#4A90D9', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 712),
('bayharbr', 'Bal Harbour Beach',      null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['miami'], 713),
('ftlaud',   'Fort Lauderdale Beach',  null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['miami'], 714),
('hauloverp','Haulover Park Beach',    null, '#4A90D9', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 715),

-- Nature & Everglades (the must-do for wildlife)
('evergnp',  'Everglades National Park', null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['miami'], 720),
('airboat',  'Everglades Airboat Tour', null, '#00695C', '#F5D76E', 'excursions',  array['custom']::destination[], array['miami'], 721),
('biscnp',   'Biscayne National Park', null, '#006B9F', '#FFFFFF', 'attractions', array['custom']::destination[], array['miami'], 722),
('keylargo', 'Key Largo Snorkelling',  null, '#00A8B5', '#FFFFFF', 'excursions',  array['custom']::destination[], array['miami'], 723),
('johnpenn', 'John Pennekamp Coral Reef', null, '#00A8B5', '#FFFFFF', 'attractions', array['custom']::destination[], array['miami'], 724),

-- Cultural sights (what makes Miami Miami)
('littleh',  'Little Havana',          null, '#E63946', '#F5D76E', 'sights',      array['custom']::destination[], array['miami'], 730),
('wynwood',  'Wynwood Walls',          null, '#FF1493', '#FFD700', 'sights',      array['custom']::destination[], array['miami'], 731),
('artdeco',  'Art Deco District',      null, '#FF69B4', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 732),
('vizcaya',  'Vizcaya Museum',         null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['miami'], 733),
('perez',    'Pérez Art Museum',       null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['miami'], 734),
('frostsci', 'Frost Science Museum',   null, '#1E6091', '#FFD700', 'sights',      array['custom']::destination[], array['miami'], 735),
('calleocho','Calle Ocho',             null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['miami'], 736),
('coconut',  'Coconut Grove',          null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['miami'], 737),
('coralgab', 'Coral Gables',           null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['miami'], 738),

-- Day trips (longer excursions)
('keywest',  'Key West Day Trip',      null, '#00A8B5', '#FFFFFF', 'excursions',  array['custom']::destination[], array['miami'], 740),
('sevenml',  'Seven Mile Bridge Drive',null, '#4A90D9', '#FFFFFF', 'excursions',  array['custom']::destination[], array['miami'], 741),
('naples',   'Naples Day Trip',        null, '#FFA500', '#0B1E5C', 'excursions',  array['custom']::destination[], array['miami'], 742),
('sanibel',  'Sanibel Island',         null, '#FFA500', '#0B1E5C', 'excursions',  array['custom']::destination[], array['miami'], 743),

-- Sports & entertainment
('hardroc',  'Hard Rock Stadium',      null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['miami'], 750),
('kaseya',   'Kaseya Center (Heat)',   null, '#98002E', '#F9A01B', 'attractions', array['custom']::destination[], array['miami'], 751),
('loandep',  'loanDepot Park (Marlins)', null, '#00A3E0', '#EF3340', 'attractions', array['custom']::destination[], array['miami'], 752),

-- Shopping (Americans love mall days)
('dolphnm',  'Dolphin Mall',           null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['miami'], 760),
('avenura',  'Aventura Mall',          null, '#FF69B4', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 761),
('lincoln',  'Lincoln Road Mall',      null, '#00A8B5', '#FFFFFF', 'sights',      array['custom']::destination[], array['miami'], 762),
('bayside',  'Bayside Marketplace',    null, '#1E6091', '#FFD700', 'sights',      array['custom']::destination[], array['miami'], 763),

-- Dining highlights (distinct enough to be their own tile)
('versail',  'Versailles Cuban',       null, '#FFD700', '#0B1E5C', 'dining',      array['custom']::destination[], array['miami'], 770),
('joesston', 'Joe''s Stone Crab',      null, '#E63946', '#FFD700', 'dining',      array['custom']::destination[], array['miami'], 771),

-- Cruise embark/disembark (PortMiami is the busiest cruise port in the world)
('portmia',  'PortMiami Embark',       null, '#003D82', '#FFD700', 'travel',      array['custom']::destination[], array['miami','cruise'], 780),
('portmiad', 'PortMiami Disembark',    null, '#003D82', '#FFD700', 'travel',      array['custom']::destination[], array['miami','cruise'], 781)

on conflict (id) do nothing;

-- ============================================================================
-- Make sure universal "travel/dining/activities/excursions" parks also show up
-- in the Miami region so users planning a Miami trip see flight days, custom
-- restaurants, etc in their palette
-- ============================================================================
update parks
set region_ids = array_append(region_ids, 'miami')
where park_group in ('travel', 'dining', 'activities', 'excursions')
  and not ('miami' = any(region_ids));

-- ============================================================================
-- Add Miami-specific destination achievement
-- ============================================================================
insert into achievement_definitions (key, title, description, icon, category, threshold, sort_order) values
  ('dest_miami', 'Miami Vice', 'Planned a Miami trip', '🏖️', 'destinations', 1, 56)
on conflict (key) do nothing;
;
