
alter table purchases enable row level security;
alter table concierge_requests enable row level security;
alter table affiliate_clicks enable row level security;
alter table affiliate_conversions enable row level security;
alter table parks enable row level security;
alter table email_queue enable row level security;
alter table ai_generations enable row level security;

create policy "Users can view their own purchases"
  on purchases for select using (user_id = auth.uid());

create policy "Users can view their own concierge requests"
  on concierge_requests for select using (user_id = auth.uid());

create policy "Users can create their own concierge requests"
  on concierge_requests for insert with check (user_id = auth.uid());

create policy "Users can see their own clicks"
  on affiliate_clicks for select using (user_id = auth.uid());

create policy "Anyone can insert affiliate clicks"
  on affiliate_clicks for insert with check (true);

create policy "Everyone can view built-in parks"
  on parks for select using (is_custom = false and agency_id is null);

create policy "Agency members can view their agency parks"
  on parks for select using (
    agency_id in (select agency_id from profiles where id = auth.uid())
  );

create policy "Users can view their own custom parks"
  on parks for select using (created_by = auth.uid());

create policy "Users can insert custom parks"
  on parks for insert with check (
    created_by = auth.uid() and is_custom = true
  );

create policy "Users can view their own generations"
  on ai_generations for select using (user_id = auth.uid());

create policy "Users can view their own email queue"
  on email_queue for select using (user_id = auth.uid());

create policy "Users can view their own affiliate conversions"
  on affiliate_conversions for select using (
    click_id in (select id from affiliate_clicks where user_id = auth.uid())
  );
;
