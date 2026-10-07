alter table public.regions
  add column has_disney boolean not null default false,
  add column has_universal boolean not null default false,
  add column data_quality_tier text not null default 'light'
    check (data_quality_tier in ('deep', 'standard', 'light'));
