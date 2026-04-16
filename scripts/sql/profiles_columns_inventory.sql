-- Run in Supabase SQL Editor (production or any environment): full profiles column list.
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;
