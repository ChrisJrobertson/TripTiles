-- Planner calendar: soft pastel fills for Orlando + UK major parks (logged-in planner only).
-- Product copy / hex pairs: TripTiles planner calendar pastel spec (May 2026).
-- Canonical park ids: `20260410133901_13_seed_parks_data.sql`, `20260410161139_20_seed_parks_uk_germany_spain_netherlands.sql`.
--
-- Pre-flight (expected 22 built-in rows touched): Orlando Disney/Universal/SeaWorld/Legoland Florida + UK majors below.
-- Peppa Pig Florida is not a separate row in this catalogue (UK Paultons covers Peppa branding).

-- Orlando — Walt Disney World
update public.parks set bg_colour = '#F5DCEC', fg_colour = '#0B1E5C' where id = 'mk';
update public.parks set bg_colour = '#DCE9F5', fg_colour = '#0B1E5C' where id = 'ep';
update public.parks set bg_colour = '#F5DDD0', fg_colour = '#0B1E5C' where id = 'hs';
update public.parks set bg_colour = '#D9E8D5', fg_colour = '#0B1E5C' where id = 'ak';
update public.parks set bg_colour = '#D5E8E2', fg_colour = '#0B1E5C' where id = 'ds';
update public.parks set bg_colour = '#CFE3EC', fg_colour = '#0B1E5C' where id = 'tl';
update public.parks set bg_colour = '#DDEAF0', fg_colour = '#0B1E5C' where id = 'bb';

-- Orlando — Universal
update public.parks set bg_colour = '#F5EDCC', fg_colour = '#0B1E5C' where id = 'us';
update public.parks set bg_colour = '#F5DDC4', fg_colour = '#0B1E5C' where id = 'ioa';
update public.parks set bg_colour = '#E4DCEC', fg_colour = '#0B1E5C' where id = 'eu';
update public.parks set bg_colour = '#CFE8E4', fg_colour = '#0B1E5C' where id = 'vb';

-- Orlando — SeaWorld / Busch / others
update public.parks set bg_colour = '#D0E5E8', fg_colour = '#0B1E5C' where id = 'sw';
update public.parks set bg_colour = '#E5DFCB', fg_colour = '#0B1E5C' where id = 'bg';
update public.parks set bg_colour = '#D6EAEE', fg_colour = '#0B1E5C' where id = 'aq';
update public.parks set bg_colour = '#D9E6E4', fg_colour = '#0B1E5C' where id = 'dc';
update public.parks set bg_colour = '#F5EBD0', fg_colour = '#0B1E5C' where id = 'll';

-- UK major parks
update public.parks set bg_colour = '#EBD9E2', fg_colour = '#0B1E5C' where id = 'alton';
update public.parks set bg_colour = '#D8E2EE', fg_colour = '#0B1E5C' where id = 'thorpe';
update public.parks set bg_colour = '#E0E8D5', fg_colour = '#0B1E5C' where id = 'chess';
update public.parks set bg_colour = '#F5EBD0', fg_colour = '#0B1E5C' where id = 'legoukw';
update public.parks set bg_colour = '#EBE0D5', fg_colour = '#0B1E5C' where id = 'paultons';
update public.parks set bg_colour = '#E6DCE8', fg_colour = '#0B1E5C' where id = 'bppb';

-- Verification (non-null planner pastels for targeted ids):
-- select id, name, bg_colour, fg_colour from public.parks where id in (
--   'mk','ep','hs','ak','ds','tl','bb','us','ioa','eu','vb','sw','bg','aq','dc','ll',
--   'alton','thorpe','chess','legoukw','paultons','bppb'
-- ) order by name;
