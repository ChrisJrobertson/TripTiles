
-- Built-in parks reference data for TripTiles
-- These are the canonical options users see in the palette
-- Custom user-added parks live in the same table with is_custom = true

insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, sort_order) values
-- Travel & Cruise (shown for all destinations)
('flyout',  'Fly Out / Arrive',     '✈',  '#E63946', '#FFFFFF', 'travel', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 1),
('flyhome', 'Fly Home / Depart',    '✈',  '#9D0208', '#FFFFFF', 'travel', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 2),
('embark',  'Cruise Embark',        '⚓', '#F4A261', '#0B1E5C', 'travel', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 3),
('disemb',  'Cruise Disembark',     '⚓', '#E76F51', '#FFFFFF', 'travel', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 4),
('sea',     'Cruise — At Sea',      '⚓', '#1E6091', '#FFD700', 'travel', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 5),
('port',    'Cruise — Port Day',    '⚓', '#20B2AA', '#FFFFFF', 'travel', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 6),

-- Orlando — Disney parks
('mk',  'Magic Kingdom',          null, '#4B2E83', '#F5D76E', 'disney', array['orlando']::destination[], 10),
('ep',  'EPCOT',                  null, '#1E88E5', '#FFFFFF', 'disney', array['orlando']::destination[], 11),
('hs',  'Hollywood Studios',      null, '#8B0000', '#F5D76E', 'disney', array['orlando']::destination[], 12),
('ak',  'Animal Kingdom',         null, '#2D5016', '#F5E6A8', 'disney', array['orlando']::destination[], 13),

-- Orlando — Disney extras
('bb',  'Blizzard Beach',         null, '#4A90D9', '#FFFFFF', 'disneyextra', array['orlando']::destination[], 20),
('tl',  'Typhoon Lagoon',         null, '#2E8B8B', '#FFF4C2', 'disneyextra', array['orlando']::destination[], 21),
('ds',  'Disney Springs',         null, '#D4725B', '#FFFFFF', 'disneyextra', array['orlando']::destination[], 22),
('dq',  'Mini-Golf',              null, '#7B2D8E', '#F5D76E', 'disneyextra', array['orlando']::destination[], 23),

-- Orlando — Universal
('us',  'Universal Studios',      null, '#003D82', '#FFD700', 'universal', array['orlando']::destination[], 30),
('ioa', 'Islands of Adventure',   null, '#C2410C', '#FFF4C2', 'universal', array['orlando']::destination[], 31),
('eu',  'Epic Universe',          null, '#6A0DAD', '#F5D76E', 'universal', array['orlando']::destination[], 32),
('vb',  'Volcano Bay',            null, '#D84315', '#FFF4C2', 'universal', array['orlando']::destination[], 33),
('cw',  'CityWalk',               null, '#1B263B', '#FFD700', 'universal', array['orlando']::destination[], 34),

-- Orlando — SeaWorld group
('sw',  'SeaWorld Orlando',       null, '#006B9F', '#FFFFFF', 'seaworld', array['orlando']::destination[], 40),
('aq',  'Aquatica',               null, '#00A8B5', '#FFFFFF', 'seaworld', array['orlando']::destination[], 41),
('dc',  'Discovery Cove',         null, '#008B8B', '#FFFFFF', 'seaworld', array['orlando']::destination[], 42),
('bg',  'Busch Gardens Tampa',    null, '#8B4513', '#FFD700', 'seaworld', array['orlando']::destination[], 43),

-- Orlando — Other attractions
('ksc',  'Kennedy Space Center',  null, '#1A1A2E', '#C0C0C0', 'attractions', array['orlando']::destination[], 50),
('gl',   'Gatorland',             null, '#556B2F', '#F5D76E', 'attractions', array['orlando']::destination[], 51),
('ll',   'LEGOLAND Florida',      null, '#D7222C', '#FFD700', 'attractions', array['orlando']::destination[], 52),
('icon', 'ICON Park',             null, '#00B4B4', '#FFFFFF', 'attractions', array['orlando']::destination[], 53),
('ww',   'WonderWorks',           null, '#6B2C91', '#FFFFFF', 'attractions', array['orlando']::destination[], 54),

