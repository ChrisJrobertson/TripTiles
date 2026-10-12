
insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, region_ids, sort_order) values

-- ============================================================================
-- EDINBURGH & SCOTLAND
-- ============================================================================
('edincast', 'Edinburgh Castle',          null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['edinburgh'], 830),
('royalmi',  'Royal Mile',                null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['edinburgh'], 831),
('holyrood', 'Holyrood Palace',           null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['edinburgh'], 832),
('arthurs',  'Arthur''s Seat',            null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['edinburgh'], 833),
('natmusc',  'National Museum Scotland',  null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['edinburgh'], 834),
('edindun',  'Edinburgh Dungeon',         null, '#1A1A2E', '#8B0000', 'attractions', array['custom']::destination[], array['edinburgh'], 835),
('dynear',   'Dynamic Earth',             null, '#006B9F', '#FFFFFF', 'attractions', array['custom']::destination[], array['edinburgh'], 836),
('grassmkt', 'Grassmarket',               null, '#C9A961', '#5C1F00', 'sights',      array['custom']::destination[], array['edinburgh'], 837),
('elephhs',  'The Elephant House (HP)',   null, '#FF69B4', '#FFFFFF', 'dining',      array['custom']::destination[], array['edinburgh'], 838),

-- ============================================================================
-- BATH & COTSWOLDS
-- ============================================================================
('romanba',  'Roman Baths',               null, '#C9A961', '#5C1F00', 'attractions', array['custom']::destination[], array['bath'], 840),
('bathabbey','Bath Abbey',                null, '#8B6914', '#FFFFFF', 'sights',      array['custom']::destination[], array['bath'], 841),
('royalcr',  'Royal Crescent',            null, '#F5E6A8', '#5C1F00', 'sights',      array['custom']::destination[], array['bath'], 842),
('jasen',    'Jane Austen Centre',        null, '#FF69B4', '#FFFFFF', 'attractions', array['custom']::destination[], array['bath'], 843),
('thermae',  'Thermae Bath Spa',          null, '#00A8B5', '#FFFFFF', 'activities',  array['custom']::destination[], array['bath'], 844),
('cots',     'Cotswolds Villages',        null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['bath'], 845),
('castlec',  'Castle Combe',              null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['bath'], 846),
('stoneh',   'Stonehenge',                null, '#5C1F00', '#F5D76E', 'attractions', array['custom']::destination[], array['bath'], 847),

-- ============================================================================
-- LIVERPOOL
-- ============================================================================
('anfield',  'Anfield Stadium Tour',      null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['liverpool'], 850),
('beatlem',  'The Beatles Story',         null, '#FFD700', '#5C1F00', 'attractions', array['custom']::destination[], array['liverpool'], 851),
('albertd',  'Albert Dock',               null, '#003D82', '#FFD700', 'sights',      array['custom']::destination[], array['liverpool'], 852),
('tatelv',   'Tate Liverpool',            null, '#5C1F00', '#FFFFFF', 'sights',      array['custom']::destination[], array['liverpool'], 853),
('cavern',   'Cavern Club',               null, '#1A1A2E', '#FFD700', 'activities',  array['custom']::destination[], array['liverpool'], 854),
('matherb',  'Mathew Street',             null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['liverpool'], 855),

-- ============================================================================
-- YORK
-- ============================================================================
('yorkmin',  'York Minster',              null, '#8B6914', '#F5D76E', 'sights',      array['custom']::destination[], array['york'], 860),
('shambl',   'The Shambles',              null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['york'], 861),
('jorvik',   'Jorvik Viking Centre',      null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['york'], 862),
('yorkrail', 'National Railway Museum',   null, '#003D82', '#FFD700', 'attractions', array['custom']::destination[], array['york'], 863),
('yorkcst',  'York Castle Museum',        null, '#8B6914', '#F5D76E', 'attractions', array['custom']::destination[], array['york'], 864),
('yorkwall', 'York City Walls',           null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['york'], 865),

-- ============================================================================
-- MANCHESTER
-- ============================================================================
('oldtraf',  'Old Trafford Tour',         null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['manchester'], 870),
('etihad',   'Etihad Stadium Tour',       null, '#1E88E5', '#FFFFFF', 'attractions', array['custom']::destination[], array['manchester'], 871),
('scimanc',  'Science & Industry Museum', null, '#1E6091', '#FFD700', 'attractions', array['custom']::destination[], array['manchester'], 872),
('manccatm', 'Manchester Cathedral',      null, '#8B6914', '#FFFFFF', 'sights',      array['custom']::destination[], array['manchester'], 873),
('coronst',  'Coronation Street Tour',    null, '#C9A961', '#0B1E5C', 'attractions', array['custom']::destination[], array['manchester'], 874),

-- ============================================================================
-- CAMBRIDGE & OXFORD
-- ============================================================================
('kingscol', 'King''s College Cambridge', null, '#8B6914', '#F5D76E', 'sights',      array['custom']::destination[], array['cambridge'], 880),
('cambpunt', 'Punting on the Cam',        null, '#2D5016', '#F5E6A8', 'activities',  array['custom']::destination[], array['cambridge'], 881),
('fitzwill', 'Fitzwilliam Museum',        null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['cambridge'], 882),
('oxunitour','Oxford University Tour',    null, '#8B6914', '#F5D76E', 'attractions', array['custom']::destination[], array['cambridge'], 883),
('bodlib',   'Bodleian Library',          null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['cambridge'], 884),
('chchoxf',  'Christ Church (HP)',        null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['cambridge'], 885),
('blenpal',  'Blenheim Palace',           null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['cambridge'], 886),

