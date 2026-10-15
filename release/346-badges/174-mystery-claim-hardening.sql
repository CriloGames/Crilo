-- Harden completed Mystery Collection against old claim-token replays.
-- No data or prior awards are changed.
BEGIN;
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
  -- Full collections reject even an old, previously claimed token. A
  -- successful sixth claim still returns 'collected' from its initial call.
  IF total>=6 THEN
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