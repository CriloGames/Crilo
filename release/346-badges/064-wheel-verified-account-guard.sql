-- Reject unverified email or anonymous auth accounts, suspended Auth users,
-- and sessions without a valid profile. This closes a potential unlimited
-- anonymous-account Daily leaderboard farming path.
-- Existing confirmed email/magic-link players and owner Test Runs are unaffected.
CREATE OR REPLACE FUNCTION public.crilo_begin_server_spin_session()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); session_id uuid; period date;
BEGIN
 IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated player required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(
    SELECT 1 FROM auth.users au
    JOIN public.profiles pr ON pr.id=au.id
    WHERE au.id=auth.uid()
      AND au.is_anonymous IS FALSE
      AND au.email IS NOT NULL
      AND au.email_confirmed_at IS NOT NULL
      AND (au.banned_until IS NULL OR au.banned_until<=clock_timestamp())
 ) THEN
   RAISE EXCEPTION 'A verified, active Crilo account is required'
    USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=uid) THEN RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';END IF;
 period:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,442204));
 IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties x WHERE x.user_id=uid AND x.daily_period=period) THEN RAISE EXCEPTION 'Daily locked after drawing removal' USING ERRCODE='23514';END IF;
 SELECT id INTO session_id FROM public.crilo_spin_sessions WHERE user_id=uid AND daily_period=period;
 IF session_id IS NOT NULL THEN RETURN session_id;END IF;
 INSERT INTO public.crilo_spin_sessions(user_id,daily_period,segments)
 VALUES(uid,period,'[{"type":"num","base":2},{"type":"duck"},{"type":"num","base":1},{"type":"upgrade"},{"type":"num","base":3},{"type":"num","base":1},{"type":"spins"},{"type":"num","base":5},{"type":"duck"},{"type":"num","base":2},{"type":"double"},{"type":"num","base":1}]'::jsonb)
 RETURNING id INTO session_id;
 RETURN session_id;
END $function$;

