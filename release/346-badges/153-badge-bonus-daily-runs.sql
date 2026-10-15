-- Badge-unlocked additional Dailies. Four optional unranked runs at 50/100/150/200
-- unique badges; always five starting spins. Never writes to official daily_runs
-- or awards badges, and never touches existing leaderboards or stats.
BEGIN;
CREATE TABLE public.crilo_bonus_spin_sessions
(LIKE public.crilo_spin_sessions INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE public.crilo_bonus_spin_sessions
 ADD COLUMN slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 4),
 ADD CONSTRAINT bonus_spin_session_pk PRIMARY KEY (id),
 ADD CONSTRAINT bonus_spin_session_uid_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
 ADD CONSTRAINT bonus_spin_session_unique_slot UNIQUE(user_id,daily_period,slot);
ALTER TABLE public.crilo_bonus_spin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_bonus_spin_sessions FROM PUBLIC,anon,authenticated;

CREATE TABLE public.crilo_bonus_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 daily_period date NOT NULL,
 slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 4),
 spin_session_id uuid NOT NULL UNIQUE REFERENCES public.crilo_bonus_spin_sessions(id),
 score bigint NOT NULL CHECK (score>=0),
 spins integer NOT NULL CHECK (spins BETWEEN 5 AND 500),
 upgrades integer NOT NULL, doubles integer NOT NULL, ducks integer NOT NULL,
 extra_spins integer NOT NULL,numbers_landed integer NOT NULL,
 best_roll_points bigint NOT NULL,results jsonb NOT NULL,drawing text,
 completed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,daily_period,slot)
);
CREATE INDEX bonus_runs_user_history ON public.crilo_bonus_runs(user_id,daily_period DESC,slot);
ALTER TABLE public.crilo_bonus_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_bonus_runs FROM PUBLIC,anon,authenticated;

-- Create isolated copies of the exact live server wheel algorithm and
-- restoration format. All official wheel functions remain unchanged.
DO $do$
DECLARE s text;
BEGIN
 SELECT pg_get_functiondef('public.crilo_server_spin(uuid)'::regprocedure) INTO s;
 s:=replace(s,'FUNCTION public.crilo_server_spin(','FUNCTION public.crilo_bonus_spin(');
 s:=replace(s,'public.crilo_spin_sessions','public.crilo_bonus_spin_sessions');
 EXECUTE s;
 SELECT pg_get_functiondef('public.crilo_get_server_spin_state(uuid)'::regprocedure) INTO s;
 s:=replace(s,'FUNCTION public.crilo_get_server_spin_state(','FUNCTION public.crilo_get_bonus_spin_state(');
 s:=replace(s,'public.crilo_spin_sessions','public.crilo_bonus_spin_sessions');
 EXECUTE s;
 SELECT pg_get_functiondef('public.crilo_begin_server_spin_session()'::regprocedure) INTO s;
 s:=replace(s,'FUNCTION public.crilo_begin_server_spin_session()','FUNCTION public.crilo_begin_bonus_spin_session(p_slot integer)');
 s:=replace(s,'public.crilo_spin_sessions','public.crilo_bonus_spin_sessions');
 s:=replace(s,'session_id uuid; period date;','session_id uuid; period date; earned integer;');
 s:=replace(s,
   'SELECT id INTO session_id FROM public.crilo_bonus_spin_sessions WHERE user_id=uid AND daily_period=period;',
   $part$
   IF p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 4 THEN
     RAISE EXCEPTION 'Invalid bonus slot' USING ERRCODE='22023'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.daily_runs d
     WHERE d.user_id=uid AND d.daily_period=period AND d.is_test=false
       AND d.verified_spin_session_id IS NOT NULL) THEN
     RAISE EXCEPTION 'Complete the official Daily before bonus runs'
       USING ERRCODE='23514'; END IF;
   SELECT count(DISTINCT ub.badge_id)::integer INTO earned
   FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
   WHERE ub.user_id=uid AND b.is_active=true AND b.is_earnable=true
     AND (ub.run_id IS NULL OR EXISTS(
       SELECT 1 FROM public.daily_runs d WHERE d.id=ub.run_id
         AND d.user_id=uid AND d.is_test=false));
   IF earned < p_slot*50 THEN
     RAISE EXCEPTION 'Not enough unique badges for this bonus run' USING ERRCODE='23514';END IF;
   SELECT id INTO session_id FROM public.crilo_bonus_spin_sessions
     WHERE user_id=uid AND daily_period=period AND slot=p_slot;
   $part$);
 s:=replace(s,'INSERT INTO public.crilo_bonus_spin_sessions(user_id,daily_period,segments)',
     'INSERT INTO public.crilo_bonus_spin_sessions(user_id,daily_period,slot,segments)');
 s:=replace(s,'VALUES(uid,period,','VALUES(uid,period,p_slot,');
 IF position('earned < p_slot*50' in s)=0 OR position('slot,segments' in s)=0 THEN
   RAISE EXCEPTION 'Bonus entry-point source did not match audited official function'; END IF;
 EXECUTE s;
