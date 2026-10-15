-- Floating Mystery Curiosities: server-decided page-entry surprises.
-- One possible discovery per Daily period (22:00 UTC reset); 8% odds per
-- distinct page entry, with a 30-second server throttle. An unclaimed
-- appearance persists between Crilo pages until opened or the Daily resets.
-- All six curiosities use the existing private Mystery Collection.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crilo_mystery_page_spawns (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 daily_period date NOT NULL,
 last_try_at timestamptz,
 last_page text,
 spawn_id uuid,
 prize_key text CHECK (prize_key IN (
  'sleepy_duck','cosmic_quack','backwards_map','tiny_crown',
  'cloud_recipe','lost_button'
 )),
 claimed_at timestamptz,
 PRIMARY KEY(user_id,daily_period),
 CONSTRAINT crilo_mystery_page_spawn_state CHECK(
  (spawn_id IS NULL AND prize_key IS NULL AND claimed_at IS NULL) OR
  (spawn_id IS NOT NULL AND prize_key IS NOT NULL)
 )
);
ALTER TABLE public.crilo_mystery_page_spawns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_mystery_page_spawns FROM PUBLIC,anon,authenticated;

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
   -- Prefer an uncollected curiosity; once all six are found, reappearances
   -- remain possible but never award duplicates.
   SELECT v.key INTO chosen FROM pg_catalog.unnest(ARRAY[
    'sleepy_duck','cosmic_quack','backwards_map','tiny_crown',
    'cloud_recipe','lost_button']) AS v(key)
   WHERE NOT EXISTS(SELECT 1 FROM public.crilo_mystery_discoveries c
      WHERE c.user_id=uid AND c.prize_key=v.key)
   ORDER BY pg_catalog.random() LIMIT 1;
   IF chosen IS NULL THEN
    SELECT v.key INTO chosen FROM pg_catalog.unnest(ARRAY[
     'sleepy_duck','cosmic_quack','backwards_map','tiny_crown',
     'cloud_recipe','lost_button']) AS v(key)
    ORDER BY pg_catalog.random() LIMIT 1;
   END IF;
   UPDATE public.crilo_mystery_page_spawns
   SET spawn_id=gen_random_uuid(),prize_key=chosen
   WHERE user_id=uid AND daily_period=period;
   SELECT * INTO row_state FROM public.crilo_mystery_page_spawns
   WHERE user_id=uid AND daily_period=period;
  END IF;
 END IF;
 IF row_state.spawn_id IS NOT NULL AND row_state.claimed_at IS NULL THEN
  RETURN pg_catalog.jsonb_build_object(
   'state','ready','key',row_state.prize_key,'spawn_id',row_state.spawn_id
  );
 END IF;
 RETURN pg_catalog.jsonb_build_object('state','none');
END $fn$;
REVOKE ALL ON FUNCTION public.crilo_mystery_page_visit(text,text,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_mystery_page_visit(text,text,uuid)
 TO authenticated;
COMMENT ON FUNCTION public.crilo_mystery_page_visit(text,text,uuid) IS
'Rare account-only floating curiosity: 8% per eligible new page at most every 30s, at most one collectible per Daily; server issues and validates token on click; no score/badge/point changes';
COMMIT;