-- Hidden 2% chance per server-verified official spin, up to once per Daily.
-- Purely collectible: no bonus points, spins, changes to scores or ranks.
BEGIN;
ALTER TABLE public.crilo_mystery_gifts ADD COLUMN IF NOT EXISTS checked_spins
 integer NOT NULL DEFAULT 0 CHECK(checked_spins BETWEEN 0 AND 500);
-- Old surprise decisions must not be rerolled for previously recorded spins.
UPDATE public.crilo_mystery_gifts g
 SET checked_spins=LEAST(500,GREATEST(0,s.spin_count))
 FROM public.crilo_spin_sessions s
 WHERE g.user_id=s.user_id AND g.daily_period=s.daily_period AND g.checked_spins=0;
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
 v_checked integer:=0;
 v_spin_count integer;
 v_i integer;
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


 -- Only an actual official server-confirmed spin is eligible. Test and Bonus
 -- sessions use separate tables and cannot be made eligible from the client.
 SELECT s.spin_count INTO v_spin_count
 FROM public.crilo_spin_sessions s
 JOIN auth.users a ON a.id=s.user_id
 JOIN public.profiles p ON p.id=s.user_id
 WHERE s.user_id=v_user AND s.daily_period=v_period AND s.spin_count>0
   AND a.is_anonymous IS FALSE AND a.email_confirmed_at IS NOT NULL
   AND (a.banned_until IS NULL OR a.banned_until<=pg_catalog.clock_timestamp())
   AND NOT EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=v_user)
   AND NOT EXISTS(SELECT 1 FROM public.crilo_daily_penalties x
     WHERE x.user_id=v_user AND x.daily_period=v_period);
 IF v_spin_count IS NULL THEN
  RETURN pg_catalog.jsonb_build_object('eligible',false,'available',false,
    'spun',false,'period',v_period,'discovered',v_discovered);
 END IF;

 INSERT INTO public.crilo_mystery_gifts(user_id,daily_period,event_available,checked_spins)
 VALUES(v_user,v_period,false,0)
 ON CONFLICT (user_id,daily_period) DO NOTHING;

 SELECT g.event_available,g.spun_at,g.landed_slice,g.prize_key,g.checked_spins
 INTO v_available,v_spun,v_slice,v_prize,v_checked
 FROM public.crilo_mystery_gifts g
 WHERE g.user_id=v_user AND g.daily_period=v_period FOR UPDATE;

 -- Consume each NEW official spin once, regardless of how often status is
 -- requested, across multiple devices or after a network disconnect.
 IF NOT v_available AND v_spun IS NULL AND v_checked<v_spin_count THEN
  FOR v_i IN (v_checked+1)..v_spin_count LOOP
   IF pg_catalog.random()<0.02 THEN
    v_available:=true;EXIT;
   END IF;
  END LOOP;
 END IF;
 IF v_checked<v_spin_count THEN
  UPDATE public.crilo_mystery_gifts
   SET checked_spins=v_spin_count,event_available=v_available
   WHERE user_id=v_user AND daily_period=v_period;
 END IF;

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
