-- Run in Supabase SQL Editor: NOT NULL columns on public.profiles with no default.
-- (column_default is null means the table definition does not set DEFAULT / identity.)

select
  column_name,
  data_type,
  udt_name,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and is_nullable = 'NO'
  and column_default is null
order by ordinal_position;