-- Paris — Disney
('dlp',  'Disneyland Paris',       null, '#4B2E83', '#F5D76E', 'disney',      array['paris']::destination[], 60),
('wdsp', 'Walt Disney Studios',    null, '#8B0000', '#F5D76E', 'disney',      array['paris']::destination[], 61),
('dv',   'Disney Village',         null, '#D4725B', '#FFFFFF', 'disneyextra', array['paris']::destination[], 62),

-- Paris — Other attractions
('ast',  'Parc Astérix',           null, '#F5A623', '#0B1E5C', 'attractions', array['paris']::destination[], 70),
('fut',  'Futuroscope',            null, '#6A0DAD', '#FFFFFF', 'attractions', array['paris']::destination[], 71),
('jda',  'Jardin d''Acclimatation', null, '#2D5016', '#F5E6A8', 'attractions', array['paris']::destination[], 72),

-- Paris — Sights
('eif',   'Eiffel Tower',         null, '#8B6914', '#FFFFFF', 'sights', array['paris']::destination[], 80),
('louv',  'Louvre',                null, '#4A148C', '#FFD700', 'sights', array['paris']::destination[], 81),
('vers',  'Versailles',            null, '#C9A961', '#0B1E5C', 'sights', array['paris']::destination[], 82),
('notr',  'Notre-Dame',            null, '#5C1F00', '#F5D76E', 'sights', array['paris']::destination[], 83),
('seine', 'Seine River Cruise',    null, '#1E6091', '#FFFFFF', 'sights', array['paris']::destination[], 84),
('arc',   'Arc de Triomphe',       null, '#8B4513', '#FFD700', 'sights', array['paris']::destination[], 85),
('mont',  'Montmartre',            null, '#B76BA3', '#FFFFFF', 'sights', array['paris']::destination[], 86),

-- Tokyo — Disney
('tdl',  'Tokyo Disneyland',      null, '#4B2E83', '#F5D76E', 'disney',      array['tokyo']::destination[], 90),
('tds',  'Tokyo DisneySea',       null, '#1E88E5', '#FFFFFF', 'disney',      array['tokyo']::destination[], 91),
('iks',  'Ikspiari',              null, '#D4725B', '#FFFFFF', 'disneyextra', array['tokyo']::destination[], 92),

-- Tokyo — Other parks
('usj',  'Universal Studios Japan', null, '#003D82', '#FFD700', 'universal',   array['tokyo']::destination[], 100),
('fuji', 'Fuji-Q Highland',         null, '#E63946', '#FFFFFF', 'attractions', array['tokyo']::destination[], 101),
('san',  'Sanrio Puroland',         null, '#FF69B4', '#FFFFFF', 'attractions', array['tokyo']::destination[], 102),
('yomi', 'Yomiuriland',             null, '#20B2AA', '#FFFFFF', 'attractions', array['tokyo']::destination[], 103),
('tlab', 'teamLab Planets',         null, '#6A0DAD', '#F5D76E', 'attractions', array['tokyo']::destination[], 104),
('joy',  'Tokyo Joypolis',          null, '#D7222C', '#FFD700', 'attractions', array['tokyo']::destination[], 105),

-- Tokyo — Sights
('tt',    'Tokyo Tower',         null, '#E63946', '#FFFFFF', 'sights', array['tokyo']::destination[], 110),
('sky',   'Tokyo Skytree',        null, '#4A90D9', '#FFFFFF', 'sights', array['tokyo']::destination[], 111),
('shib',  'Shibuya / Harajuku',   null, '#FF69B4', '#FFFFFF', 'sights', array['tokyo']::destination[], 112),
('aki',   'Akihabara',            null, '#C2410C', '#FFFFFF', 'sights', array['tokyo']::destination[], 113),
('asa',   'Asakusa / Senso-ji',   null, '#8B0000', '#F5D76E', 'sights', array['tokyo']::destination[], 114),
('shin',  'Shinjuku',             null, '#1A1A2E', '#C0C0C0', 'sights', array['tokyo']::destination[], 115),
('meiji', 'Meiji Shrine',         null, '#2D5016', '#F5E6A8', 'sights', array['tokyo']::destination[], 116),
('mtf',   'Mt Fuji Day Trip',     null, '#4A90D9', '#FFFFFF', 'sights', array['tokyo']::destination[], 117),
('hak',   'Hakone',               null, '#008B8B', '#FFFFFF', 'sights', array['tokyo']::destination[], 118),

