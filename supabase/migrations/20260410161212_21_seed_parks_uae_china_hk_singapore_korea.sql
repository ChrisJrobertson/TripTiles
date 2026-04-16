
-- Global theme parks: UAE, Shanghai, Hong Kong, Singapore, South Korea

insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, region_ids, sort_order) values

-- ============================================================================
-- UAE 🇦🇪 (Dubai + Abu Dhabi)
-- ============================================================================
('img',      'IMG Worlds of Adventure', null, '#1A1A2E', '#FFD700', 'attractions', array['custom']::destination[], array['uae'],       300),
('motgate',  'Motiongate Dubai',       null, '#003D82', '#FFD700', 'attractions', array['custom']::destination[], array['uae'],         301),
('bolly',    'Bollywood Parks',        null, '#FF1493', '#FFD700', 'attractions', array['custom']::destination[], array['uae'],         302),
('legodxb',  'LEGOLAND Dubai',         null, '#D7222C', '#FFD700', 'attractions', array['custom']::destination[], array['uae'],         303),
('legodxbw', 'LEGOLAND Water Park Dubai', null, '#00A8B5', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['uae'],      304),
('wbabu',    'Warner Bros World Abu Dhabi', null, '#1A1A2E', '#FFD700', 'attractions', array['custom']::destination[], array['uae'],   305),
('ferrwo',   'Ferrari World Abu Dhabi', null, '#E63946', '#FFD700', 'attractions', array['custom']::destination[], array['uae'],        306),
('yaswtr',   'Yas Waterworld',         null, '#00A8B5', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['uae'],         307),
('swabu',    'SeaWorld Abu Dhabi',     null, '#006B9F', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['uae'],         308),
('aquav',    'Aquaventure Atlantis',   null, '#00A8B5', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['uae'],         309),
('wildw',    'Wild Wadi Waterpark',    null, '#4A90D9', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['uae'],         310),
('dubmall',  'Dubai Mall',             null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['uae'],         311),
('burj',     'Burj Khalifa',           null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['uae'],         312),
('desafs',   'Desert Safari',          null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['uae'],         313),

-- ============================================================================
-- Shanghai 🇨🇳
-- ============================================================================
('shdl',     'Shanghai Disneyland',    null, '#4B2E83', '#F5D76E', 'disney',      array['custom']::destination[], array['shanghai'],    330),
('shdt',     'Disneytown Shanghai',    null, '#D4725B', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['shanghai'],    331),
('wishs',    'Wishing Star Park',      null, '#1E6091', '#FFD700', 'disneyextra', array['custom']::destination[], array['shanghai'],    332),
('haichuan', 'Haichang Ocean Park',    null, '#006B9F', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['shanghai'],    333),
('hphol',    'Happy Valley Shanghai',  null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['shanghai'],    334),
('jinj',     'Jinjiang Action Park',   null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['shanghai'],    335),
('shsights', 'Shanghai Sights',        null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['shanghai'],    336),
('shbund',   'The Bund',               null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['shanghai'],    337),

-- ============================================================================
-- Hong Kong 🇭🇰
-- ============================================================================
('hkdl',     'Hong Kong Disneyland',   null, '#4B2E83', '#F5D76E', 'disney',      array['custom']::destination[], array['hongkong'],    350),
('ocean',    'Ocean Park HK',          null, '#006B9F', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['hongkong'],    351),
('snoopy',   'Snoopy''s World',         null, '#FF69B4', '#FFFFFF', 'attractions', array['custom']::destination[], array['hongkong'],   352),
('peak',     'The Peak',               null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['hongkong'],    353),
('wong',     'Wong Tai Sin Temple',    null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['hongkong'],    354),

-- ============================================================================
-- Singapore 🇸🇬
-- ============================================================================
('uss',      'Universal Studios Singapore', null, '#003D82', '#FFD700', 'universal', array['custom']::destination[], array['singapore'], 370),
('ssgea',    'S.E.A. Aquarium',         null, '#00A8B5', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['singapore'],   371),
('advcv',    'Adventure Cove',         null, '#1E6091', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['singapore'],   372),
('sent',     'Sentosa Island',         null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['singapore'],   373),
('gbtb',     'Gardens by the Bay',     null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['singapore'],   374),
('mbs',      'Marina Bay Sands',       null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['singapore'],   375),
('zoosg',    'Singapore Zoo',          null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['singapore'],   376),

-- ============================================================================
-- South Korea 🇰🇷
-- ============================================================================
('every',    'Everland',               null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['seoul'],       390),
('lotw',     'Lotte World',            null, '#FF1493', '#FFD700', 'attractions', array['custom']::destination[], array['seoul'],       391),
('caribbean','Caribbean Bay',          null, '#00A8B5', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['seoul'],       392),
('seosights','Seoul Sights',           null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['seoul'],       393);
;