CREATE OR REPLACE FUNCTION public.crilo_server_spin(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.crilo_spin_sessions%ROWTYPE;
 n integer; pick integer; outcome jsonb; typ text; base integer; points bigint:=0; i integer; additions integer;
 new_segments jsonb; rec jsonb; p numeric;
 choice_bases integer[]:=ARRAY[1,1,2,2,3,3,5,5,8,10];
BEGIN
 IF auth.uid() IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(
    SELECT 1 FROM auth.users au
    JOIN public.profiles pr ON pr.id=au.id
    WHERE au.id=auth.uid()
      AND au.is_anonymous IS FALSE
      AND au.email IS NOT NULL
      AND au.email_confirmed_at IS NOT NULL
      AND (au.banned_until IS NULL OR au.banned_until<=clock_timestamp())
 ) THEN
   RAISE EXCEPTION 'A verified, active Crilo account is required'
    USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.crilo_spin_sessions WHERE id=p_session AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties x WHERE x.user_id=s.user_id AND x.daily_period=s.daily_period) THEN RAISE EXCEPTION 'Daily locked after drawing removal' USING ERRCODE='23514';END IF;
 IF s.finished_at IS NOT NULL OR s.remaining_spins<=0 OR s.spin_count>=500 OR s.daily_period<>((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date
 THEN RAISE EXCEPTION 'Spin session expired or finished' USING ERRCODE='23514';END IF;
 n:=jsonb_array_length(s.segments);
 pick:=public.crilo_secure_random_index(n);
 outcome:=s.segments->pick;
 typ:=outcome->>'type';
 base:=NULLIF(outcome->>'base','')::integer;
 p:=(SELECT count(*)::numeric/n FROM jsonb_array_elements(s.segments) e WHERE
 (CASE WHEN typ='num' THEN e->>'type'='num' AND (e->>'base')::integer=base ELSE e->>'type'=typ END));
 s.remaining_spins:=s.remaining_spins-1;
 s.spin_count:=s.spin_count+1;
 IF typ='num' THEN
   points:=base*s.multiplier;
   s.score:=s.score+points;
   s.numbers_landed:=s.numbers_landed+1;
 ELSIF typ='double' THEN
   points:=s.score;
   s.score:=s.score*2;
   s.doubles:=s.doubles+1;
   s.remaining_spins:=s.remaining_spins+1;
 ELSIF typ='duck' THEN
   s.ducks:=s.ducks+1;
   s.remaining_spins:=s.remaining_spins+1;
 ELSIF typ='spins' THEN
   s.extra_spins:=s.extra_spins+2;
   s.remaining_spins:=s.remaining_spins+2;
 ELSIF typ='upgrade' THEN
   s.upgrades:=s.upgrades+1;
   s.multiplier:=s.multiplier*3;
   s.remaining_spins:=s.remaining_spins+1;
   additions:=4+LEAST(s.upgrades,8);
   FOR i IN 1..additions LOOP
     s.segments:=s.segments || jsonb_build_array(jsonb_build_object('type','num','base',choice_bases[1+(public.crilo_secure_random_index(10))]));
   END LOOP;
 ELSE
   RAISE EXCEPTION 'Invalid session segment' USING ERRCODE='23514';
 END IF;
 rec:=jsonb_build_object('type',typ,'base',base,'points',points,'segments',jsonb_array_length(s.segments),'probability',p);
 s.results:=s.results || jsonb_build_array(rec);
 IF s.remaining_spins=0 THEN s.finished_at:=clock_timestamp();END IF;
 UPDATE public.crilo_spin_sessions SET remaining_spins=s.remaining_spins,spin_count=s.spin_count,score=s.score,multiplier=s.multiplier,
 upgrades=s.upgrades,doubles=s.doubles,ducks=s.ducks,numbers_landed=s.numbers_landed,extra_spins=s.extra_spins,
 segments=s.segments,results=s.results,finished_at=s.finished_at WHERE id=s.id;
 RETURN jsonb_build_object('outcome_index',pick,'outcome',rec,'score',s.score,'remaining_spins',s.remaining_spins,'spin_count',s.spin_count,
 'segments',s.segments,'finished',s.finished_at IS NOT NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.crilo_get_server_spin_state(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.crilo_spin_sessions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR auth.role()<>'authenticated' THEN
 RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(
    SELECT 1 FROM auth.users au
    JOIN public.profiles pr ON pr.id=au.id
    WHERE au.id=auth.uid()
      AND au.is_anonymous IS FALSE
      AND au.email IS NOT NULL
      AND au.email_confirmed_at IS NOT NULL
      AND (au.banned_until IS NULL OR au.banned_until<=clock_timestamp())
 ) THEN
   RAISE EXCEPTION 'A verified, active Crilo account is required'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.crilo_spin_sessions WHERE id=p_session AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('session_id',s.id,'score',s.score,'remaining_spins',s.remaining_spins,
 'spin_count',s.spin_count,'multiplier',s.multiplier,'upgrades',s.upgrades,
 'doubles',s.doubles,'ducks',s.ducks,'numbers_landed',s.numbers_landed,
 'extra_spins',s.extra_spins,'segments',s.segments,'results',s.results,
 'finished',s.finished_at IS NOT NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_crilo_run_mode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_is_owner boolean := false;
  v_has_official_run boolean := false;
begin

  -- A user may only submit a run as themselves.
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Invalid run owner.';
  end if;

 IF NOT EXISTS(
    SELECT 1 FROM auth.users au
    JOIN public.profiles pr ON pr.id=au.id
    WHERE au.id=auth.uid()
      AND au.is_anonymous IS FALSE
      AND au.email IS NOT NULL
      AND au.email_confirmed_at IS NOT NULL
      AND (au.banned_until IS NULL OR au.banned_until<=clock_timestamp())
 ) THEN
   RAISE EXCEPTION 'A verified, active Crilo account is required'
    USING ERRCODE='42501';
 END IF;
  -- Check whether this account is the Crilo Owner.
  select coalesce(p.is_owner, false)
  into v_is_owner
  from public.profiles p
  where p.id = auth.uid();

  -- Determine whether this player already has an official
  -- run for the Daily period being submitted.
  select exists (
    select 1
    from public.daily_runs r
    where r.user_id = auth.uid()
      and r.daily_period = new.daily_period
      and r.is_test = false
  )
  into v_has_official_run;

  -- Official Dailies are always stored once in daily_runs. Owner Test Runs
  -- must use owner_test_runs through crilo_save_owner_test_run instead.
  if v_has_official_run then
    raise exception 'Official Daily already submitted for this period'
      using errcode='23514';
  end if;
  new.is_test := false;

  return new;
end;
$function$;

-- These server-side entry points remain authenticated-only.
REVOKE EXECUTE ON FUNCTION public.crilo_begin_server_spin_session() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.crilo_server_spin(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.crilo_get_server_spin_state(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_begin_server_spin_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_server_spin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_get_server_spin_state(uuid) TO authenticated;
