-- Preserve Mystery Collection history outside the current Daily period.
-- No extra attempts: the 25% event still requires a verified official Daily.
BEGIN;
create or replace function public.crilo_mystery_gift(p_action text default 'status')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_user uuid := auth.uid();
 v_period date := ((now() at time zone 'UTC') - interval '22 hours')::date;
 v_available boolean;
 v_spun timestamptz;
 v_slice smallint;
 v_prize text;
 v_discovered jsonb;
begin
 if v_user is null then raise exception 'Sign in to discover Mystery Gifts' using errcode='28000'; end if;
 if p_action is null or p_action not in ('status','spin') then
  raise exception 'Invalid Mystery Gift action' using errcode='22023';
 end if;
 -- History belongs to the account, not today's eligibility. The shelf
 -- must remain available even before the player completes today's Daily.
 select coalesce(pg_catalog.jsonb_agg(c.prize_key order by c.first_found),'[]'::jsonb)
 into v_discovered
 from public.crilo_mystery_discoveries c where c.user_id=v_user;

 -- Private owner Test Runs do not exist in this table; legacy is_test rows,
 -- unverified records, and blocked/removed official Dailies do not qualify.
 if not exists (
  select 1 from public.daily_runs d
  where d.user_id=v_user and d.daily_period=v_period
   and d.is_test=false and d.verified_spin_session_id is not null
 ) then
  return pg_catalog.jsonb_build_object(
   'eligible',false,'available',false,'spun',false,
   'period',v_period,'discovered',v_discovered);
 end if;

 -- One row per account per Daily period, even after refreshing or using
 -- several devices. Insert conflicts serialize; row locking prevents rerolls.
 insert into public.crilo_mystery_gifts(user_id,daily_period,event_available)
 values (v_user,v_period,pg_catalog.random()<0.25)
 on conflict (user_id,daily_period) do nothing;

 select g.event_available,g.spun_at,g.landed_slice,g.prize_key
 into v_available,v_spun,v_slice,v_prize
 from public.crilo_mystery_gifts g
 where g.user_id=v_user and g.daily_period=v_period for update;

 if p_action='spin' and v_available and v_spun is null then
  v_slice := pg_catalog.floor(pg_catalog.random()*8)::smallint;
  if v_slice % 2 = 0 then
   -- Prefer something not yet discovered, so this remains a meaningful
   -- collection without making it impossible to finish.
   select s.key into v_prize from
    pg_catalog.unnest(array[
      'sleepy_duck','cosmic_quack','backwards_map',
      'tiny_crown','cloud_recipe','lost_button'
    ]) as s(key)
   where not exists (
    select 1 from public.crilo_mystery_discoveries c
    where c.user_id=v_user and c.prize_key=s.key
   )
   order by pg_catalog.random() limit 1;
   if v_prize is null then
    select s.key into v_prize from pg_catalog.unnest(array[
      'sleepy_duck','cosmic_quack','backwards_map',
      'tiny_crown','cloud_recipe','lost_button'
    ]) as s(key) order by pg_catalog.random() limit 1;
   end if;
   insert into public.crilo_mystery_discoveries(user_id,prize_key)
   values (v_user,v_prize) on conflict do nothing;
  end if;
  update public.crilo_mystery_gifts
  set spun_at=now(),landed_slice=v_slice,prize_key=v_prize
  where user_id=v_user and daily_period=v_period;
  v_spun := now();
 end if;

 select coalesce(pg_catalog.jsonb_agg(c.prize_key order by c.first_found),'[]'::jsonb)
 into v_discovered
 from public.crilo_mystery_discoveries c where c.user_id=v_user;
 return pg_catalog.jsonb_build_object(
  'eligible',true,'available',v_available,
  'spun',v_spun is not null,
  'slice',v_slice,'prize',v_prize,
  'period',v_period,'discovered',v_discovered);
end;
$$;

REVOKE ALL ON FUNCTION public.crilo_mystery_gift(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_mystery_gift(text) TO authenticated;
COMMIT;