END
$do$;

CREATE OR REPLACE FUNCTION public.crilo_bonus_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE u uuid:=auth.uid(); dp date:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 badges_earned int:=0; unlocked int:=0; daily_done boolean:=false; items jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 SELECT count(DISTINCT ub.badge_id)::int INTO badges_earned
 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
 WHERE ub.user_id=u AND b.is_active=true AND b.is_earnable=true
   AND (ub.run_id IS NULL OR EXISTS(
     SELECT 1 FROM public.daily_runs d WHERE d.id=ub.run_id AND d.user_id=u AND d.is_test=false));
 unlocked:=LEAST(4, badges_earned / 50);
 SELECT EXISTS(SELECT 1 FROM public.daily_runs d WHERE d.user_id=u AND d.daily_period=dp
  AND d.is_test=false AND d.verified_spin_session_id IS NOT NULL) INTO daily_done;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'slot',i.slot,'unlocked',i.slot<=unlocked,'score',r.score,'spins',r.spins,
  'saved',r.id IS NOT NULL,'started',s.id IS NOT NULL,
  'finished',s.finished_at IS NOT NULL,'session_id',s.id
 ) ORDER BY i.slot),'[]'::jsonb) INTO items
 FROM generate_series(1,4) AS i(slot)
 LEFT JOIN public.crilo_bonus_spin_sessions s
  ON s.user_id=u AND s.daily_period=dp AND s.slot=i.slot
 LEFT JOIN public.crilo_bonus_runs r
  ON r.user_id=u AND r.daily_period=dp AND r.slot=i.slot;
 RETURN jsonb_build_object('badge_count',badges_earned,'bonus_unlocked',unlocked,
  'total_runs',1+unlocked,'official_done',daily_done,
  'period',dp,'runs',items,'next_unlock',
  CASE WHEN unlocked>=4 THEN null ELSE (unlocked+1)*50 END);
END $$;

CREATE OR REPLACE FUNCTION public.crilo_save_bonus_run(p_session uuid,p_drawing text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE u uuid:=auth.uid(); s public.crilo_bonus_spin_sessions%ROWTYPE;
 existing public.crilo_bonus_runs%ROWTYPE; best bigint; saved_id uuid;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.crilo_bonus_spin_sessions
  WHERE id=p_session AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bonus run not found' USING ERRCODE='42501';END IF;
 SELECT * INTO existing FROM public.crilo_bonus_runs WHERE spin_session_id=s.id;
 IF FOUND THEN RETURN jsonb_build_object('status','already_saved','slot',existing.slot,
    'score',existing.score,'id',existing.id); END IF;
 IF s.finished_at IS NULL OR s.remaining_spins<>0 OR s.spin_count<5 OR
  jsonb_array_length(s.results)<>s.spin_count THEN
   RAISE EXCEPTION 'Bonus run not finished' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=u)
 OR EXISTS(SELECT 1 FROM public.crilo_daily_penalties p WHERE p.user_id=u AND p.daily_period=s.daily_period)
 THEN RAISE EXCEPTION 'Bonus Daily unavailable' USING ERRCODE='23514'; END IF;
 IF p_drawing IS NOT NULL AND
   (length(p_drawing)>1200000 OR p_drawing !~ '^data:image/(png|webp);base64,[A-Za-z0-9+/=]+$') THEN
   RAISE EXCEPTION 'Invalid bonus drawing' USING ERRCODE='23514';END IF;
 SELECT coalesce(max((x->>'points')::bigint),0) INTO best
 FROM jsonb_array_elements(s.results) AS x;
 INSERT INTO public.crilo_bonus_runs(user_id,daily_period,slot,spin_session_id,
  score,spins,upgrades,doubles,ducks,extra_spins,numbers_landed,
  best_roll_points,results,drawing)
 VALUES(u,s.daily_period,s.slot,s.id,s.score,s.spin_count,s.upgrades,
  s.doubles,s.ducks,s.extra_spins,s.numbers_landed,best,s.results,p_drawing)
 ON CONFLICT(user_id,daily_period,slot) DO NOTHING RETURNING id INTO saved_id;
 IF saved_id IS NULL THEN
  SELECT * INTO existing FROM public.crilo_bonus_runs
    WHERE user_id=u AND daily_period=s.daily_period AND slot=s.slot;
  RETURN jsonb_build_object('status','already_saved','slot',existing.slot,
    'score',existing.score,'id',existing.id);
 END IF;
 RETURN jsonb_build_object('status','saved','slot',s.slot,'score',s.score,'id',saved_id);
END $$;

REVOKE ALL ON FUNCTION public.crilo_begin_bonus_spin_session(integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_bonus_spin(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_get_bonus_spin_state(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_bonus_status() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.crilo_save_bonus_run(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_begin_bonus_spin_session(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_bonus_spin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_get_bonus_spin_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_bonus_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_save_bonus_run(uuid,text) TO authenticated;
COMMIT;