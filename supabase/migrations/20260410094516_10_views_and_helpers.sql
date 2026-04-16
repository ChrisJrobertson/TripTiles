
-- Effective tier: checks profile tier and active purchases
create or replace view user_effective_tier
with (security_invoker = true) as
  select
    p.id as user_id,
    case
      when p.tier = 'concierge' then 'concierge'
      when exists (
        select 1 from purchases
        where user_id = p.id and product = 'family' and status = 'completed'
      ) then 'family'
      when exists (
        select 1 from purchases
        where user_id = p.id and product = 'pro' and status = 'completed'
      ) then 'pro'
      when p.agency_id is not null then 'agent_staff'
      else 'free'
    end::user_tier as effective_tier
  from profiles p;

-- Lifetime affiliate revenue per user
create or replace view user_affiliate_revenue
with (security_invoker = true) as
  select
    ac.user_id,
    sum(conv.commission_gbp_pence) as total_commission_pence,
    count(conv.id) as conversion_count
  from affiliate_clicks ac
  join affiliate_conversions conv on conv.click_id = ac.id
  where conv.status = 'confirmed'
  group by ac.user_id;

-- Rate limit helper for AI generations
create or replace function ai_generations_last_24h(uid uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from ai_generations
  where user_id = uid
  and created_at > now() - interval '24 hours';
$$;
;
