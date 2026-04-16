-- Planner weather labels + settings: column was defined in 20260412120000 but some
-- environments never received that migration. Idempotent add.

alter table public.profiles
  add column if not exists temperature_unit text not null default 'c';

alter table public.profiles
  drop constraint if exists profiles_temperature_unit_check;

alter table public.profiles
  add constraint profiles_temperature_unit_check
  check (temperature_unit in ('c', 'f'));
