-- crilo_begin_server_spin_session
CREATE OR REPLACE FUNCTION public.crilo_begin_server_spin_session()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid := auth.uid(); session_id uuid; period date;
BEGIN
 IF uid IS NULL OR auth.role()<>'authenticated' THEN RAISE EXCEPTION 'Authenticated player required' USING ERRCODE='42501';END IF;
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
END $function$
;

-- crilo_server_spin
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
END $function$
;

-- crilo_v3_record_event
CREATE OR REPLACE FUNCTION public.crilo_v3_record_event(p_event text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); did_insert boolean:=false;
begin
 if u is null then return false;end if;
 if exists(select 1 from public.crilo_banned_accounts where user_id=u) then return false;end if;
 if p_event='domain_set' and not exists(select 1 from public.game_scores where user_id=u and game_key='domain' and is_verified=true) then return false;end if;
 if p_event='badge_filter' and not exists(select 1 from public.featured_badges where user_id=u) then return false;end if;
 if not exists(select 1 from public.crilo_v3_badge_stage s where s.rule->>'rule'='exploration' and s.rule->>'event'=p_event) then return false;end if;
 if p_event in ('daily_results','daily_run_screen') and not exists(select 1 from public.daily_runs where user_id=u and is_test=false) then return false;end if;
 if p_event='duck_sound' and not exists(select 1 from public.daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e where d.user_id=u and d.is_test=false and e->>'type'='duck') then return false;end if;
 insert into public.crilo_v3_user_events(user_id,event_name) values (u,p_event)
 on conflict do nothing;
 get diagnostics did_insert=row_count;
 return did_insert;
end $function$
;

-- crilo_set_featured_badge
CREATE OR REPLACE FUNCTION public.crilo_set_featured_badge(p_position integer, p_badge_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;
  IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=v_user) THEN
    RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';
  END IF;
  IF p_position NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Featured slot must be between 1 and 5';
  END IF;
  IF p_badge_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_badges ub
    WHERE ub.user_id = v_user AND ub.badge_id = p_badge_id
  ) THEN
    RAISE EXCEPTION 'You can only feature unlocked badges';
  END IF;
  DELETE FROM public.featured_badges
  WHERE user_id = v_user AND (position = p_position OR (p_badge_id IS NOT NULL AND badge_id = p_badge_id));
  IF p_badge_id IS NOT NULL THEN
    INSERT INTO public.featured_badges (user_id, position, badge_id)
    VALUES (v_user, p_position, p_badge_id);
  END IF;
END;
$function$
;

-- send_friend_request
CREATE OR REPLACE FUNCTION public.send_friend_request(target_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid:=auth.uid();r public.friend_requests%rowtype;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=me) THEN RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';END IF;
 IF target_user IS NULL OR target_user=me THEN RAISE EXCEPTION 'Invalid friend';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_user) THEN RAISE EXCEPTION 'Player not found';END IF;
 SELECT * INTO r FROM public.friend_requests
 WHERE (sender_id=me AND receiver_id=target_user) OR (sender_id=target_user AND receiver_id=me)
 FOR UPDATE;
 IF FOUND THEN
  IF r.status='accepted' THEN RETURN;END IF;
  IF r.status='pending' THEN
   IF r.receiver_id=me THEN
    UPDATE public.friend_requests SET status='accepted',updated_at=now() WHERE id=r.id;
   END IF;
   RETURN;
  END IF;
  UPDATE public.friend_requests SET sender_id=me,receiver_id=target_user,status='pending',updated_at=now() WHERE id=r.id;
 ELSE
  INSERT INTO public.friend_requests(sender_id,receiver_id) VALUES(me,target_user);
 END IF;
END $function$
;
