alter table public.parks
  add column opens_at text,
  add column closes_at text,
  add column hours_known boolean not null default false;

alter table public.parks
  add constraint parks_opens_at_hhmm_check
  check (opens_at is null or opens_at ~ '^\d{2}:\d{2}$');

alter table public.parks
  add constraint parks_closes_at_hhmm_check
  check (closes_at is null or closes_at ~ '^\d{2}:\d{2}$');
