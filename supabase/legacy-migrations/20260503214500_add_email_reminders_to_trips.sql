-- Production drift: code inserts trips.email_reminders but some databases never ran 20260413120000.

alter table public.trips
  add column if not exists email_reminders boolean not null default true;

comment on column public.trips.email_reminders is
  'When true, lifecycle and milestone reminder emails may be sent for this trip.';
