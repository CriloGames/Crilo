-- Weekly Lucky Seven: one isolated 7-spin wheel per verified account/week.
-- Weeks reset Mondays 22:00 UTC, matching Crilo's 22:00 UTC Daily clock.
-- Requires completion of the current Official Daily to START a new weekly run.
-- Server wheel RNG, logged immutable spins; no official/bonus records mutated.
BEGIN;
CREATE TABLE public.crilo_weekly_spin_sessions
 (LIKE public.crilo_spin_sessions INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE public.crilo_weekly_spin_sessions
 ALTER COLUMN remaining_spins SET DEFAULT 7,
 ADD CONSTRAINT crilo_weekly_spin_session_pk PRIMARY KEY(id),
 ADD CONSTRAINT crilo_weekly_spin_session_user_fk FOREIGN KEY(user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE,
 ADD CONSTRAINT crilo_weekly_one_session_per_week UNIQUE(user_id,daily_period);
ALTER TABLE public.crilo_weekly_spin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_weekly_spin_sessions FROM PUBLIC,anon,authenticated;
CREATE TABLE public.crilo_weekly_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 week_period date NOT NULL,
 spin_session_id uuid NOT NULL UNIQUE REFERENCES public.crilo_weekly_spin_sessions(id),
 score bigint NOT NULL CHECK(score>=0),
 spins integer NOT NULL CHECK(spins BETWEEN 7 AND 500),
 upgrades integer NOT NULL DEFAULT 0,
 doubles integer NOT NULL DEFAULT 0,
 ducks integer NOT NULL DEFAULT 0,
 extra_spins integer NOT NULL DEFAULT 0,
 results jsonb NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,week_period)
);
CREATE INDEX crilo_weekly_run_scores ON public.crilo_weekly_runs(week_period,score DESC);
ALTER TABLE public.crilo_weekly_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_weekly_runs FROM PUBLIC,anon,authenticated;

