
alter table achievement_definitions enable row level security;

create policy "Anyone can read achievement definitions"
  on achievement_definitions for select using (true);
;
