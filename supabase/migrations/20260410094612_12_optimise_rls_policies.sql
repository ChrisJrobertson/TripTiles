
-- Drop and recreate all RLS policies using (select auth.uid()) pattern
-- This prevents per-row re-evaluation of the auth function

-- profiles
drop policy if exists "Users can view their own profile" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Agency admins can view profiles in their agency" on profiles;

create policy "Profiles select own or agency"
  on profiles for select using (
    (select auth.uid()) = id
    or agency_id in (
      select p.agency_id from profiles p
      where p.id = (select auth.uid()) and p.tier = 'agent_admin'
    )
  );

create policy "Profiles update own"
  on profiles for update using ((select auth.uid()) = id);

-- agencies
drop policy if exists "Agency members can view their agency" on agencies;
drop policy if exists "Agency admins can update their agency" on agencies;

create policy "Agencies select for members"
  on agencies for select using (
    id in (select agency_id from profiles where id = (select auth.uid()))
  );

create policy "Agencies update for admins"
  on agencies for update using (
    id in (
      select agency_id from profiles
      where id = (select auth.uid()) and tier = 'agent_admin'
    )
  );

-- trips (consolidated into fewer policies)
drop policy if exists "Users can view their own trips" on trips;
drop policy if exists "Collaborators can view shared trips" on trips;
drop policy if exists "Agency members can view agency trips" on trips;
drop policy if exists "Anyone can view public trips" on trips;
drop policy if exists "Users can insert their own trips" on trips;
drop policy if exists "Users can update their own trips" on trips;
drop policy if exists "Editor collaborators can update shared trips" on trips;
drop policy if exists "Users can delete their own trips" on trips;

create policy "Trips select"
  on trips for select using (
    is_public = true
    or owner_id = (select auth.uid())
    or id in (
      select trip_id from trip_collaborators
      where user_id = (select auth.uid()) and status = 'accepted'
    )
    or (
      agency_id is not null and
      agency_id in (select agency_id from profiles where id = (select auth.uid()))
    )
  );

create policy "Trips insert own"
  on trips for insert with check (owner_id = (select auth.uid()));

create policy "Trips update own or editor"
  on trips for update using (
    owner_id = (select auth.uid())
    or id in (
      select trip_id from trip_collaborators
      where user_id = (select auth.uid()) and status = 'accepted' and role = 'editor'
    )
  );

create policy "Trips delete own"
  on trips for delete using (owner_id = (select auth.uid()));

-- trip_collaborators
drop policy if exists "Users can see collaborators on their own trips" on trip_collaborators;
drop policy if exists "Trip owners can add collaborators" on trip_collaborators;
drop policy if exists "Trip owners can remove collaborators" on trip_collaborators;

create policy "Collaborators select"
  on trip_collaborators for select using (
    user_id = (select auth.uid())
    or trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

create policy "Collaborators insert by owner"
  on trip_collaborators for insert with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

create policy "Collaborators delete by owner"
  on trip_collaborators for delete using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

-- purchases
drop policy if exists "Users can view their own purchases" on purchases;
create policy "Purchases select own"
  on purchases for select using (user_id = (select auth.uid()));

-- concierge_requests
drop policy if exists "Users can view their own concierge requests" on concierge_requests;
drop policy if exists "Users can create their own concierge requests" on concierge_requests;
create policy "Concierge select own"
  on concierge_requests for select using (user_id = (select auth.uid()));
create policy "Concierge insert own"
  on concierge_requests for insert with check (user_id = (select auth.uid()));

-- affiliate_clicks
drop policy if exists "Users can see their own clicks" on affiliate_clicks;
create policy "Affiliate clicks select own"
  on affiliate_clicks for select using (user_id = (select auth.uid()));

-- affiliate_conversions
drop policy if exists "Users can view their own affiliate conversions" on affiliate_conversions;
create policy "Affiliate conversions select own"
  on affiliate_conversions for select using (
    click_id in (select id from affiliate_clicks where user_id = (select auth.uid()))
  );

-- parks (consolidate three SELECT policies into one)
drop policy if exists "Everyone can view built-in parks" on parks;
drop policy if exists "Agency members can view their agency parks" on parks;
drop policy if exists "Users can view their own custom parks" on parks;
drop policy if exists "Users can insert custom parks" on parks;

create policy "Parks select"
  on parks for select using (
    (is_custom = false and agency_id is null)
    or created_by = (select auth.uid())
    or agency_id in (select agency_id from profiles where id = (select auth.uid()))
  );

create policy "Parks insert custom"
  on parks for insert with check (
    created_by = (select auth.uid()) and is_custom = true
  );

-- email_queue
drop policy if exists "Users can view their own email queue" on email_queue;
create policy "Email queue select own"
  on email_queue for select using (user_id = (select auth.uid()));

-- ai_generations
drop policy if exists "Users can view their own generations" on ai_generations;
create policy "AI generations select own"
  on ai_generations for select using (user_id = (select auth.uid()));
;