-- Reuse the audited official wheel and only change session storage and
-- weekly eligibility/deadline. No user-controlled outcome or bonus RNG.
DO $build$
DECLARE source text;
BEGIN
 SELECT pg_get_functiondef('public.crilo_server_spin(uuid)'::regprocedure) INTO source;
 source:=replace(source,'FUNCTION public.crilo_server_spin(','FUNCTION public.crilo_weekly_spin(');
 source:=replace(source,'public.crilo_spin_sessions','public.crilo_weekly_spin_sessions');
 source:=replace(source,'s.daily_period=period','s.daily_period=period');
 -- Remove Daily period cutoff and replace with a strict weekly deadline.
 source:=regexp_replace(source,
  ' -- A run already in progress can finish for 30 minutes after its 22:00 UTC[\s\S]*? END IF;\s*n:=jsonb_array_length',
  $cut$
 IF s.daily_period IS DISTINCT FROM date_trunc('week',
    (clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date
 THEN
  RAISE EXCEPTION 'Weekly round closed. Come back for the next Lucky Seven.'
   USING ERRCODE='23514';
 END IF;
 n:=jsonb_array_length$cut$);
 source:=replace(source,'x.daily_period=s.daily_period',
  $day$ x.daily_period=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date$day$);
 IF position('crilo_weekly_spin_sessions' in source)=0 OR
  position('Weekly round closed' in source)=0 THEN
  RAISE EXCEPTION 'Weekly spin clone failed safety check';
 END IF;
 EXECUTE source;

 SELECT pg_get_functiondef('public.crilo_get_server_spin_state(uuid)'::regprocedure) INTO source;
 source:=replace(source,'FUNCTION public.crilo_get_server_spin_state(','FUNCTION public.crilo_weekly_state(');
 source:=replace(source,'public.crilo_spin_sessions','public.crilo_weekly_spin_sessions');
 EXECUTE source;

 SELECT pg_get_functiondef('public.crilo_begin_server_spin_session()'::regprocedure) INTO source;
 source:=replace(source,'FUNCTION public.crilo_begin_server_spin_session()',
   'FUNCTION public.crilo_weekly_begin_session()');
 source:=replace(source,'public.crilo_spin_sessions','public.crilo_weekly_spin_sessions');
 source:=replace(source,
  $day$period:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;$day$,
  $week$period:=date_trunc('week',
      (clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;$week$);
 source:=replace(source,
  'x.daily_period=period',
  $day$x.daily_period=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date$day$);
 -- Resuming a started run in the same week never demands another Daily.
 source:=replace(source,
  'IF session_id IS NOT NULL THEN RETURN session_id;END IF;',
  $elig$
 IF session_id IS NOT NULL THEN RETURN session_id;END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.daily_runs d WHERE d.user_id=uid
   AND d.daily_period=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date
   AND d.is_test=false AND d.verified_spin_session_id IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Complete today''s Official Daily to unlock Lucky Seven'
   USING ERRCODE='23514';
 END IF;$elig$);
 IF position('Complete today' in source)=0 OR
    position('crilo_weekly_spin_sessions' in source)=0 OR
    position('date_trunc(' in source)=0 THEN
  RAISE EXCEPTION 'Weekly session clone failed safety check';
 END IF;
 EXECUTE source;
END
$build$;

CREATE OR REPLACE FUNCTION public.crilo_weekly_save(p_session uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE
 u uuid:=auth.uid();
 s public.crilo_weekly_spin_sessions%ROWTYPE;
 existing public.crilo_weekly_runs%ROWTYPE;
 result_id uuid;
 current_week date:=date_trunc('week',
     (clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
BEGIN
 IF u IS NULL OR auth.role()<>'authenticated' THEN
  RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.crilo_weekly_spin_sessions
 WHERE id=p_session AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Weekly session not found' USING ERRCODE='42501';END IF;
 IF s.daily_period IS DISTINCT FROM current_week THEN
  RAISE EXCEPTION 'The weekly event is over' USING ERRCODE='23514';END IF;
 SELECT * INTO existing FROM public.crilo_weekly_runs WHERE spin_session_id=s.id;
 IF FOUND THEN RETURN jsonb_build_object('status','already_saved','score',existing.score);END IF;
 IF s.finished_at IS NULL OR s.remaining_spins<>0 OR s.spin_count<7 OR
  s.spin_count>500 OR jsonb_array_length(s.results)<>s.spin_count THEN
  RAISE EXCEPTION 'Complete your weekly wheel first' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=u) OR
 EXISTS(SELECT 1 FROM public.crilo_daily_penalties p
  WHERE p.user_id=u AND p.daily_period=
   ((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date)
 THEN RAISE EXCEPTION 'Weekly round unavailable' USING ERRCODE='23514';END IF;
 INSERT INTO public.crilo_weekly_runs(user_id,week_period,spin_session_id,
 score,spins,upgrades,doubles,ducks,extra_spins,results)
 VALUES(u,s.daily_period,s.id,s.score,s.spin_count,
  s.upgrades,s.doubles,s.ducks,s.extra_spins,s.results)
 ON CONFLICT(user_id,week_period) DO NOTHING
 RETURNING id INTO result_id;
 IF result_id IS NULL THEN
  SELECT score INTO existing.score FROM public.crilo_weekly_runs
   WHERE user_id=u AND week_period=s.daily_period;
  RETURN jsonb_build_object('status','already_saved','score',existing.score);
 END IF;
 RETURN jsonb_build_object('status','saved','score',s.score,'spins',s.spin_count,
  'ribbon','Lucky Seven','week_period',s.daily_period);
END $func$;

CREATE OR REPLACE FUNCTION public.crilo_weekly_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE
 u uuid:=auth.uid();
 w date:=date_trunc('week',(
    clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 dp date:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 s public.crilo_weekly_spin_sessions%ROWTYPE;
 r public.crilo_weekly_runs%ROWTYPE;
 ribbons integer:=0;
 ready boolean:=false;
BEGIN
 IF u IS NULL OR auth.role()<>'authenticated' THEN
  RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.crilo_weekly_spin_sessions
  WHERE user_id=u AND daily_period=w;
 SELECT * INTO r FROM public.crilo_weekly_runs
  WHERE user_id=u AND week_period=w;
 SELECT count(*) INTO ribbons FROM public.crilo_weekly_runs
  WHERE user_id=u;
 SELECT EXISTS(SELECT 1 FROM public.daily_runs d
  WHERE d.user_id=u AND d.daily_period=dp AND d.is_test=false
  AND d.verified_spin_session_id IS NOT NULL) INTO ready;
 RETURN jsonb_build_object('week_period',w,'ends_at',
  (((w+7)::timestamp AT TIME ZONE 'UTC')+interval '22 hours'),
  'can_start',ready,'started',s.id IS NOT NULL,
  'session_id',s.id,'finished',r.id IS NOT NULL,
  'save_pending',s.finished_at IS NOT NULL AND r.id IS NULL,
  'score',coalesce(r.score,s.score,0),'spins',coalesce(r.spins,s.spin_count,0),
  'ribbons',ribbons,'mode','Lucky Seven','starting_spins',7);
END $func$;

CREATE OR REPLACE FUNCTION public.crilo_weekly_leaders(p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid,username text,name_color text,
 score bigint,spins integer,ducks integer,completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $func$
 SELECT r.user_id,p.username,p.name_color,r.score,r.spins,r.ducks,r.completed_at
 FROM public.crilo_weekly_runs r
 JOIN public.profiles p ON p.id=r.user_id
 WHERE r.week_period=date_trunc('week',
  (now() AT TIME ZONE 'UTC')-interval '22 hours')::date
  AND NOT EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=r.user_id)
 ORDER BY r.score DESC,r.completed_at ASC,r.user_id
 LIMIT least(greatest(coalesce(p_limit,50),1),100)
$func$;
REVOKE ALL ON FUNCTION public.crilo_weekly_begin_session() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_weekly_spin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_weekly_state(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_weekly_save(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_weekly_status() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_weekly_leaders(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crilo_weekly_begin_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_weekly_spin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_weekly_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_weekly_save(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_weekly_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_weekly_leaders(integer) TO anon,authenticated;
COMMIT;