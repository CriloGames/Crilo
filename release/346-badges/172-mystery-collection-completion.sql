-- Collection complete at six: suppress further awards from BOTH RPCs.
-- Serialize final awards across concurrent browsers; preserve old records.
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
 v_checked integer:=0;
 v_spin_count integer;
 v_i integer;
begin
 if v_user is null then raise exception 'Sign in to discover Mystery Gifts' using errcode='28000'; end if;
 if p_action is null or p_action not in ('status','spin') then
  raise exception 'Invalid Mystery Gift action' using errcode='22023';
 end if;
 -- Serialize collection awards across the wheel and floating discoveries.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_user::text,20261015::bigint));
 -- History belongs to the account, not today's eligibility. The shelf
 -- must remain available even before the player completes today's Daily.
 select coalesce(pg_catalog.jsonb_agg(c.prize_key order by c.first_found),'[]'::jsonb)
 into v_discovered
 from public.crilo_mystery_discoveries c where c.user_id=v_user;
 IF pg_catalog.jsonb_array_length(v_discovered)>=6 THEN
  RETURN pg_catalog.jsonb_build_object('eligible',false,'available',false,
   'spun',false,'period',v_period,'discovered',v_discovered,
   'collection_complete',true);
 END IF;
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
   IF v_prize IS NOT NULL THEN
    insert into public.crilo_mystery_discoveries(user_id,prize_key)
    values (v_user,v_prize) on conflict do nothing;
   END IF;
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
  'period',v_period,'discovered',v_discovered,
  'collection_complete',pg_catalog.jsonb_array_length(v_discovered)>=6);
end;
$$;

REVOKE ALL ON FUNCTION public.crilo_mystery_gift(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_mystery_gift(text) TO authenticated;
COMMIT;

REVOKE ALL ON FUNCTION public.crilo_mystery_gift(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_mystery_gift(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.crilo_mystery_page_visit(
 p_action text DEFAULT 'enter', p_page text DEFAULT 'index.html',
 p_spawn_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
 uid uuid := auth.uid();
 period date := ((pg_catalog.clock_timestamp() AT TIME ZONE 'UTC') - interval '22 hours')::date;
 row_state public.crilo_mystery_page_spawns%ROWTYPE;
 chosen text;
 inserted integer := 0;
 total integer := 0;
BEGIN
 IF uid IS NULL OR auth.role()<>'authenticated' THEN
  RAISE EXCEPTION 'Sign in to find curiosities' USING ERRCODE='42501';
 END IF;
 IF p_action NOT IN ('enter','claim') OR p_action IS NULL THEN
  RAISE EXCEPTION 'Invalid curiosity action' USING ERRCODE='22023';
 END IF;
 IF p_action='enter' AND (
  p_page IS NULL OR length(p_page)>60 OR
  p_page !~ '^[a-z0-9-]+[.]html$'
 ) THEN
  RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM auth.users a JOIN public.profiles p ON p.id=a.id
  WHERE a.id=uid AND a.is_anonymous=false AND a.email IS NOT NULL
   AND a.email_confirmed_at IS NOT NULL
   AND (a.banned_until IS NULL OR a.banned_until<=pg_catalog.clock_timestamp())
   AND NOT EXISTS(SELECT 1 FROM public.crilo_banned_accounts b
     WHERE b.user_id=uid)
   AND NOT EXISTS(SELECT 1 FROM public.crilo_daily_penalties d
     WHERE d.user_id=uid AND d.daily_period=period)
 ) THEN
  RAISE EXCEPTION 'Curiosities require an active confirmed account'
   USING ERRCODE='42501';
 END IF;
 -- Share the same transaction lock as the mystery wheel.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(uid::text,20261015::bigint));
 SELECT count(*)::integer INTO total
 FROM public.crilo_mystery_discoveries WHERE user_id=uid;
 -- Six out of six means no further sightings or gifts.
 IF total>=6 AND p_action='enter' THEN
  RETURN pg_catalog.jsonb_build_object('state','complete','discovered_count',total);
 END IF;
 -- Serialize page checks across multiple browser tabs and refreshes.
 INSERT INTO public.crilo_mystery_page_spawns(user_id,daily_period)
 VALUES(uid,period) ON CONFLICT(user_id,daily_period) DO NOTHING;
 SELECT * INTO row_state FROM public.crilo_mystery_page_spawns
 WHERE user_id=uid AND daily_period=period FOR UPDATE;
 IF p_action='claim' THEN
  IF p_spawn_id IS NULL OR row_state.spawn_id IS DISTINCT FROM p_spawn_id
    OR row_state.prize_key IS NULL THEN
   RAISE EXCEPTION 'That curiosity is no longer available'
    USING ERRCODE='42501';
  END IF;
  IF total>=6 AND row_state.claimed_at IS NULL THEN
   RETURN pg_catalog.jsonb_build_object('state','complete','discovered_count',total);
  END IF;
  IF row_state.claimed_at IS NULL THEN
   INSERT INTO public.crilo_mystery_discoveries(user_id,prize_key)
   VALUES(uid,row_state.prize_key) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT;
   UPDATE public.crilo_mystery_page_spawns SET claimed_at=pg_catalog.clock_timestamp()
   WHERE user_id=uid AND daily_period=period;
  END IF;
  SELECT count(*)::integer INTO total FROM public.crilo_mystery_discoveries
  WHERE user_id=uid;
  RETURN pg_catalog.jsonb_build_object(
   'state','collected','key',row_state.prize_key,
   'new_discovery',inserted>0,'discovered_count',total
  );
 END IF;
 IF row_state.claimed_at IS NOT NULL THEN
  RETURN pg_catalog.jsonb_build_object('state','done');
 END IF;
 IF row_state.spawn_id IS NULL AND
  (row_state.last_try_at IS NULL OR row_state.last_try_at<=
    pg_catalog.clock_timestamp()-INTERVAL '30 seconds') AND
  (row_state.last_page IS NULL OR row_state.last_page<>p_page) THEN
  UPDATE public.crilo_mystery_page_spawns
   SET last_try_at=pg_catalog.clock_timestamp(),last_page=p_page
   WHERE user_id=uid AND daily_period=period;
  IF pg_catalog.random()<0.08 THEN
   -- Select only a genuinely undiscovered item.
   SELECT v.key INTO chosen FROM pg_catalog.unnest(ARRAY[
    'sleepy_duck','cosmic_quack','backwards_map','tiny_crown',
    'cloud_recipe','lost_button']) AS v(key)
   WHERE NOT EXISTS(SELECT 1 FROM public.crilo_mystery_discoveries c
      WHERE c.user_id=uid AND c.prize_key=v.key)
   ORDER BY pg_catalog.random() LIMIT 1;
   IF chosen IS NOT NULL THEN
    UPDATE public.crilo_mystery_page_spawns
    SET spawn_id=gen_random_uuid(),prize_key=chosen
    WHERE user_id=uid AND daily_period=period;
    SELECT * INTO row_state FROM public.crilo_mystery_page_spawns
    WHERE user_id=uid AND daily_period=period;
   END IF;
  END IF;
 END IF;
 IF row_state.spawn_id IS NOT NULL AND row_state.claimed_at IS NULL THEN
  RETURN pg_catalog.jsonb_build_object(
   'state','ready','key',row_state.prize_key,'spawn_id',row_state.spawn_id
  );
 END IF;
 RETURN pg_catalog.jsonb_build_object('state','none');
END $fn$;
REVOKE ALL ON FUNCTION public.crilo_mystery_page_visit(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_mystery_page_visit(text,text,uuid) TO authenticated;
COMMIT;