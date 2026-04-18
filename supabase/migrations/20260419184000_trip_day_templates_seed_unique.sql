create unique index if not exists trip_day_templates_user_seed_name_unique
  on public.trip_day_templates (user_id, name)
  where (is_seed = true);