-- California — Disney
('dl',  'Disneyland Park',         null, '#4B2E83', '#F5D76E', 'disney',      array['cali']::destination[], 120),
('dca', 'California Adventure',    null, '#8B0000', '#F5D76E', 'disney',      array['cali']::destination[], 121),
('dtd', 'Downtown Disney',         null, '#D4725B', '#FFFFFF', 'disneyextra', array['cali']::destination[], 122),

-- California — Other parks
('ush',  'Universal Studios Hollywood', null, '#003D82', '#FFD700', 'universal',   array['cali']::destination[], 130),
('sfmm', 'Six Flags Magic Mountain',    null, '#E63946', '#FFFFFF', 'attractions', array['cali']::destination[], 131),
('knot', 'Knott''s Berry Farm',         null, '#8B4513', '#FFD700', 'attractions', array['cali']::destination[], 132),
('llc',  'LEGOLAND California',         null, '#D7222C', '#FFD700', 'attractions', array['cali']::destination[], 133),
('swsd', 'SeaWorld San Diego',          null, '#006B9F', '#FFFFFF', 'seaworld',    array['cali']::destination[], 134),
('sdz',  'San Diego Zoo',               null, '#556B2F', '#F5D76E', 'seaworld',    array['cali']::destination[], 135),

-- California — Sights
('hwd',  'Hollywood Walk of Fame', null, '#C9A961', '#0B1E5C', 'sights', array['cali']::destination[], 140),
('grif', 'Griffith Observatory',   null, '#1A1A2E', '#C0C0C0', 'sights', array['cali']::destination[], 141),
('sm',   'Santa Monica Pier',      null, '#FFA500', '#0B1E5C', 'sights', array['cali']::destination[], 142),
('ven',  'Venice Beach',           null, '#00A8B5', '#FFFFFF', 'sights', array['cali']::destination[], 143),

-- Cruise excursions (shown for all destinations)
('exc',   'Shore Excursion',  '⚓', '#0077B6', '#FFFFFF', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 150),
('beach', 'Beach Day',        null, '#FFA500', '#0B1E5C', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 151),
('snk',   'Snorkel / Dive',   null, '#00695C', '#FFFFFF', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 152),
('psh',   'Port Shopping',    null, '#B76BA3', '#FFFFFF', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 153),
('ship',  'Ship Day',         '⚓', '#1F4E79', '#FFD700', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 154),
('pool',  'Ship Pool / Bar',  null, '#0096C7', '#FFFFFF', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 155),
('spac',  'Ship Spa',         null, '#C77DC4', '#FFFFFF', 'excursions', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 156),

-- Dining (shown for all destinations)
('owl',   'Quick Service',     null, '#8B6914', '#FFFFFF', 'dining', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 160),
('tsr',   'Table Service',     null, '#5C1F00', '#F5D76E', 'dining', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 161),
('char',  'Character Dining',  null, '#C71585', '#FFFFFF', 'dining', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 162),
('villa', 'Villa / Home Cook', null, '#4A7C59', '#FFFFFF', 'dining', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 163),
('specd', 'Specialty Dining',  null, '#4A148C', '#FFD700', 'dining', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 164),

-- Activities & rest (shown for all destinations)
('rest', 'Rest / Pool',         null, '#6B9080', '#FFFFFF', 'activities', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 170),
('shop', 'Shopping / Outlets',  null, '#7B2D8E', '#FFFFFF', 'activities', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 171),
('golf', 'Golf',                null, '#2D5016', '#FFFFFF', 'activities', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 172),
('spa',  'Spa / Villa Day',     null, '#B76BA3', '#FFFFFF', 'activities', array['orlando','paris','tokyo','cali','cruise','custom']::destination[], 173);
;