-- ============================================================================
-- LAKE DISTRICT
-- ============================================================================
('winder',   'Lake Windermere Cruise',    null, '#006B9F', '#FFFFFF', 'activities',  array['custom']::destination[], array['lakedist'], 890),
('beatrx',   'Beatrix Potter World',      null, '#FF69B4', '#FFFFFF', 'attractions', array['custom']::destination[], array['lakedist'], 891),
('heltvln',  'Helvellyn Hike',            null, '#2D5016', '#F5E6A8', 'activities',  array['custom']::destination[], array['lakedist'], 892),
('ravenglas','Ravenglass Railway',        null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['lakedist'], 893),
('keswick',  'Keswick Market Town',       null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['lakedist'], 894),

-- ============================================================================
-- CORNWALL
-- ============================================================================
('edenp',    'Eden Project',              null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['cornwall'], 900),
('stmichm',  'St Michael''s Mount',       null, '#8B6914', '#F5D76E', 'sights',      array['custom']::destination[], array['cornwall'], 901),
('landsend', 'Land''s End',               null, '#006B9F', '#FFFFFF', 'sights',      array['custom']::destination[], array['cornwall'], 902),
('tintag',   'Tintagel Castle',           null, '#5C1F00', '#F5D76E', 'attractions', array['custom']::destination[], array['cornwall'], 903),
('corncast', 'Cornish Beaches',           null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['cornwall'], 904),
('stives',   'St Ives',                   null, '#4A90D9', '#FFFFFF', 'sights',      array['custom']::destination[], array['cornwall'], 905),

-- ============================================================================
-- SCOTTISH HIGHLANDS
-- ============================================================================
('lochness', 'Loch Ness',                 null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['highlands'], 910),
('skye',     'Isle of Skye',              null, '#006B9F', '#FFFFFF', 'sights',      array['custom']::destination[], array['highlands'], 911),
('glenfin',  'Glenfinnan Viaduct (HP)',   null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['highlands'], 912),
('glencoe',  'Glencoe',                   null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['highlands'], 913),
('urqhart',  'Urquhart Castle',           null, '#8B6914', '#F5D76E', 'attractions', array['custom']::destination[], array['highlands'], 914),

-- ============================================================================
-- CARDIFF & WALES
-- ============================================================================
('cardcast', 'Cardiff Castle',            null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['cardiff'], 920),
('drwhoxp',  'Doctor Who Experience',     null, '#1A1A2E', '#00A8B5', 'attractions', array['custom']::destination[], array['cardiff'], 921),
('snowd',    'Snowdonia National Park',   null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['cardiff'], 922),
('brecon',   'Brecon Beacons',            null, '#556B2F', '#F5D76E', 'sights',      array['custom']::destination[], array['cardiff'], 923),
('cardbay',  'Cardiff Bay',               null, '#003D82', '#FFD700', 'sights',      array['custom']::destination[], array['cardiff'], 924),

-- ============================================================================
-- BELFAST & NORTHERN IRELAND
-- ============================================================================
('titanic',  'Titanic Belfast',           null, '#003D82', '#FFD700', 'attractions', array['custom']::destination[], array['belfast'], 930),
('giants',   'Giant''s Causeway',         null, '#556B2F', '#F5D76E', 'sights',      array['custom']::destination[], array['belfast'], 931),
('gotour',   'Game of Thrones Tour',      null, '#1A1A2E', '#FFD700', 'excursions',  array['custom']::destination[], array['belfast'], 932),
('darkhed',  'Dark Hedges',               null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['belfast'], 933),
('belfcity', 'Belfast City Hall',         null, '#F5E6A8', '#5C1F00', 'sights',      array['custom']::destination[], array['belfast'], 934),

-- ============================================================================
-- BRIGHTON
-- ============================================================================
('brpier',   'Brighton Palace Pier',      null, '#FF69B4', '#FFD700', 'attractions', array['custom']::destination[], array['brighton'], 940),
('royalpav', 'Royal Pavilion',            null, '#C9A961', '#FFFFFF', 'attractions', array['custom']::destination[], array['brighton'], 941),
('brlanes',  'The Lanes',                 null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['brighton'], 942),
('brsea',    'Brighton Beach',            null, '#4A90D9', '#FFFFFF', 'sights',      array['custom']::destination[], array['brighton'], 943),
('i360',     'British Airways i360',      null, '#003D82', '#FFFFFF', 'attractions', array['custom']::destination[], array['brighton'], 944),

-- ============================================================================
-- STRATFORD & WARWICK
-- ============================================================================
('shakespr', 'Shakespeare''s Birthplace', null, '#8B6914', '#F5D76E', 'attractions', array['custom']::destination[], array['stratfm'], 950),
('rscspa',   'RSC Stratford',             null, '#8B0000', '#F5D76E', 'activities',  array['custom']::destination[], array['stratfm'], 951),
('warwcast', 'Warwick Castle',            null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['stratfm'], 952),
('kenilw',   'Kenilworth Castle',         null, '#8B6914', '#F5D76E', 'attractions', array['custom']::destination[], array['stratfm'], 953),
('annehath', 'Anne Hathaway''s Cottage',  null, '#8B6914', '#F5E6A8', 'sights',      array['custom']::destination[], array['stratfm'], 954);
;
