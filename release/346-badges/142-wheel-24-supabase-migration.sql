-- One-time Oct 14, 2026 wheel update. Atomic; source snapshots kept private.
create schema if not exists crilo_wheel_20261014;
revoke all on schema crilo_wheel_20261014 from public,anon,authenticated;
create table crilo_wheel_20261014.daily_runs as select * from public.daily_runs;
create table crilo_wheel_20261014.spin_sessions as select * from public.crilo_spin_sessions;
create table crilo_wheel_20261014.guest_spin_sessions as select * from public.crilo_guest_spin_sessions;
create table crilo_wheel_20261014.badges as select * from public.badges;
create table crilo_wheel_20261014.badge_stage as select * from public.crilo_v3_badge_stage;
create table crilo_wheel_20261014.user_badges as select * from public.user_badges;
create table crilo_wheel_20261014.player_stats as select * from public.player_stats;
revoke all on all tables in schema crilo_wheel_20261014 from public,anon,authenticated;
create function crilo_wheel_20261014.new_base(old_base int) returns int
language sql immutable strict set search_path='' as $fn$
select case old_base when 1 then 20 when 2 then 40 when 3 then 60 when 5 then 80
 when 8 then 120 when 10 then 160 else old_base end $fn$;
create function crilo_wheel_20261014.convert_history(history jsonb) returns jsonb
language plpgsql immutable set search_path='' as $fn$
declare e jsonb; output jsonb:='[]'::jsonb; typ text; b int; gain numeric:=0;
 score numeric:=0; mul numeric:=1;
begin
 if jsonb_typeof(history)<>'array' then return history;end if;
 for e in select value from jsonb_array_elements(history) loop
  typ:=e->>'type';gain:=0;
  if typ='num' then
   b:=crilo_wheel_20261014.new_base((e->>'base')::int);
   gain:=least(9007199254740991::numeric-score,b::numeric*mul);
   score:=score+gain;
   e:=jsonb_set(e,'{base}',to_jsonb(b),true);
   e:=jsonb_set(e,'{label}',to_jsonb(gain::bigint::text),true);
  elsif typ='double' then
   gain:=score;score:=least(9007199254740991::numeric,score*2);
  elsif typ='upgrade' then mul:=least(9007199254740991::numeric,mul*3);
  end if;
  e:=jsonb_set(e,'{points}',to_jsonb(gain::bigint),true);
  if jsonb_typeof(e->'segments')='number' then
   e:=jsonb_set(e,'{segments}',to_jsonb((e->>'segments')::int*2),true);
  end if;
  output:=output||jsonb_build_array(e);
 end loop;
 return output;
end $fn$;
create function crilo_wheel_20261014.history_score(history jsonb) returns bigint
language plpgsql immutable set search_path='' as $fn$
declare e jsonb; result numeric:=0;
begin
 if jsonb_typeof(history)<>'array' then return 0;end if;
 for e in select value from jsonb_array_elements(history) loop
  if e->>'type' in ('num','double') then
   result:=least(9007199254740991::numeric,result+coalesce((e->>'points')::numeric,0));
  end if;
 end loop;
 return result::bigint;
end $fn$;
create function crilo_wheel_20261014.convert_segments(old_segments jsonb) returns jsonb
language sql immutable set search_path='' as $fn$
select case when jsonb_typeof(old_segments)='array' then
 (select coalesce(jsonb_agg(case when e->>'type'='num' then jsonb_set(e,'{base}',to_jsonb(crilo_wheel_20261014.new_base((e->>'base')::int)),true) else e end order by ord),'[]'::jsonb)
  from jsonb_array_elements(old_segments) with ordinality as t(e,ord))
 ||
 (select coalesce(jsonb_agg(case when e->>'type'='num' then jsonb_set(e,'{base}',to_jsonb(crilo_wheel_20261014.new_base((e->>'base')::int)),true) else e end order by ord),'[]'::jsonb)
  from jsonb_array_elements(old_segments) with ordinality as t(e,ord))
 else old_segments end $fn$;
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
 PERFORM public.crilo_wheel_assert_unique_email();
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=uid) THEN RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';END IF;
 period:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,442204));
 IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties x WHERE x.user_id=uid AND x.daily_period=period) THEN RAISE EXCEPTION 'Daily locked after drawing removal' USING ERRCODE='23514';END IF;
 SELECT id INTO session_id FROM public.crilo_spin_sessions WHERE user_id=uid AND daily_period=period;
 IF session_id IS NOT NULL THEN RETURN session_id;END IF;
 INSERT INTO public.crilo_spin_sessions(user_id,daily_period,segments)
 VALUES(uid,period,'[{"type":"num","base":40},{"type":"duck"},{"type":"num","base":20},{"type":"upgrade"},{"type":"num","base":60},{"type":"num","base":20},{"type":"spins"},{"type":"num","base":80},{"type":"duck"},{"type":"num","base":40},{"type":"double"},{"type":"num","base":20},{"type":"num","base":40},{"type":"duck"},{"type":"num","base":20},{"type":"upgrade"},{"type":"num","base":60},{"type":"num","base":20},{"type":"spins"},{"type":"num","base":80},{"type":"duck"},{"type":"num","base":40},{"type":"double"},{"type":"num","base":20}]'::jsonb)
 RETURNING id INTO session_id;
 RETURN session_id;
END $function$;


CREATE OR REPLACE FUNCTION public.crilo_guest_begin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 token text;
 period date;
 hdr jsonb;
 forwarded text;
 client_ip text;
 normalized_ip text;
 ip_key bytea;
 hmac_secret bytea;
 now_at timestamptz := pg_catalog.clock_timestamp();
 short_bucket timestamptz;
 daily_bucket timestamptz;
 uses integer;
BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Already signed in' USING ERRCODE='42501'; END IF;

 -- Resolve the proxy-provided client IP, not a browser-provided identifier.
 -- Cloudflare's connecting-IP is preferred. If absent, take the *last*
 -- forwarded hop rather than the spoofable first X-Forwarded-For entry.
 hdr := coalesce(
   nullif(pg_catalog.current_setting('request.headers',true),'')::jsonb,
   '{}'::jsonb);
 forwarded := hdr->>'x-forwarded-for';
 client_ip := coalesce(
   nullif(pg_catalog.btrim(hdr->>'cf-connecting-ip'),''),
   nullif(pg_catalog.btrim(
     pg_catalog.split_part(forwarded,',',
       pg_catalog.array_length(pg_catalog.string_to_array(forwarded,','),1))), ''));
 IF client_ip IS NULL OR pg_catalog.length(client_ip)>64 THEN
   RAISE EXCEPTION 'Guest session request missing valid proxy client address'
     USING ERRCODE='42501';
 END IF;
 BEGIN
   normalized_ip:=pg_catalog.host(client_ip::inet);
 EXCEPTION WHEN data_exception THEN
   RAISE EXCEPTION 'Guest session request missing valid proxy client address'
     USING ERRCODE='42501';
 END;
 SELECT secret INTO hmac_secret FROM crilo_private.guest_rate_secret WHERE singleton=true;
 IF hmac_secret IS NULL THEN
   RAISE EXCEPTION 'Guest protections temporarily unavailable' USING ERRCODE='42501';
 END IF;
 ip_key:=extensions.hmac(pg_catalog.convert_to(normalized_ip,'UTF8'),hmac_secret,'sha256');
 short_bucket:=pg_catalog.to_timestamp((pg_catalog.floor(extract(epoch from now_at)/600)*600)::double precision);
 period:=((now_at AT TIME ZONE 'UTC')-interval '22 hours')::date;
 daily_bucket:=((period::timestamp+interval '22 hours') AT TIME ZONE 'UTC');

 -- The unique-key UPSERT serializes concurrent requests for the same IP.
 -- A blocked request does not create a ticket, and retrying with a new
 -- browser, localStorage ID, or user-agent does not reset these quotas.
 INSERT INTO crilo_private.guest_rate_quota(visitor_key,window_type,window_start,starts,updated_at)
 VALUES(ip_key,'10m',short_bucket,1,now_at)
 ON CONFLICT(visitor_key,window_type,window_start)
 DO UPDATE SET starts=crilo_private.guest_rate_quota.starts+1,updated_at=EXCLUDED.updated_at
   WHERE crilo_private.guest_rate_quota.starts<10
 RETURNING starts INTO uses;
 IF uses IS NULL THEN
   RAISE SQLSTATE 'PGRST' USING
     MESSAGE=pg_catalog.jsonb_build_object('code','GUEST_RATE_LIMIT',
       'message','Too many new guest Dailies started from this connection. Please try again later.')::text,
     DETAIL=pg_catalog.jsonb_build_object('status',429,
       'headers',pg_catalog.jsonb_build_object('Retry-After','600'))::text;
 END IF;
 uses:=NULL;
 INSERT INTO crilo_private.guest_rate_quota(visitor_key,window_type,window_start,starts,updated_at)
 VALUES(ip_key,'daily',daily_bucket,1,now_at)
 ON CONFLICT(visitor_key,window_type,window_start)
 DO UPDATE SET starts=crilo_private.guest_rate_quota.starts+1,updated_at=EXCLUDED.updated_at
   WHERE crilo_private.guest_rate_quota.starts<60
 RETURNING starts INTO uses;
 IF uses IS NULL THEN
   RAISE SQLSTATE 'PGRST' USING
     MESSAGE=pg_catalog.jsonb_build_object('code','GUEST_RATE_LIMIT',
       'message','Too many guest Dailies were started from this connection today. Please try again after the next Daily reset.')::text,
     DETAIL=pg_catalog.jsonb_build_object('status',429,
       'headers',pg_catalog.jsonb_build_object('Retry-After','3600'))::text;
 END IF;
 -- Periodic cleanup without unbounded per-request scan/write overhead.
 IF pg_catalog.random()<0.01 THEN
   DELETE FROM crilo_private.guest_rate_quota
   WHERE window_start < now_at-interval '72 hours';
 END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 period:=((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date;
 INSERT INTO public.crilo_guest_spin_sessions(ticket_hash,daily_period,segments)
 VALUES(extensions.digest(decode(token,'hex'),'sha256'),period,
 '[{"type":"num","base":40},{"type":"duck"},{"type":"num","base":20},{"type":"upgrade"},{"type":"num","base":60},{"type":"num","base":20},{"type":"spins"},{"type":"num","base":80},{"type":"duck"},{"type":"num","base":40},{"type":"double"},{"type":"num","base":20},{"type":"num","base":40},{"type":"duck"},{"type":"num","base":20},{"type":"upgrade"},{"type":"num","base":60},{"type":"num","base":20},{"type":"spins"},{"type":"num","base":80},{"type":"duck"},{"type":"num","base":40},{"type":"double"},{"type":"num","base":20}]'::jsonb);
 RETURN jsonb_build_object('token',token,'period',period);
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
 choice_bases integer[]:=ARRAY[20,20,40,40,60,60,80,80,120,160];
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
 PERFORM public.crilo_wheel_assert_unique_email();
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Account suspended' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.crilo_spin_sessions WHERE id=p_session AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_daily_penalties x WHERE x.user_id=s.user_id AND x.daily_period=s.daily_period) THEN RAISE EXCEPTION 'Daily locked after drawing removal' USING ERRCODE='23514';END IF;
 IF s.finished_at IS NOT NULL OR s.remaining_spins<=0 OR s.spin_count>=500
 THEN RAISE EXCEPTION 'Spin session expired or finished' USING ERRCODE='23514';END IF;
 -- A run already in progress can finish for 30 minutes after its 22:00 UTC
 -- daily cutoff. It cannot be spun on later days or replayed as a new run.
 IF s.daily_period IS DISTINCT FROM ((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date THEN
   IF s.daily_period IS DISTINCT FROM (((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date-1)
      OR clock_timestamp()>(((s.daily_period+1)::timestamp AT TIME ZONE 'UTC')+interval '22 hours 30 minutes')
   THEN
     RAISE EXCEPTION 'The previous Daily has closed. A new Daily is available.'
       USING ERRCODE='23514';
   END IF;
 END IF;
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
   -- Saturate at JavaScript's last exactly representable integer. Extremely
   -- lucky sequences must finish cleanly instead of overflowing bigint.
   points:=LEAST(9007199254740991::numeric-s.score,base::numeric*s.multiplier)::bigint;
   s.score:=s.score+points;
   s.numbers_landed:=s.numbers_landed+1;
 ELSIF typ='double' THEN
   points:=s.score;
   s.score:=LEAST(9007199254740991::numeric,s.score::numeric*2)::bigint;
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
   s.multiplier:=LEAST(9007199254740991::numeric,s.multiplier::numeric*3)::bigint;
   s.remaining_spins:=s.remaining_spins+1;
   additions:=4+LEAST(s.upgrades,8);
   FOR i IN 1..additions LOOP
     base:=choice_bases[1+(public.crilo_secure_random_index(10))];
     s.segments:=s.segments || jsonb_build_array(jsonb_build_object('type','num','base',base),jsonb_build_object('type','num','base',base));
   END LOOP;
 ELSE
   RAISE EXCEPTION 'Invalid session segment' USING ERRCODE='23514';
 END IF;
 rec:=jsonb_build_object('type',typ,'base',base,'points',points,'segments',jsonb_array_length(s.segments),'probability',p);
 s.results:=s.results || jsonb_build_array(rec);
 -- A hard run limit is terminal even if bonus spins remain. This also
 -- permits overflow-safe score saturation to finalize rather than stall.
 IF s.spin_count>=500 OR s.score>=9007199254740991 THEN
    s.remaining_spins:=0;
 END IF;
 IF s.remaining_spins=0 THEN s.finished_at:=clock_timestamp();END IF;
 UPDATE public.crilo_spin_sessions SET remaining_spins=s.remaining_spins,spin_count=s.spin_count,score=s.score,multiplier=s.multiplier,
 upgrades=s.upgrades,doubles=s.doubles,ducks=s.ducks,numbers_landed=s.numbers_landed,extra_spins=s.extra_spins,
 segments=s.segments,results=s.results,finished_at=s.finished_at WHERE id=s.id;
 RETURN jsonb_build_object('outcome_index',pick,'outcome',rec,'score',s.score,'remaining_spins',s.remaining_spins,'spin_count',s.spin_count,
 'segments',s.segments,'finished',s.finished_at IS NOT NULL);
END $function$;


CREATE OR REPLACE FUNCTION public.crilo_guest_spin(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.crilo_guest_spin_sessions%ROWTYPE;
 n integer;pick integer;outcome jsonb;typ text;base integer;points bigint:=0;i integer;additions integer;
 new_segments jsonb;rec jsonb;p numeric;
 choice_bases integer[]:=ARRAY[20,20,40,40,60,60,80,80,120,160];
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid guest ticket' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.crilo_guest_spin_sessions
 WHERE ticket_hash=extensions.digest(decode(p_token,'hex'),'sha256') FOR UPDATE;
 IF NOT FOUND OR s.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Guest ticket unavailable' USING ERRCODE='42501';END IF;
 IF s.finished_at IS NOT NULL OR s.remaining_spins<=0 OR s.spin_count>=500 THEN RAISE EXCEPTION 'Guest run already finished' USING ERRCODE='23514';END IF;
 IF s.daily_period IS DISTINCT FROM ((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date THEN
 IF s.daily_period IS DISTINCT FROM (((clock_timestamp() AT TIME ZONE 'UTC')-interval '22 hours')::date-1)
 OR clock_timestamp()>(((s.daily_period+1)::timestamp AT TIME ZONE 'UTC')+interval '22 hours 30 minutes')
 THEN RAISE EXCEPTION 'Guest Daily expired' USING ERRCODE='23514';END IF;END IF;
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
   -- Saturate at JavaScript's last exactly representable integer. Extremely
   -- lucky sequences must finish cleanly instead of overflowing bigint.
   points:=LEAST(9007199254740991::numeric-s.score,base::numeric*s.multiplier)::bigint;
   s.score:=s.score+points;
   s.numbers_landed:=s.numbers_landed+1;
 ELSIF typ='double' THEN
   points:=s.score;
   s.score:=LEAST(9007199254740991::numeric,s.score::numeric*2)::bigint;
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
   s.multiplier:=LEAST(9007199254740991::numeric,s.multiplier::numeric*3)::bigint;
   s.remaining_spins:=s.remaining_spins+1;
   additions:=4+LEAST(s.upgrades,8);
   FOR i IN 1..additions LOOP
     base:=choice_bases[1+(public.crilo_secure_random_index(10))];
     s.segments:=s.segments || jsonb_build_array(jsonb_build_object('type','num','base',base),jsonb_build_object('type','num','base',base));
   END LOOP;
 ELSE
   RAISE EXCEPTION 'Invalid session segment' USING ERRCODE='23514';
 END IF;
 rec:=jsonb_build_object('type',typ,'base',base,'points',points,'segments',jsonb_array_length(s.segments),'probability',p);
 s.results:=s.results || jsonb_build_array(rec);
 -- A hard run limit is terminal even if bonus spins remain. This also
 -- permits overflow-safe score saturation to finalize rather than stall.
 IF s.spin_count>=500 OR s.score>=9007199254740991 THEN
    s.remaining_spins:=0;
 END IF;
 IF s.remaining_spins=0 THEN s.finished_at:=clock_timestamp();END IF;
 UPDATE public.crilo_guest_spin_sessions SET remaining_spins=s.remaining_spins,spin_count=s.spin_count,score=s.score,multiplier=s.multiplier,
 upgrades=s.upgrades,doubles=s.doubles,ducks=s.ducks,numbers_landed=s.numbers_landed,extra_spins=s.extra_spins,
 segments=s.segments,results=s.results,finished_at=s.finished_at WHERE id=s.id;
 RETURN jsonb_build_object('outcome_index',pick,'outcome',rec,'score',s.score,'remaining_spins',s.remaining_spins,'spin_count',s.spin_count,
 'segments',s.segments,'finished',s.finished_at IS NOT NULL);
END $function$;


CREATE OR REPLACE FUNCTION public.crilo_validate_daily_run_replay()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 a jsonb; item jsonb; kind text; base_value numeric; points_value numeric;
 replay_score numeric:=0; replay_mult numeric:=1; remaining integer:=5;
 seen integer:=0; num_count integer:=0; upgrade_count integer:=0;
 double_count integer:=0; duck_count integer:=0; bonus_count integer:=0;
BEGIN
 a:=NEW.results;
 IF a IS NULL OR jsonb_typeof(a)<>'array' OR jsonb_array_length(a)<5 OR jsonb_array_length(a)>10000
 THEN RAISE EXCEPTION 'Invalid Daily result history' USING ERRCODE='23514'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(a) LOOP
   IF remaining<=0 THEN RAISE EXCEPTION 'Spin after Daily ended' USING ERRCODE='23514';END IF;
   remaining:=remaining-1;seen:=seen+1;kind:=item->>'type';
   IF kind='num' THEN
     IF jsonb_typeof(item->'base')<>'number' OR jsonb_typeof(item->'points')<>'number' THEN
       RAISE EXCEPTION 'Invalid numbered spin' USING ERRCODE='23514';END IF;
     base_value:=(item->>'base')::numeric;points_value:=(item->>'points')::numeric;
     IF base_value NOT IN (20,40,60,80,120,160)
       OR (upgrade_count=0 AND base_value NOT IN (20,40,60,80))
       OR points_value<>LEAST(base_value*replay_mult,9007199254740991::numeric-replay_score)
     THEN RAISE EXCEPTION 'Invalid numbered spin points' USING ERRCODE='23514';END IF;
     replay_score:=replay_score+points_value;num_count:=num_count+1;
   ELSIF kind='double' THEN
     IF jsonb_typeof(item->'points')<>'number' OR (item->>'points')::numeric<>replay_score THEN
       RAISE EXCEPTION 'Invalid double points' USING ERRCODE='23514';END IF;
     replay_score:=LEAST(replay_score*2,9007199254740991::numeric);remaining:=remaining+1;double_count:=double_count+1;
   ELSIF kind='upgrade' THEN
     IF jsonb_typeof(item->'points')<>'number' OR (item->>'points')::numeric<>0 THEN
       RAISE EXCEPTION 'Invalid upgrade points' USING ERRCODE='23514';END IF;
     replay_mult:=LEAST(replay_mult*3,9007199254740991::numeric);remaining:=remaining+1;upgrade_count:=upgrade_count+1;
   ELSIF kind='duck' THEN
     IF jsonb_typeof(item->'points')<>'number' OR (item->>'points')::numeric<>0 THEN
       RAISE EXCEPTION 'Invalid duck points' USING ERRCODE='23514';END IF;
     remaining:=remaining+1;duck_count:=duck_count+1;
   ELSIF kind='spins' THEN
     IF jsonb_typeof(item->'points')<>'number' OR (item->>'points')::numeric<>0 THEN
       RAISE EXCEPTION 'Invalid bonus points' USING ERRCODE='23514';END IF;
     remaining:=remaining+2;bonus_count:=bonus_count+2;
   ELSE RAISE EXCEPTION 'Unknown wheel result type' USING ERRCODE='23514';
   END IF;
 END LOOP;
 -- At the 500-spin safety limit or numeric saturation, a server-proof run
 -- is terminal even though its theoretical bonus-spin balance is positive.
 IF (remaining<>0 AND NOT (
   NEW.verified_spin_session_id IS NOT NULL
   AND remaining>0
   AND (seen=500 OR replay_score>=9007199254740991::numeric)
 )) OR NEW.score::numeric<>replay_score OR NEW.spins<>seen
 OR coalesce(NEW.upgrades,0)<>upgrade_count OR coalesce(NEW.doubles,0)<>double_count
 OR coalesce(NEW.ducks,0)<>duck_count OR coalesce(NEW.extra_spins,0)<>bonus_count
 OR coalesce(NEW.numbers_landed,num_count)<>num_count
 THEN RAISE EXCEPTION 'Daily results do not match final score or counters' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $function$;


CREATE OR REPLACE FUNCTION public.crilo_v3_run_matches(p_rule jsonb, p_results jsonb, p_score bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare kind text:=p_rule->>'rule'; n int:=coalesce((p_rule->>'target')::int,0);
 e jsonb; a jsonb; typ text; base int; i int:=0; nnum int:=0; counts jsonb:='{}'::jsonb;
 types text[]:=array[]::text[]; bases int[]:=array[]::int[]; vals bigint[]:=array[]::bigint[];
 score numeric:=0; mult numeric:=1; prev text:=''; streak int:=0;
 pat text[]; bpat int[]; run_count int:=0; j int; ok boolean; distinct_count int; bcounter int:=0;
 first_type text; last_type text; last_base int;
begin
 if kind='score_band' then return p_score >= (p_rule->>'lower')::bigint and (p_rule->>'upper' is null or p_score <= (p_rule->>'upper')::bigint);end if;
 if jsonb_typeof(p_results) <> 'array' then return false;end if;
 for e in select value from jsonb_array_elements(p_results) loop
  typ:=e->>'type';
  if typ not in ('num','duck','double','spins','upgrade') then return false;end if;
  i:=i+1;if i>500 then return false;end if;
  if typ='num' then
   base:=coalesce((e->>'base')::int,0);
   if base not in (20,40,60,80,120,160) then return false;end if;
   score:=least(score+base*mult,9007199254740991::numeric);
   nnum:=nnum+1;
  else base:=0;
   if typ='double' then score:=least(score*2,9007199254740991::numeric);
   elsif typ='upgrade' then mult:=least(mult*3,9007199254740991::numeric);end if;
  end if;
  if score>9223372036854775807 then return false;end if;
  types:=array_append(types,typ);bases:=array_append(bases,base);vals:=array_append(vals,score::bigint);
 end loop;
 run_count:=coalesce(array_length(types,1),0);
 if run_count=0 then return false;end if;
 if kind='hit_exact' then return n=any(vals);
 elsif kind='event_total' then
  select count(*) into bcounter from unnest(types) t where t=p_rule->>'event';
  return bcounter>=n;
 elsif kind='event_streak' then
  for j in 1..run_count loop
   if types[j]=p_rule->>'event' then streak:=streak+1;if streak>=n then return true;end if;
   else streak:=0;end if;
  end loop;return false;
 elsif kind in ('sequence','base_sequence','number_sequence') then
  if kind='sequence' then
   select array_agg(value) into pat from jsonb_array_elements_text(p_rule->'pattern');
   if pat is null or cardinality(pat)>run_count then return false;end if;
   for j in 1..run_count-cardinality(pat)+1 loop
    ok:=true;
    for i in 1..cardinality(pat) loop if types[j+i-1] <> pat[i] then ok:=false;exit;end if;end loop;
    if ok then return true;end if;
   end loop;
  else
   select array_agg(value::int) into bpat from jsonb_array_elements_text(p_rule->'pattern');
   if bpat is null or cardinality(bpat)>run_count then return false;end if;
   for j in 1..run_count-cardinality(bpat)+1 loop
    ok:=true;for i in 1..cardinality(bpat) loop
     if types[j+i-1]<>'num' or bases[j+i-1]<>bpat[i] then ok:=false;exit;end if;
    end loop;if ok then return true;end if;
   end loop;
  end if;return false;
 elsif kind='first_event' then return types[1]=p_rule->>'event';
 elsif kind='final_base' then return types[run_count]='num' and bases[run_count]=(p_rule->>'base')::int;
 elsif kind='first_last' then return types[1]=p_rule->>'first' and types[run_count]='num' and bases[run_count]=(p_rule->>'last_base')::int;
 elsif kind='spin_position' then return run_count>=n and types[n]='num';
 elsif kind='base_total' then
  for j in 1..run_count loop if types[j]='num' and bases[j]=(p_rule->>'base')::int then bcounter:=bcounter+1;end if;end loop;
  return bcounter>=n;
 elsif kind='variety' then
  select count(distinct x) into distinct_count from unnest(bases) x where x in (20,40,60,80);
  return distinct_count>=n;
 elsif kind='challenge' then
  n:=(p_rule->>'number')::int;
  if n=129 then return run_count=5 and nnum=5;
  elsif n between 130 and 138 then
   typ:=case when n in (130,131,132) then 'duck' when n in (133,134) then 'double' when n in (135,136) then 'upgrade' else 'spins' end;
   select count(*) into bcounter from unnest(types) t where t=typ;
   if n in (130,133,135,137) then return bcounter=0;end if;
   if n=132 then return bcounter=2;end if;
   return bcounter=1;
  elsif n=139 then return array['duck','double','upgrade','spins'] <@ types;
  elsif n between 140 and 145 then
   pat:=case n
    when 140 then array['duck','double'] when 141 then array['duck','upgrade']
    when 142 then array['duck','spins'] when 143 then array['double','upgrade']
    when 144 then array['double','spins'] else array['upgrade','spins'] end;
   return pat <@ types;
  elsif n in (146,147,148) then return run_count>=case n when 146 then 8 when 147 then 10 else 12 end;
  elsif n=149 then return array[20,60,80] <@ bases;
  elsif n=150 then return 20=any(bases);
  elsif n=151 then select count(*) into bcounter from unnest(bases) b where b=40;return bcounter>=2;
  elsif n=152 then return 80=any(bases);
  elsif n=153 then select count(*) into bcounter from unnest(bases) b where b=60;return bcounter>=3;
  elsif n=154 then return not (1=any(bases));
  elsif n=155 then select count(*) into bcounter from unnest(bases) b where b=20;return bcounter>=5;
  elsif n=156 then
   -- "four consecutive numerical spins" means four adjacent wheel results, not numerical subsequence.
   for j in 1..run_count-3 loop
    if types[j]='num' and bases[j]=bases[j+1] and bases[j]=bases[j+2] and bases[j]=bases[j+3] then return true;end if;
   end loop;return false;
  elsif n=157 then
   mult:=1;for j in 1..run_count loop
    if types[j]='upgrade' then mult:=mult*3;end if;
    if types[j]='num' and mult>1 and bases[j]*mult>=6000 then return true;end if;
   end loop;return false;
  elsif n=158 then
   mult:=1;for j in 1..run_count loop
    if types[j]='upgrade' then mult:=mult*3;end if;
    if types[j]='num' and bases[j]*mult>=30 then return true;end if;
   end loop;return false;
  end if;
 end if;
 return false;
exception when others then return false;
end $function$;


CREATE OR REPLACE FUNCTION public.crilo_v3_account_matches(p_rule jsonb, p_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare kind text:=p_rule->>'rule'; t integer:=coalesce((p_rule->>'target')::int,0);
 n integer:=0; v text:=p_rule->>'event'; x integer:=0;
 idn integer:=coalesce(nullif(substring(p_rule->>'key' from '[0-9]+$'),'')::int,0);
begin
 if p_user is null then return false;end if;
 if kind='exploration' then
  return exists(select 1 from public.crilo_v3_user_events e where e.user_id=p_user and e.event_name=v);
 elsif kind='lifetime_runs' then
  select count(distinct daily_period) into n from public.daily_runs where user_id=p_user and is_test=false;
  return n>=t;
 elsif kind='lifetime_spins' then
  select coalesce(sum(spins),0)::int into n from public.daily_runs where user_id=p_user and is_test=false;
  return n>=t;
 elsif kind='lifetime_event' or kind='lifetime_base' then
  if kind='lifetime_event' and v='num' then
   select coalesce(sum(numbers_landed),0)::int into n from public.daily_runs where user_id=p_user and is_test=false;
  elsif kind='lifetime_event' and v in ('duck','double','spins','upgrade') then
   select count(*) into n from public.daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e
    where d.user_id=p_user and d.is_test=false and e->>'type'=v;
  else
   select count(*) into n from public.daily_runs d cross join lateral jsonb_array_elements(coalesce(d.results,'[]'::jsonb)) e
    where d.user_id=p_user and d.is_test=false and e->>'type'='num' and (e->>'base')::int=(p_rule->>'base')::int;
  end if; return n>=t;
 elsif kind='daily_streak' then
  select coalesce(max(cnt),0) into n from (
   select count(*) cnt from (
    select p.daily_period,p.daily_period-row_number() over(order by p.daily_period)::int as grp
    from (select distinct daily_period from public.daily_runs where user_id=p_user and is_test=false and daily_period is not null)p
   )g group by grp
  )z;return n>=t;
 elsif kind='drawing' then
  if idn in (234,235,236,237,238,241) then
   t:=case idn when 234 then 1 when 235 then 2 when 236 then 5 when 237 then 10 when 238 then 20 else 30 end;
   select count(distinct daily_period) into n from public.daily_runs d
    where d.user_id=p_user and d.is_test=false and d.drawing_is_blank=false;
   return n>=t;
  elsif idn=240 then
   select coalesce(max(cnt),0) into n from (
    select count(*) cnt from (
     select p.daily_period,p.daily_period-row_number() over(order by p.daily_period)::int as grp
     from (select distinct daily_period from public.daily_runs where user_id=p_user and is_test=false and drawing_is_blank=false and daily_period is not null)p
    )g group by grp
   )z;return n>=7;
  elsif idn=239 then
   return exists(
    select 1 from public.friend_requests f
    join public.daily_runs a on a.user_id=p_user and a.is_test=false and a.drawing_is_blank=false
    join public.daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.drawing_is_blank=false and b.user_id=
       case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user));
  end if;return false;
 elsif kind='leaderboard' then
  if idn between 209 and 217 then
   t:=case idn when 209 then 100 when 210 then 50 when 211 then 25 when 212 then 10
    when 213 then 5 when 214 then 3 when 215 then 2 when 216 then 3 else 1 end;
   if idn in (215,216,217) then
    return exists(select 1 from public.daily_runs d where d.user_id=p_user and d.is_test=false and d.final_rank=t);
   end if;
   return exists(select 1 from public.daily_runs d where d.user_id=p_user and d.is_test=false and d.final_rank between 1 and t);
  elsif idn between 218 and 223 then
   t:=case idn when 218 then 2 when 219 then 5 when 220 then 10 when 221 then 2 when 222 then 5 else 2 end;
   x:=case when idn between 218 and 220 then 100 when idn between 221 and 222 then 10 else 1 end;
   select count(distinct daily_period) into n from public.daily_runs d
   where d.user_id=p_user and d.is_test=false and d.final_rank between 1 and x;
   return n>=t;
  end if;return false;
 elsif kind='social' then
  if idn between 224 and 228 then
   t:=case idn when 224 then 1 when 225 then 3 when 226 then 5 when 227 then 10 else 20 end;
   select count(distinct case when sender_id=p_user then receiver_id else sender_id end) into n
   from public.friend_requests f where status='accepted' and (sender_id=p_user or receiver_id=p_user);
   return n>=t;
  elsif idn in (229,230,231,232,233) then
   if idn=232 then
    return exists(select 1 from public.friend_requests f join public.daily_runs b on b.user_id=
     case when f.sender_id=p_user then f.receiver_id else f.sender_id end and b.is_test=false and b.final_rank=1
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user));
   end if;
   if idn=230 then
    select count(distinct a.daily_period) into n from public.friend_requests f
    join public.daily_runs a on a.user_id=p_user and a.is_test=false
    join public.daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.user_id=
      case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user) and a.score>b.score;
    return n>=5;
   end if;
   return exists(select 1 from public.friend_requests f
    join public.daily_runs a on a.user_id=p_user and a.is_test=false
    join public.daily_runs b on b.daily_period=a.daily_period and b.is_test=false and b.user_id=
      case when f.sender_id=p_user then f.receiver_id else f.sender_id end
    where f.status='accepted' and (f.sender_id=p_user or f.receiver_id=p_user)
      and (idn=233 or (idn=229 and a.score>b.score) or (idn=231 and abs(a.score-b.score)<=100)));
  end if;return false;
 end if;
 return false;
exception when others then return false;
end $function$;


CREATE OR REPLACE FUNCTION public.crilo_v3_refresh_user_badges(p_user uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; qualifying_id bigint; awarded integer:=0; eligible boolean;
begin
 if p_user is null or not exists(select 1 from public.profiles p where p.id=p_user) then return 0;end if;
 for r in
  select b.id,s.badge_key,s.rule
  from public.crilo_v3_badge_stage s join public.badges b on b.badge_key=s.badge_key
  order by b.id
 loop
  qualifying_id:=null;
  if r.rule->>'rule' in ('hit_exact','score_band','event_total','event_streak','sequence','challenge','first_event','final_base','spin_position','base_total','base_sequence','number_sequence','first_last','variety') then
   select d.id into qualifying_id
   from public.daily_runs d
   where d.user_id=p_user and d.is_test=false and public.crilo_v3_run_matches(r.rule,d.results,d.score)
   order by d.created_at,d.id limit 1;
   eligible:=qualifying_id is not null;
  else
   eligible:=public.crilo_v3_account_matches(r.rule,p_user);
  end if;
  if eligible then
   insert into public.user_badges(user_id,badge_id,run_id) values(p_user,r.id,qualifying_id)
   on conflict(user_id,badge_id) do update
   set run_id=excluded.run_id
   where public.user_badges.run_id is distinct from excluded.run_id;
   awarded:=awarded+1;
  else
   null; -- grandfather all previously earned badges
  end if;
 end loop;
 return awarded;
end $function$;


CREATE OR REPLACE FUNCTION public.crilo_v2_funny_score_keys(p_results jsonb)
 RETURNS TABLE(badge_key text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare e jsonb; t text; v_score numeric:=0; v_mult numeric:=1;v_base numeric;
begin
 if jsonb_typeof(p_results)<>'array' then return;end if;
 for e in select value from jsonb_array_elements(p_results) loop
  t:=e->>'type';
  if t='num' then
   if e->>'base' is null or (e->>'base') !~ '^[0-9]{1,3}$' then return;end if;
   v_base:=(e->>'base')::numeric;
   if v_base not in (20,40,60,80,120,160) then return;end if;
   v_score:=v_score+v_base*v_mult;
  elsif t='double' then v_score:=v_score*2;
  elsif t='upgrade' then v_mult:=v_mult*3;
  elsif t not in ('duck','spins') then return;
  end if;
  if v_score=trunc(v_score) and v_score>0 then
   return query select b.badge_key from public.badges b
    where b.category='funny_score' and (b.requirement->>'score')::numeric=v_score;
  end if;
 end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.crilo_v2_official_score_badge_key(p_score bigint)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
select case when p_score<=120 then 'v2_score_rarity_trash'
when p_score<=440 then 'v2_score_rarity_common'
when p_score<=860 then 'v2_score_rarity_uncommon'
when p_score<=1620 then 'v2_score_rarity_rare'
when p_score<=2460 then 'v2_score_rarity_epic'
when p_score<=5440 then 'v2_score_rarity_anomaly'
when p_score<=14420 then 'v2_score_rarity_mythic'
else 'v2_score_rarity_divine' end
$function$;


CREATE OR REPLACE FUNCTION public.crilo_enforce_score_rarity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if coalesce(new.is_test,false) then return new;end if;
 new.rarity_label:=case when new.score>=14421 then 'DIVINE'
 when new.score>=5441 then 'MYTHIC' when new.score>=2461 then 'ANOMALY'
 when new.score>=1621 then 'EPIC' when new.score>=861 then 'RARE'
 when new.score>=441 then 'UNCOMMON' when new.score>=121 then 'COMMON'
 else 'TRASH' end;
 new.rarity_odds:=case when new.score>=14421 then 1000 when new.score>=5441 then 111
 when new.score>=2461 then 25 when new.score>=1621 then 20
 when new.score>=861 then 7 when new.score>=441 then 4
 when new.score>=121 then 2 else 1 end;
 return new;
end $function$;


CREATE OR REPLACE FUNCTION public.crilo_v2_run_badge_keys(p_results jsonb)
 RETURNS TABLE(badge_key text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare v_type text;v_prev text:='';v_length int:=0;v_upgrades int:=0;v_segments int:=24;
v_counts jsonb:='{}'::jsonb;v_streaks jsonb:='{}'::jsonb;v_row record;
begin
 if jsonb_typeof(p_results)<>'array' then return;end if;
 for v_row in select value as event from jsonb_array_elements(p_results) with ordinality order by ordinality loop
  v_type:=v_row.event->>'type';
  if v_type not in ('duck','double','spins','upgrade','num') then return;end if;
  v_counts:=jsonb_set(v_counts,array[v_type],to_jsonb(coalesce((v_counts->>v_type)::int,0)+1),true);
  if v_type=v_prev then v_length:=v_length+1;else v_length:=1;end if;
  v_prev:=v_type;
  v_streaks:=jsonb_set(v_streaks,array[v_type],to_jsonb(greatest(coalesce((v_streaks->>v_type)::int,0),v_length)),true);
  if v_type='upgrade' then v_upgrades:=v_upgrades+1;v_segments:=v_segments+2*(4+least(v_upgrades,8));end if;
  if v_row.event ? 'segments' and (v_row.event->>'segments')::int<>v_segments then return;end if;
 end loop;
 return query select b.badge_key from public.badges b
 where b.badge_key like 'v2_%' and b.category='wheel'
 and b.requirement->>'type' in ('total','streak')
 and (case when b.requirement->>'type'='total'
 then coalesce((v_counts->>(b.requirement->>'wheel_type'))::int,0)
 else coalesce((v_streaks->>(b.requirement->>'wheel_type'))::int,0) end)
 >=(b.requirement->>'value')::int;
end $function$;


-- Convert every active and finished official and guest session; preserve
-- user IDs, claim tokens, spin IDs, timestamps and spin probabilities.
with w as materialized (select id,score as old_score,
crilo_wheel_20261014.convert_history(results) history,
crilo_wheel_20261014.convert_segments(segments) segments from public.crilo_spin_sessions)
update public.crilo_spin_sessions s set results=w.history,segments=w.segments,
score=case when jsonb_array_length(w.history)>0 then crilo_wheel_20261014.history_score(w.history)
else least(9007199254740991::numeric,w.old_score::numeric*20)::bigint end
from w where s.id=w.id;
with w as materialized (select id,score as old_score,
crilo_wheel_20261014.convert_history(results) history,
crilo_wheel_20261014.convert_segments(segments) segments from public.crilo_guest_spin_sessions)
update public.crilo_guest_spin_sessions s set results=w.history,segments=w.segments,
score=case when jsonb_array_length(w.history)>0 then crilo_wheel_20261014.history_score(w.history)
else least(9007199254740991::numeric,w.old_score::numeric*20)::bigint end
from w where s.id=w.id;

create table crilo_wheel_20261014.conversion_audit as
select id,score old_score,case when jsonb_typeof(results)='array' and jsonb_array_length(results)>0
then 'exact_replayed_history' else 'estimated_20x_no_history' end conversion_method,
verified_spin_session_id is not null as verified from public.daily_runs;
revoke all on crilo_wheel_20261014.conversion_audit from public,anon,authenticated;
with calc as materialized (
 select d.id,d.score old_score,d.best_roll_points old_best,
 crilo_wheel_20261014.convert_history(d.results) history
 from public.daily_runs d
), scores as materialized (
 select *, case when jsonb_typeof(history)='array' and jsonb_array_length(history)>0
 then crilo_wheel_20261014.history_score(history)
 else least(9007199254740991::numeric,old_score::numeric*20)::bigint end new_score,
 (select max((v->>'points')::bigint) from jsonb_array_elements(coalesce(history,'[]'::jsonb)) v) new_best
 from calc
)
update public.daily_runs d set results=x.history,score=x.new_score,
best_roll_points=coalesce(x.new_best,least(9007199254740991::numeric,coalesce(x.old_best,0)::numeric*20)::bigint),
best_roll_label=case when d.best_roll_label is null then null when d.best_roll_label='×2' then '×2'
when x.new_best is null then '+'||(coalesce(x.old_best,0)*20)::text else '+'||x.new_best::text end,
rarity_label=upper(replace(public.crilo_v2_official_score_badge_key(x.new_score),'v2_score_rarity_','')),
rarity_odds=case when x.new_score>=14421 then 1000 when x.new_score>=5441 then 111
when x.new_score>=2461 then 25 when x.new_score>=1621 then 20
when x.new_score>=861 then 7 when x.new_score>=441 then 4
when x.new_score>=121 then 2 else 1 end
from scores x where d.id=x.id;

-- Retarget all 65 exact scores, numerical patterns, cumulative base badges,
-- score tiers, and descriptions from the versioned revised badge catalog.
insert into public.crilo_v3_badge_stage(badge_key,display_name,description,rarity,category,rule,status)
values('v2_score_rarity_divine','Divine Score','Finish one official Daily with a final score of at least 14,421 points.',
'Epic','Score rarity',
'{"key":"v2_score_rarity_divine","rule":"score_band","name":"Divine Score","category":"Score rarity","rarity":"Epic","lower":14421,"upper":null,"probability_percent":0.0999,"condition":"Finish one official Daily with a final score of at least 14,421 points."}'::jsonb,'active')
on conflict(badge_key) do nothing;

with src as (select value obj from jsonb_array_elements($catalog$[{"key":"v2_funny_score_21","category":"Exact numbers","rarity":"Uncommon","name":"Twenty-One","condition":"Reach exactly 420 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":420},{"key":"v2_funny_score_42","category":"Exact numbers","rarity":"Uncommon","name":"Answer to Everything","condition":"Reach exactly 840 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":840},{"key":"v2_funny_score_67","category":"Exact numbers","rarity":"Rare","name":"Six Seven","condition":"Reach exactly 1,340 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1340},{"key":"v2_funny_score_69","category":"Exact numbers","rarity":"Uncommon","name":"Nice.","condition":"Reach exactly 1,380 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1380},{"key":"v2_funny_score_96","category":"Exact numbers","rarity":"Rare","name":"Reverse Nice","condition":"Reach exactly 1,920 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1920},{"key":"v2_funny_score_99","category":"Exact numbers","rarity":"Rare","name":"Almost a Hundred","condition":"Reach exactly 1,980 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1980},{"key":"v2_funny_score_111","category":"Exact numbers","rarity":"Rare","name":"Triple Ones","condition":"Reach exactly 2,220 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":2220},{"key":"v2_funny_score_123","category":"Exact numbers","rarity":"Rare","name":"One Two Three","condition":"Reach exactly 2,460 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":2460},{"key":"v2_funny_score_222","category":"Exact numbers","rarity":"Epic","name":"Triple Twos","condition":"Reach exactly 4,440 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":4440},{"key":"v2_funny_score_333","category":"Exact numbers","rarity":"Epic","name":"Triple Threes","condition":"Reach exactly 6,660 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":6660},{"key":"v2_funny_score_404","category":"Exact numbers","rarity":"Anomaly","name":"Score Not Found","condition":"Reach exactly 8,080 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":8080},{"key":"v2_funny_score_420","category":"Exact numbers","rarity":"Anomaly","name":"Blaze It","condition":"Reach exactly 8,400 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":8400},{"key":"v2_funny_score_444","category":"Exact numbers","rarity":"Anomaly","name":"Triple Fours","condition":"Reach exactly 8,880 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":8880},{"key":"v2_funny_score_555","category":"Exact numbers","rarity":"Anomaly","name":"Triple Fives","condition":"Reach exactly 11,100 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":11100},{"key":"v2_funny_score_666","category":"Exact numbers","rarity":"Anomaly","name":"Devil's Number","condition":"Reach exactly 13,320 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":13320},{"key":"v2_funny_score_777","category":"Exact numbers","rarity":"Mythic","name":"Lucky Sevens","condition":"Reach exactly 15,540 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":15540},{"key":"v2_funny_score_888","category":"Exact numbers","rarity":"Mythic","name":"Triple Eights","condition":"Reach exactly 17,760 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":17760},{"key":"v2_funny_score_999","category":"Exact numbers","rarity":"Mythic","name":"Triple Nines","condition":"Reach exactly 19,980 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":19980},{"key":"v2_funny_score_5","category":"Exact numbers","rarity":"Common","name":"High Five","condition":"Reach exactly 100 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":100},{"key":"v2_funny_score_7","category":"Exact numbers","rarity":"Common","name":"Lucky Number Seven","condition":"Reach exactly 140 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":140},{"key":"v2_funny_score_10","category":"Exact numbers","rarity":"Common","name":"Perfect Ten","condition":"Reach exactly 200 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":200},{"key":"v2_funny_score_11","category":"Exact numbers","rarity":"Common","name":"Make a Wish","condition":"Reach exactly 220 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":220},{"key":"v2_funny_score_12","category":"Exact numbers","rarity":"Common","name":"A Dozen","condition":"Reach exactly 240 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":240},{"key":"v2_funny_score_13","category":"Exact numbers","rarity":"Common","name":"Unlucky Thirteen","condition":"Reach exactly 260 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":260},{"key":"v2_funny_score_15","category":"Exact numbers","rarity":"Common","name":"Quarter Hour","condition":"Reach exactly 300 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":300},{"key":"v2_funny_score_20","category":"Exact numbers","rarity":"Uncommon","name":"Twenty Twenty","condition":"Reach exactly 400 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":400},{"key":"v2_funny_score_24","category":"Exact numbers","rarity":"Uncommon","name":"Around the Clock","condition":"Reach exactly 480 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":480},{"key":"v2_funny_score_25","category":"Exact numbers","rarity":"Uncommon","name":"Quarter Century","condition":"Reach exactly 500 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":500},{"key":"v2_funny_score_30","category":"Exact numbers","rarity":"Uncommon","name":"Thirty Flirty","condition":"Reach exactly 600 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":600},{"key":"v2_funny_score_33","category":"Exact numbers","rarity":"Uncommon","name":"Double Threes","condition":"Reach exactly 660 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":660},{"key":"v2_funny_score_50","category":"Exact numbers","rarity":"Uncommon","name":"Half a Century","condition":"Reach exactly 1,000 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1000},{"key":"v2_funny_score_55","category":"Exact numbers","rarity":"Rare","name":"Double Fives","condition":"Reach exactly 1,100 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1100},{"key":"v2_funny_score_66","category":"Exact numbers","rarity":"Uncommon","name":"Double Sixes","condition":"Reach exactly 1,320 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1320},{"key":"v2_funny_score_70","category":"Exact numbers","rarity":"Rare","name":"Seventy Up","condition":"Reach exactly 1,400 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1400},{"key":"v2_funny_score_77","category":"Exact numbers","rarity":"Rare","name":"Double Lucky","condition":"Reach exactly 1,540 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1540},{"key":"v2_funny_score_88","category":"Exact numbers","rarity":"Rare","name":"Double Eights","condition":"Reach exactly 1,760 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1760},{"key":"v2_funny_score_100","category":"Exact numbers","rarity":"Rare","name":"Triple Digits","condition":"Reach exactly 2,000 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":2000},{"key":"v2_funny_score_101","category":"Exact numbers","rarity":"Rare","name":"Introduction to Numbers","condition":"Reach exactly 2,020 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":2020},{"key":"v2_funny_score_200","category":"Exact numbers","rarity":"Epic","name":"Double Century","condition":"Reach exactly 4,000 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":4000},{"key":"v2_score_rarity_trash","category":"Score rarity","rarity":"Uncommon","name":"Trash Score","condition":"Finish one official Daily with a final score between 0 and 120.","rule":"score_band","lower":0,"upper":120,"probability_percent":1.2403},{"key":"v2_score_rarity_common","category":"Score rarity","rarity":"Common","name":"Common Score","condition":"Finish one official Daily with a final score between 121 and 440.","rule":"score_band","lower":121,"upper":440,"probability_percent":48.96935},{"key":"v2_score_rarity_uncommon","category":"Score rarity","rarity":"Common","name":"Uncommon Score","condition":"Finish one official Daily with a final score between 441 and 860.","rule":"score_band","lower":441,"upper":860,"probability_percent":25.22275},{"key":"v2_score_rarity_rare","category":"Score rarity","rarity":"Common","name":"Rare Score","condition":"Finish one official Daily with a final score between 861 and 1,620.","rule":"score_band","lower":861,"upper":1620,"probability_percent":14.64972},{"key":"v2_score_rarity_epic","category":"Score rarity","rarity":"Uncommon","name":"Epic Score","condition":"Finish one official Daily with a final score between 1,621 and 2,460.","rule":"score_band","lower":1621,"upper":2460,"probability_percent":4.9939},{"key":"v2_score_rarity_anomaly","category":"Score rarity","rarity":"Uncommon","name":"Anomaly Score","condition":"Finish one official Daily with a final score between 2,461 and 5,440.","rule":"score_band","lower":2461,"upper":5440,"probability_percent":3.92732},{"key":"v2_score_rarity_mythic","category":"Score rarity","rarity":"Rare","name":"Mythic Score","condition":"Finish one official Daily with a final score between 5,441 and 14,420.","rule":"score_band","lower":5441,"upper":14420,"probability_percent":0.89677},{"key":"v2_duck_total_2","category":"Wheel Duck","rarity":"Common","name":"Duck Collector 2","condition":"Land 2 Duck results during one official Daily.","rule":"event_total","event":"duck","target":2},{"key":"v2_duck_total_3","category":"Wheel Duck","rarity":"Common","name":"Duck Collector 3","condition":"Land 3 Duck results during one official Daily.","rule":"event_total","event":"duck","target":3},{"key":"v2_duck_total_4","category":"Wheel Duck","rarity":"Uncommon","name":"Duck Collector 4","condition":"Land 4 Duck results during one official Daily.","rule":"event_total","event":"duck","target":4},{"key":"v2_duck_total_5","category":"Wheel Duck","rarity":"Uncommon","name":"Duck Collector 5","condition":"Land 5 Duck results during one official Daily.","rule":"event_total","event":"duck","target":5},{"key":"v2_duck_streak_2","category":"Wheel Duck","rarity":"Common","name":"Duck Streak 2","condition":"Land 2 consecutive Duck results during one official Daily.","rule":"event_streak","event":"duck","target":2},{"key":"v2_duck_streak_3","category":"Wheel Duck","rarity":"Uncommon","name":"Duck Streak 3","condition":"Land 3 consecutive Duck results during one official Daily.","rule":"event_streak","event":"duck","target":3},{"key":"v2_duck_streak_4","category":"Wheel Duck","rarity":"Rare","name":"Duck Streak 4","condition":"Land 4 consecutive Duck results during one official Daily.","rule":"event_streak","event":"duck","target":4},{"key":"v2_double_total_1","category":"Wheel ×2","rarity":"Common","name":"×2 Collector 1","condition":"Land 1 ×2 results during one official Daily.","rule":"event_total","event":"double","target":1},{"key":"v2_double_total_2","category":"Wheel ×2","rarity":"Common","name":"×2 Collector 2","condition":"Land 2 ×2 results during one official Daily.","rule":"event_total","event":"double","target":2},{"key":"v2_double_total_3","category":"Wheel ×2","rarity":"Uncommon","name":"×2 Collector 3","condition":"Land 3 ×2 results during one official Daily.","rule":"event_total","event":"double","target":3},{"key":"v2_double_streak_2","category":"Wheel ×2","rarity":"Uncommon","name":"×2 Streak 2","condition":"Land 2 consecutive ×2 results during one official Daily.","rule":"event_streak","event":"double","target":2},{"key":"v2_double_streak_3","category":"Wheel ×2","rarity":"Rare","name":"×2 Streak 3","condition":"Land 3 consecutive ×2 results during one official Daily.","rule":"event_streak","event":"double","target":3},{"key":"v2_spins_total_1","category":"Wheel +2 Spins","rarity":"Common","name":"+2 Spins Collector 1","condition":"Land 1 +2 Spins results during one official Daily.","rule":"event_total","event":"spins","target":1},{"key":"v2_spins_total_2","category":"Wheel +2 Spins","rarity":"Common","name":"+2 Spins Collector 2","condition":"Land 2 +2 Spins results during one official Daily.","rule":"event_total","event":"spins","target":2},{"key":"v2_spins_total_3","category":"Wheel +2 Spins","rarity":"Uncommon","name":"+2 Spins Collector 3","condition":"Land 3 +2 Spins results during one official Daily.","rule":"event_total","event":"spins","target":3},{"key":"v2_spins_total_4","category":"Wheel +2 Spins","rarity":"Uncommon","name":"+2 Spins Collector 4","condition":"Land 4 +2 Spins results during one official Daily.","rule":"event_total","event":"spins","target":4},{"key":"v2_spins_streak_2","category":"Wheel +2 Spins","rarity":"Uncommon","name":"+2 Spins Streak 2","condition":"Land 2 consecutive +2 Spins results during one official Daily.","rule":"event_streak","event":"spins","target":2},{"key":"v2_spins_streak_3","category":"Wheel +2 Spins","rarity":"Rare","name":"+2 Spins Streak 3","condition":"Land 3 consecutive +2 Spins results during one official Daily.","rule":"event_streak","event":"spins","target":3},{"key":"v2_upgrade_total_1","category":"Wheel Upgrade","rarity":"Common","name":"Upgrade Collector 1","condition":"Land 1 Upgrade results during one official Daily.","rule":"event_total","event":"upgrade","target":1},{"key":"v2_upgrade_total_2","category":"Wheel Upgrade","rarity":"Common","name":"Upgrade Collector 2","condition":"Land 2 Upgrade results during one official Daily.","rule":"event_total","event":"upgrade","target":2},{"key":"v2_upgrade_total_3","category":"Wheel Upgrade","rarity":"Uncommon","name":"Upgrade Collector 3","condition":"Land 3 Upgrade results during one official Daily.","rule":"event_total","event":"upgrade","target":3},{"key":"v2_upgrade_streak_2","category":"Wheel Upgrade","rarity":"Uncommon","name":"Upgrade Streak 2","condition":"Land 2 consecutive Upgrade results during one official Daily.","rule":"event_streak","event":"upgrade","target":2},{"key":"idea_exact_1","category":"Exact numbers","rarity":"Common","name":"Just One","condition":"Reach exactly 20 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":20},{"key":"idea_exact_2","category":"Exact numbers","rarity":"Common","name":"Two of a Kind","condition":"Reach exactly 40 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":40},{"key":"idea_exact_3","category":"Exact numbers","rarity":"Common","name":"Three's Company","condition":"Reach exactly 60 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":60},{"key":"idea_exact_4","category":"Exact numbers","rarity":"Common","name":"Fantastic Four","condition":"Reach exactly 80 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":80},{"key":"idea_exact_6","category":"Exact numbers","rarity":"Common","name":"Sixth Sense","condition":"Reach exactly 120 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":120},{"key":"idea_exact_8","category":"Exact numbers","rarity":"Uncommon","name":"Eight Is Great","condition":"Reach exactly 160 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":160},{"key":"idea_exact_9","category":"Exact numbers","rarity":"Uncommon","name":"Cloud Nine","condition":"Reach exactly 180 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":180},{"key":"idea_exact_14","category":"Exact numbers","rarity":"Uncommon","name":"Two Weeks","condition":"Reach exactly 280 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":280},{"key":"idea_exact_16","category":"Exact numbers","rarity":"Uncommon","name":"Sweet Sixteen","condition":"Reach exactly 320 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":320},{"key":"idea_exact_17","category":"Exact numbers","rarity":"Rare","name":"Seventeen Again","condition":"Reach exactly 340 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":340},{"key":"idea_exact_18","category":"Exact numbers","rarity":"Uncommon","name":"Finally Eighteen","condition":"Reach exactly 360 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":360},{"key":"idea_exact_19","category":"Exact numbers","rarity":"Rare","name":"Nineteen Ninety-Nine-ish","condition":"Reach exactly 380 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":380},{"key":"idea_exact_22","category":"Exact numbers","rarity":"Rare","name":"Double Deuces","condition":"Reach exactly 440 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":440},{"key":"idea_exact_23","category":"Exact numbers","rarity":"Epic","name":"Twenty-Three","condition":"Reach exactly 460 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":460},{"key":"idea_exact_26","category":"Exact numbers","rarity":"Epic","name":"Twenty-Six Letters","condition":"Reach exactly 520 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":520},{"key":"idea_exact_27","category":"Exact numbers","rarity":"Rare","name":"Three Cubed","condition":"Reach exactly 540 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":540},{"key":"idea_exact_28","category":"Exact numbers","rarity":"Epic","name":"February Forever","condition":"Reach exactly 560 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":560},{"key":"idea_exact_32","category":"Exact numbers","rarity":"Epic","name":"Thirty-Two Bits","condition":"Reach exactly 640 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":640},{"key":"idea_exact_34","category":"Exact numbers","rarity":"Epic","name":"Thirty-Four","condition":"Reach exactly 680 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":680},{"key":"idea_exact_36","category":"Exact numbers","rarity":"Rare","name":"Square Six","condition":"Reach exactly 720 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":720},{"key":"idea_exact_40","category":"Exact numbers","rarity":"Epic","name":"Over the Hill","condition":"Reach exactly 800 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":800},{"key":"idea_exact_44","category":"Exact numbers","rarity":"Anomaly","name":"Forty-Four","condition":"Reach exactly 880 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":880},{"key":"idea_exact_49","category":"Exact numbers","rarity":"Anomaly","name":"Seven Squared","condition":"Reach exactly 980 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":980},{"key":"idea_exact_60","category":"Exact numbers","rarity":"Anomaly","name":"One Minute","condition":"Reach exactly 1,200 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1200},{"key":"idea_exact_64","category":"Exact numbers","rarity":"Mythic","name":"Sixty-Four Bits","condition":"Reach exactly 1,280 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1280},{"key":"idea_exact_81","category":"Exact numbers","rarity":"Mythic","name":"Nine Squared","condition":"Reach exactly 1,620 accumulated points at least once during one official Daily; the final score may be higher.","rule":"hit_exact","target":1620},{"key":"idea_seq_94","category":"Wheel combinations","rarity":"Rare","name":"Duck Sandwich","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → number → Duck.","rule":"sequence","pattern":["duck","num","duck"]},{"key":"idea_seq_95","category":"Wheel combinations","rarity":"Rare","name":"Double Duck","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → Duck.","rule":"sequence","pattern":["double","duck"]},{"key":"idea_seq_96","category":"Wheel combinations","rarity":"Rare","name":"Duck Double","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → ×2.","rule":"sequence","pattern":["duck","double"]},{"key":"idea_seq_97","category":"Wheel combinations","rarity":"Epic","name":"Upgrade Then Double","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → ×2.","rule":"sequence","pattern":["upgrade","double"]},{"key":"idea_seq_98","category":"Wheel combinations","rarity":"Rare","name":"Double Then Upgrade","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → Upgrade.","rule":"sequence","pattern":["double","upgrade"]},{"key":"idea_seq_99","category":"Wheel combinations","rarity":"Mythic","name":"Bonus Bookends","condition":"Get these consecutive spin-result types in one official Daily: +2 Spins → Duck → +2 Spins.","rule":"sequence","pattern":["spins","duck","spins"]},{"key":"idea_seq_100","category":"Wheel combinations","rarity":"Anomaly","name":"Freebie Parade","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → ×2 → Duck.","rule":"sequence","pattern":["duck","double","duck"]},{"key":"idea_seq_101","category":"Wheel combinations","rarity":"Mythic","name":"Triple Threat","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → ×2 → +2 Spins.","rule":"sequence","pattern":["duck","double","spins"]},{"key":"idea_seq_102","category":"Wheel combinations","rarity":"Mythic","name":"Special Delivery","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → +2 Spins → Duck.","rule":"sequence","pattern":["upgrade","spins","duck"]},{"key":"idea_seq_103","category":"Wheel combinations","rarity":"Anomaly","name":"Duck Upgrade Duck","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → Upgrade → Duck.","rule":"sequence","pattern":["duck","upgrade","duck"]},{"key":"idea_seq_104","category":"Wheel combinations","rarity":"Mythic","name":"The Accelerator","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → Upgrade → ×2.","rule":"sequence","pattern":["double","upgrade","double"]},{"key":"idea_seq_105","category":"Wheel combinations","rarity":"Common","name":"The Detour","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: number → Duck → number.","rule":"sequence","pattern":["num","duck","num"]},{"key":"idea_seq_106","category":"Wheel combinations","rarity":"Uncommon","name":"Back on Track","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: number → Upgrade → number.","rule":"sequence","pattern":["num","upgrade","num"]},{"key":"idea_seq_107","category":"Wheel combinations","rarity":"Epic","name":"Ups And Downs","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → number → ×2.","rule":"sequence","pattern":["upgrade","num","double"]},{"key":"idea_seq_108","category":"Wheel combinations","rarity":"Uncommon","name":"Duck Duck Number","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → Duck → number.","rule":"sequence","pattern":["duck","duck","num"]},{"key":"idea_seq_109","category":"Wheel combinations","rarity":"Rare","name":"Upward Duck","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → Duck.","rule":"sequence","pattern":["upgrade","duck"]},{"key":"idea_seq_110","category":"Wheel combinations","rarity":"Anomaly","name":"Pond Multiplier","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → Duck → ×2.","rule":"sequence","pattern":["duck","duck","double"]},{"key":"idea_seq_111","category":"Wheel combinations","rarity":"Uncommon","name":"A Little Extra","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: number → +2 Spins → number.","rule":"sequence","pattern":["num","spins","num"]},{"key":"idea_seq_112","category":"Wheel combinations","rarity":"Epic","name":"Spin Sandwich","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: +2 Spins → number → +2 Spins.","rule":"sequence","pattern":["spins","num","spins"]},{"key":"idea_seq_113","category":"Wheel combinations","rarity":"Mythic","name":"Three Specials","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → Upgrade → +2 Spins.","rule":"sequence","pattern":["duck","upgrade","spins"]},{"key":"idea_seq_114","category":"Wheel combinations","rarity":"Mythic","name":"Lucky Interrupt","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → Duck → ×2.","rule":"sequence","pattern":["double","duck","double"]},{"key":"idea_seq_115","category":"Wheel combinations","rarity":"Anomaly","name":"The Upgrade Train","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: number → Upgrade → Upgrade.","rule":"sequence","pattern":["num","upgrade","upgrade"]},{"key":"idea_seq_116","category":"Wheel combinations","rarity":"Uncommon","name":"Duck Crossing","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: number → Duck → Duck.","rule":"sequence","pattern":["num","duck","duck"]},{"key":"idea_seq_117","category":"Wheel combinations","rarity":"Mythic","name":"Round Trip","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → Duck → Upgrade.","rule":"sequence","pattern":["upgrade","duck","upgrade"]},{"key":"idea_seq_118","category":"Wheel combinations","rarity":"Anomaly","name":"Two Extra Ducks","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: +2 Spins → Duck → Duck.","rule":"sequence","pattern":["spins","duck","duck"]},{"key":"idea_seq_119","category":"Wheel combinations","rarity":"Rare","name":"Double Relief","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → +2 Spins.","rule":"sequence","pattern":["double","spins"]},{"key":"idea_seq_120","category":"Wheel combinations","rarity":"Rare","name":"Bonus Multiplier","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: +2 Spins → ×2.","rule":"sequence","pattern":["spins","double"]},{"key":"idea_seq_121","category":"Wheel combinations","rarity":"Epic","name":"Upgrade Detour","condition":"Get these consecutive spin-result types in one official Daily: Upgrade → number → Duck.","rule":"sequence","pattern":["upgrade","num","duck"]},{"key":"idea_seq_122","category":"Wheel combinations","rarity":"Mythic","name":"Double Bonus Duck","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → +2 Spins → Duck.","rule":"sequence","pattern":["double","spins","duck"]},{"key":"idea_seq_123","category":"Wheel combinations","rarity":"Rare","name":"Duck Double Number","condition":"Get these consecutive spin-result types in one official Daily: Duck → ×2 → number.","rule":"sequence","pattern":["duck","double","num"]},{"key":"idea_seq_124","category":"Wheel combinations","rarity":"Mythic","name":"Special Spiral","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → ×2 → +2 Spins.","rule":"sequence","pattern":["upgrade","double","spins"]},{"key":"idea_seq_125","category":"Wheel combinations","rarity":"Epic","name":"The Encore","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: number → +2 Spins → ×2.","rule":"sequence","pattern":["num","spins","double"]},{"key":"idea_seq_126","category":"Wheel combinations","rarity":"Epic","name":"Duck Loop","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Duck → number → number → Duck.","rule":"sequence","pattern":["duck","num","num","duck"]},{"key":"idea_seq_127","category":"Wheel combinations","rarity":"Mythic","name":"High Gear","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: Upgrade → Upgrade → ×2.","rule":"sequence","pattern":["upgrade","upgrade","double"]},{"key":"idea_seq_128","category":"Wheel combinations","rarity":"Mythic","name":"Double Duck Bonus","condition":"Get these consecutive spin-result types, in this exact order, during one official Daily: ×2 → Duck → +2 Spins.","rule":"sequence","pattern":["double","duck","spins"]},{"key":"idea_run_129","category":"Single-run challenges","rarity":"Rare","name":"All Numbers","condition":"Use all five starting spins on number results, with no bonus or free-spin outcomes.","rule":"challenge","number":129},{"key":"idea_run_130","category":"Single-run challenges","rarity":"Common","name":"No Ducks Allowed","condition":"Finish an official Daily without landing on a Duck.","rule":"challenge","number":130},{"key":"idea_run_131","category":"Single-run challenges","rarity":"Common","name":"Pond Visitor","condition":"Finish an official Daily with exactly one Duck.","rule":"challenge","number":131},{"key":"idea_run_132","category":"Single-run challenges","rarity":"Uncommon","name":"Two Ducks Only","condition":"Finish an official Daily with exactly two Ducks.","rule":"challenge","number":132},{"key":"idea_run_133","category":"Single-run challenges","rarity":"Common","name":"No Doubling Down","condition":"Finish an official Daily without landing on ×2.","rule":"challenge","number":133},{"key":"idea_run_134","category":"Single-run challenges","rarity":"Common","name":"Multiplier Minimalist","condition":"Finish an official Daily with exactly one ×2 result.","rule":"challenge","number":134},{"key":"idea_run_135","category":"Single-run challenges","rarity":"Common","name":"No Upgrade Required","condition":"Finish an official Daily without landing on Upgrade.","rule":"challenge","number":135},{"key":"idea_run_136","category":"Single-run challenges","rarity":"Common","name":"One Upgrade Only","condition":"Finish an official Daily with exactly one Upgrade.","rule":"challenge","number":136},{"key":"idea_run_137","category":"Single-run challenges","rarity":"Common","name":"Bonus-Free Day","condition":"Finish an official Daily without landing on +2 Spins.","rule":"challenge","number":137},{"key":"idea_run_138","category":"Single-run challenges","rarity":"Uncommon","name":"One More Round","condition":"Finish an official Daily with exactly one +2 Spins result.","rule":"challenge","number":138},{"key":"idea_run_139","category":"Single-run challenges","rarity":"Uncommon","name":"All Four Specials","condition":"Land at least one Duck, ×2, Upgrade, and +2 Spins during the same official Daily.","rule":"challenge","number":139},{"key":"idea_run_140","category":"Single-run challenges","rarity":"Common","name":"Duck And Double","condition":"Land at least one Duck and at least one ×2 during the same official Daily.","rule":"challenge","number":140},{"key":"idea_run_141","category":"Single-run challenges","rarity":"Common","name":"Duck And Upgrade","condition":"Land at least one Duck and at least one Upgrade during the same official Daily.","rule":"challenge","number":141},{"key":"idea_run_142","category":"Single-run challenges","rarity":"Common","name":"Duck And Bonus","condition":"Land at least one Duck and at least one +2 Spins during the same official Daily.","rule":"challenge","number":142},{"key":"idea_run_143","category":"Single-run challenges","rarity":"Uncommon","name":"Double And Upgrade","condition":"Land at least one ×2 and at least one Upgrade during the same official Daily.","rule":"challenge","number":143},{"key":"idea_run_144","category":"Single-run challenges","rarity":"Uncommon","name":"Double And Bonus","condition":"Land at least one ×2 and at least one +2 Spins during the same official Daily.","rule":"challenge","number":144},{"key":"idea_run_145","category":"Single-run challenges","rarity":"Uncommon","name":"Upgrade And Bonus","condition":"Land at least one Upgrade and at least one +2 Spins during the same official Daily.","rule":"challenge","number":145},{"key":"idea_run_146","category":"Single-run challenges","rarity":"Common","name":"Eight Spins","condition":"Complete at least 8 total wheel spins in one official Daily.","rule":"challenge","number":146},{"key":"idea_run_147","category":"Single-run challenges","rarity":"Common","name":"Ten Spins","condition":"Complete at least 10 total wheel spins in one official Daily.","rule":"challenge","number":147},{"key":"idea_run_148","category":"Single-run challenges","rarity":"Uncommon","name":"Twelve Spins","condition":"Complete at least 12 total wheel spins in one official Daily.","rule":"challenge","number":148},{"key":"idea_run_149","category":"Single-run challenges","rarity":"Uncommon","name":"Odd Squad","condition":"Land base-number 20, base-number 60, and base-number 80 at least once each during the same completed official Daily run.","rule":"challenge","number":149},{"key":"idea_run_150","category":"Single-run challenges","rarity":"Common","name":"One Is Enough","condition":"Land base number 20 at least once in one official Daily.","rule":"challenge","number":150},{"key":"idea_run_151","category":"Single-run challenges","rarity":"Common","name":"Two by Two","condition":"Land base number 40 at least twice in one official Daily.","rule":"challenge","number":151},{"key":"idea_run_152","category":"Single-run challenges","rarity":"Common","name":"Five Alive Again","condition":"Land base number 80 at least once in one official Daily.","rule":"challenge","number":152},{"key":"idea_run_153","category":"Single-run challenges","rarity":"Epic","name":"Triple Three","condition":"Land base number 60 at least three times in one official Daily.","rule":"challenge","number":153},{"key":"idea_run_154","category":"Single-run challenges","rarity":"Rare","name":"No Ones","condition":"Finish an official Daily without landing on base number 20.","rule":"challenge","number":154},{"key":"idea_run_155","category":"Single-run challenges","rarity":"Epic","name":"All Ones","condition":"Land on base number 20 at least five times during one official Daily (not necessarily consecutive).","rule":"challenge","number":155},{"key":"idea_run_156","category":"Single-run challenges","rarity":"Rare","name":"Four of a Kind","condition":"Land the same base number on four consecutive numerical spins in one official Daily.","rule":"challenge","number":156},{"key":"idea_run_157","category":"Single-run challenges","rarity":"Common","name":"Quite a Turnaround","condition":"After at least one Upgrade, land a numerical spin worth 300 or more points.","rule":"challenge","number":157},{"key":"idea_run_158","category":"Single-run challenges","rarity":"Uncommon","name":"Big Single Hit","condition":"Land a single numerical spin worth at least 600 points in one official Daily.","rule":"challenge","number":158},{"key":"idea_lifetime_159","category":"Lifetime milestones","rarity":"Common","name":"Welcome Back","condition":"Complete at least 1 official Daily run; Test Runs do not count.","rule":"lifetime_runs","target":1},{"key":"idea_lifetime_160","category":"Lifetime milestones","rarity":"Common","name":"First Week","condition":"Complete at least 7 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":7},{"key":"idea_lifetime_161","category":"Lifetime milestones","rarity":"Uncommon","name":"Daily Explorer","condition":"Complete at least 25 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":25},{"key":"idea_lifetime_162","category":"Lifetime milestones","rarity":"Rare","name":"Monthly Regular","condition":"Complete at least 60 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":60},{"key":"idea_lifetime_163","category":"Lifetime milestones","rarity":"Epic","name":"Getting Serious","condition":"Complete at least 120 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":120},{"key":"idea_lifetime_164","category":"Lifetime milestones","rarity":"Anomaly","name":"Two Hundred Club","condition":"Complete at least 200 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":200},{"key":"idea_lifetime_165","category":"Lifetime milestones","rarity":"Anomaly","name":"Three Hundred Strong","condition":"Complete at least 300 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":300},{"key":"idea_lifetime_166","category":"Lifetime milestones","rarity":"Mythic","name":"Four Fifty","condition":"Complete at least 450 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":450},{"key":"idea_lifetime_167","category":"Lifetime milestones","rarity":"Mythic","name":"Six Fifty","condition":"Complete at least 650 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":650},{"key":"idea_lifetime_168","category":"Lifetime milestones","rarity":"Mythic","name":"The Thousandth Spin","condition":"Complete at least 1000 official Daily runs over your account lifetime; Test Runs excluded.","rule":"lifetime_runs","target":1000},{"key":"idea_lifetime_169","category":"Lifetime milestones","rarity":"Common","name":"First Quack","condition":"Land 1 or more Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":1},{"key":"idea_lifetime_170","category":"Lifetime milestones","rarity":"Uncommon","name":"Pond Regular","condition":"Land 25 or more Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":25},{"key":"idea_lifetime_171","category":"Lifetime milestones","rarity":"Rare","name":"Duck Enthusiast","condition":"Land 75 or more Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":75},{"key":"idea_lifetime_172","category":"Lifetime milestones","rarity":"Epic","name":"Flock Collector","condition":"Land 150 or more Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":150},{"key":"idea_lifetime_173","category":"Lifetime milestones","rarity":"Anomaly","name":"Duck Dynasty","condition":"Land 300 or more Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":300},{"key":"idea_lifetime_174","category":"Lifetime milestones","rarity":"Common","name":"First Double","condition":"Land 1 or more ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":1},{"key":"idea_lifetime_175","category":"Lifetime milestones","rarity":"Uncommon","name":"Double Digits","condition":"Land 15 or more ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":15},{"key":"idea_lifetime_176","category":"Lifetime milestones","rarity":"Rare","name":"Compound Interest","condition":"Land 50 or more ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":50},{"key":"idea_lifetime_177","category":"Lifetime milestones","rarity":"Epic","name":"Multiplier Veteran","condition":"Land 100 or more ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":100},{"key":"idea_lifetime_178","category":"Lifetime milestones","rarity":"Anomaly","name":"Master of Doubles","condition":"Land 200 or more ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":200},{"key":"idea_lifetime_179","category":"Lifetime milestones","rarity":"Common","name":"Freebie","condition":"Land 1 or more +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":1},{"key":"idea_lifetime_180","category":"Lifetime milestones","rarity":"Uncommon","name":"Bonus Collector","condition":"Land 15 or more +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":15},{"key":"idea_lifetime_181","category":"Lifetime milestones","rarity":"Rare","name":"Second Wind Society","condition":"Land 50 or more +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":50},{"key":"idea_lifetime_182","category":"Lifetime milestones","rarity":"Epic","name":"Overtime Veteran","condition":"Land 100 or more +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":100},{"key":"idea_lifetime_183","category":"Lifetime milestones","rarity":"Anomaly","name":"Endless Encore","condition":"Land 200 or more +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":200},{"key":"idea_lifetime_184","category":"Lifetime milestones","rarity":"Common","name":"First Evolution","condition":"Land 1 or more Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":1},{"key":"idea_lifetime_185","category":"Lifetime milestones","rarity":"Uncommon","name":"Upgrade Regular","condition":"Land 15 or more Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":15},{"key":"idea_lifetime_186","category":"Lifetime milestones","rarity":"Rare","name":"Evolving Fast","condition":"Land 50 or more Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":50},{"key":"idea_lifetime_187","category":"Lifetime milestones","rarity":"Epic","name":"Upgrade Specialist","condition":"Land 100 or more Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":100},{"key":"idea_lifetime_188","category":"Lifetime milestones","rarity":"Anomaly","name":"Fully Evolved","condition":"Land 200 or more Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":200},{"key":"idea_lifetime_189","category":"Lifetime milestones","rarity":"Common","name":"Wheel Historian 25","condition":"Accumulate at least 25 actual wheel spins across completed official Daily runs; Test Runs excluded.","rule":"lifetime_spins","target":25},{"key":"idea_lifetime_190","category":"Lifetime milestones","rarity":"Uncommon","name":"First Hundred Spins","condition":"Accumulate at least 100 actual wheel spins across completed official Daily runs; Test Runs excluded.","rule":"lifetime_spins","target":100},{"key":"idea_lifetime_191","category":"Lifetime milestones","rarity":"Rare","name":"Wheel Historian 350","condition":"Accumulate at least 350 actual wheel spins across completed official Daily runs; Test Runs excluded.","rule":"lifetime_spins","target":350},{"key":"idea_lifetime_192","category":"Lifetime milestones","rarity":"Epic","name":"Wheel Historian 900","condition":"Accumulate at least 900 actual wheel spins across completed official Daily runs; Test Runs excluded.","rule":"lifetime_spins","target":900},{"key":"idea_lifetime_193","category":"Lifetime milestones","rarity":"Anomaly","name":"Wheel Historian 2000","condition":"Accumulate at least 2000 actual wheel spins across completed official Daily runs; Test Runs excluded.","rule":"lifetime_spins","target":2000},{"key":"idea_daily_streak_2","category":"Daily streaks","rarity":"Common","name":"See You Tomorrow","condition":"Complete 2 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":2},{"key":"idea_daily_streak_3","category":"Daily streaks","rarity":"Common","name":"Five-Day Habit","condition":"Complete 5 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":5},{"key":"idea_daily_streak_4","category":"Daily streaks","rarity":"Uncommon","name":"Ten-Day Orbit","condition":"Complete 10 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":10},{"key":"idea_daily_streak_5","category":"Daily streaks","rarity":"Uncommon","name":"Twenty Straight","condition":"Complete 20 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":20},{"key":"idea_daily_streak_6","category":"Daily streaks","rarity":"Rare","name":"Thirty-Five Straight","condition":"Complete 35 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":35},{"key":"idea_daily_streak_7","category":"Daily streaks","rarity":"Rare","name":"Fifty Straight","condition":"Complete 50 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":50},{"key":"idea_daily_streak_10","category":"Daily streaks","rarity":"Rare","name":"Seventy-Five Straight","condition":"Complete 75 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":75},{"key":"idea_daily_streak_14","category":"Daily streaks","rarity":"Epic","name":"Centurion Streak","condition":"Complete 100 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":100},{"key":"idea_daily_streak_21","category":"Daily streaks","rarity":"Epic","name":"Five Months Straight","condition":"Complete 150 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":150},{"key":"idea_daily_streak_30","category":"Daily streaks","rarity":"Anomaly","name":"Two Hundred Straight","condition":"Complete 200 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":200},{"key":"idea_daily_streak_45","category":"Daily streaks","rarity":"Anomaly","name":"Three Hundred Straight","condition":"Complete 300 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":300},{"key":"idea_daily_streak_60","category":"Daily streaks","rarity":"Mythic","name":"Four Hundred Straight","condition":"Complete 400 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":400},{"key":"idea_daily_streak_90","category":"Daily streaks","rarity":"Mythic","name":"Five Hundred Straight","condition":"Complete 500 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":500},{"key":"idea_daily_streak_120","category":"Daily streaks","rarity":"Mythic","name":"Six Fifty Straight","condition":"Complete 650 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":650},{"key":"idea_daily_streak_180","category":"Daily streaks","rarity":"Mythic","name":"The Thousand-Day Streak","condition":"Complete 1000 consecutive Crilo Daily periods without a missed period; only official Daily runs count.","rule":"daily_streak","target":1000},{"key":"idea_rank_209","category":"Leaderboard","rarity":"Rare","name":"First Appearance","condition":"Finish any completed Daily in the public Top 100 for that Daily period.","rule":"leaderboard"},{"key":"idea_rank_210","category":"Leaderboard","rarity":"Rare","name":"Top Fifty","condition":"Finish any Daily within Top 50.","rule":"leaderboard"},{"key":"idea_rank_211","category":"Leaderboard","rarity":"Epic","name":"Top Twenty-Five","condition":"Finish any Daily within Top 25.","rule":"leaderboard"},{"key":"idea_rank_212","category":"Leaderboard","rarity":"Epic","name":"Top Ten Ticket","condition":"Finish any Daily within Top 10.","rule":"leaderboard"},{"key":"idea_rank_213","category":"Leaderboard","rarity":"Anomaly","name":"Top Five Club","condition":"Finish any Daily within Top 5.","rule":"leaderboard"},{"key":"idea_rank_214","category":"Leaderboard","rarity":"Mythic","name":"On the Podium","condition":"Finish any Daily within Top 3.","rule":"leaderboard"},{"key":"idea_rank_215","category":"Leaderboard","rarity":"Mythic","name":"Runner Up","condition":"Finish any Daily at #2.","rule":"leaderboard"},{"key":"idea_rank_216","category":"Leaderboard","rarity":"Mythic","name":"Bronze Day","condition":"Finish any Daily at #3.","rule":"leaderboard"},{"key":"idea_rank_217","category":"Leaderboard","rarity":"Mythic","name":"Daily Champion","condition":"Finish any Daily at #1.","rule":"leaderboard"},{"key":"idea_rank_218","category":"Leaderboard","rarity":"Epic","name":"Twice on the Board","condition":"Finish within Top 100 on 2 distinct Daily periods.","rule":"leaderboard"},{"key":"idea_rank_219","category":"Leaderboard","rarity":"Epic","name":"Five Appearances","condition":"Finish within Top 100 on 5 distinct Daily periods.","rule":"leaderboard"},{"key":"idea_rank_220","category":"Leaderboard","rarity":"Epic","name":"Ten Appearances","condition":"Finish within Top 100 on 10 distinct Daily periods.","rule":"leaderboard"},{"key":"idea_rank_221","category":"Leaderboard","rarity":"Epic","name":"Repeat Top Ten","condition":"Finish within Top 10 on 2 distinct Daily periods.","rule":"leaderboard"},{"key":"idea_rank_222","category":"Leaderboard","rarity":"Anomaly","name":"Five Top Tens","condition":"Finish within Top 10 on 5 distinct Daily periods.","rule":"leaderboard"},{"key":"idea_rank_223","category":"Leaderboard","rarity":"Mythic","name":"Double Crown","condition":"Finish at #1 on 2 distinct Daily periods.","rule":"leaderboard"},{"key":"idea_social_224","category":"Social","rarity":"Common","name":"First Friend","condition":"Have at least one accepted mutual Crilo friendship.","rule":"social"},{"key":"idea_social_225","category":"Social","rarity":"Uncommon","name":"Three Is Company","condition":"Have at least 3 accepted mutual Crilo friendships.","rule":"social"},{"key":"idea_social_226","category":"Social","rarity":"Rare","name":"Five Friends","condition":"Have at least 5 accepted mutual Crilo friendships.","rule":"social"},{"key":"idea_social_227","category":"Social","rarity":"Epic","name":"Ten Friends","condition":"Have at least 10 accepted mutual Crilo friendships.","rule":"social"},{"key":"idea_social_228","category":"Social","rarity":"Anomaly","name":"Twenty Friends","condition":"Have at least 20 accepted mutual Crilo friendships.","rule":"social"},{"key":"idea_social_229","category":"Social","rarity":"Uncommon","name":"Friendly Challenger","condition":"Beat an accepted friend’s official score in the same Daily period once.","rule":"social"},{"key":"idea_social_230","category":"Social","rarity":"Anomaly","name":"Friendly Rivalry","condition":"Beat an accepted friend’s official score on 5 distinct Daily periods.","rule":"social"},{"key":"idea_social_231","category":"Social","rarity":"Rare","name":"Close Competition","condition":"Finish within 5 score points of an accepted friend during one same-period Daily.","rule":"social"},{"key":"idea_social_232","category":"Social","rarity":"Anomaly","name":"Friend on Top","condition":"Have at least one friend finish #1 on a finalized Daily leaderboard.","rule":"social"},{"key":"idea_social_233","category":"Social","rarity":"Uncommon","name":"Mutual High Five","condition":"On a single Daily period, you and an accepted friend both finish a completed official Daily.","rule":"social"},{"key":"idea_art_234","category":"Drawing","rarity":"Common","name":"First Scribble","condition":"Submit a nonblank drawing with your completed official Daily.","rule":"drawing"},{"key":"idea_art_235","category":"Drawing","rarity":"Common","name":"Drawn Twice","condition":"Submit nonblank drawings on 2 distinct completed official Dailies.","rule":"drawing"},{"key":"idea_art_236","category":"Drawing","rarity":"Common","name":"Sketchbook Five","condition":"Submit nonblank drawings on 5 distinct completed official Dailies.","rule":"drawing"},{"key":"idea_art_237","category":"Drawing","rarity":"Uncommon","name":"Sketchbook Ten","condition":"Submit nonblank drawings on 10 distinct completed official Dailies.","rule":"drawing"},{"key":"idea_art_238","category":"Drawing","rarity":"Uncommon","name":"Sketchbook Twenty","condition":"Submit nonblank drawings on 20 distinct completed official Dailies.","rule":"drawing"},{"key":"idea_art_239","category":"Drawing","rarity":"Common","name":"Pen Pals","condition":"On one Daily period, you and an accepted friend each submit a nonblank drawing.","rule":"drawing"},{"key":"idea_art_240","category":"Drawing","rarity":"Epic","name":"Illustrated Week","condition":"Submit nonblank drawings in 7 consecutive Crilo Daily periods.","rule":"drawing"},{"key":"idea_art_241","category":"Drawing","rarity":"Rare","name":"Thirty Drawings Later","condition":"Submit nonblank drawings on 30 distinct completed official Dailies.","rule":"drawing"},{"key":"idea_edges_242","category":"Opening & final spins","rarity":"Uncommon","name":"Duck at the Door","condition":"Your very first spin of an official Daily lands on Duck.","rule":"first_event","event":"duck"},{"key":"idea_edges_243","category":"Opening & final spins","rarity":"Rare","name":"Double Entrance","condition":"Your very first spin of an official Daily lands on ×2.","rule":"first_event","event":"double"},{"key":"idea_edges_244","category":"Opening & final spins","rarity":"Rare","name":"Upgrade Entrance","condition":"Your very first spin of an official Daily lands on Upgrade.","rule":"first_event","event":"upgrade"},{"key":"idea_edges_245","category":"Opening & final spins","rarity":"Rare","name":"Extra Entrance","condition":"Your very first spin of an official Daily lands on +2 Spins.","rule":"first_event","event":"spins"},{"key":"idea_edges_246","category":"Opening & final spins","rarity":"Common","name":"Last Little One","condition":"Your final spin of an official Daily lands on a base number 20.","rule":"final_base","base":20},{"key":"idea_edges_247","category":"Opening & final spins","rarity":"Uncommon","name":"Last Little Two","condition":"Your final spin of an official Daily lands on a base number 40.","rule":"final_base","base":40},{"key":"idea_edges_248","category":"Opening & final spins","rarity":"Uncommon","name":"Last Little Three","condition":"Your final spin of an official Daily lands on a base number 60.","rule":"final_base","base":60},{"key":"idea_edges_249","category":"Opening & final spins","rarity":"Uncommon","name":"Last Big Five","condition":"Your final spin of an official Daily lands on a base number 80.","rule":"final_base","base":80},{"key":"proposal_linear_001","category":"Lifetime collections","rarity":"Uncommon","name":"Number Apprentice","condition":"Record at least 100 number results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"num","target":100},{"key":"proposal_linear_002","category":"Lifetime collections","rarity":"Rare","name":"Number Veteran","condition":"Record at least 500 number results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"num","target":500},{"key":"proposal_linear_003","category":"Lifetime collections","rarity":"Anomaly","name":"Pond Historian","condition":"Record at least 450 Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":450},{"key":"proposal_linear_004","category":"Lifetime collections","rarity":"Mythic","name":"Quackologist","condition":"Record at least 750 Duck results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"duck","target":750},{"key":"proposal_linear_005","category":"Lifetime collections","rarity":"Mythic","name":"Double Archivist","condition":"Record at least 300 ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":300},{"key":"proposal_linear_006","category":"Lifetime collections","rarity":"Mythic","name":"Doubling Legend","condition":"Record at least 500 ×2 results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"double","target":500},{"key":"proposal_linear_007","category":"Lifetime collections","rarity":"Mythic","name":"Bonus Archivist","condition":"Record at least 300 +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":300},{"key":"proposal_linear_008","category":"Lifetime collections","rarity":"Mythic","name":"Bonus Legend","condition":"Record at least 500 +2 Spins results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"spins","target":500},{"key":"proposal_linear_009","category":"Lifetime collections","rarity":"Mythic","name":"Evolution Archivist","condition":"Record at least 300 Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":300},{"key":"proposal_linear_010","category":"Lifetime collections","rarity":"Mythic","name":"Evolution Legend","condition":"Record at least 500 Upgrade results across completed official Daily runs; Test Runs excluded.","rule":"lifetime_event","event":"upgrade","target":500},{"key":"proposal_linear_011","category":"Lifetime number slices","rarity":"Uncommon","name":"Base 1 Collector 25","condition":"Land the base-number 20 slice at least 25 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":20,"target":25},{"key":"proposal_linear_012","category":"Lifetime number slices","rarity":"Rare","name":"Base 1 Collector 150","condition":"Land the base-number 20 slice at least 150 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":20,"target":150},{"key":"proposal_linear_013","category":"Lifetime number slices","rarity":"Uncommon","name":"Base 2 Collector 25","condition":"Land the base-number 40 slice at least 25 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":40,"target":25},{"key":"proposal_linear_014","category":"Lifetime number slices","rarity":"Epic","name":"Base 2 Collector 150","condition":"Land the base-number 40 slice at least 150 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":40,"target":150},{"key":"proposal_linear_015","category":"Lifetime number slices","rarity":"Uncommon","name":"Base 3 Collector 25","condition":"Land the base-number 60 slice at least 25 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":60,"target":25},{"key":"proposal_linear_016","category":"Lifetime number slices","rarity":"Epic","name":"Base 3 Collector 150","condition":"Land the base-number 60 slice at least 150 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":60,"target":150},{"key":"proposal_linear_017","category":"Lifetime number slices","rarity":"Uncommon","name":"Base 5 Collector 25","condition":"Land the base-number 80 slice at least 25 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":80,"target":25},{"key":"proposal_linear_018","category":"Lifetime number slices","rarity":"Epic","name":"Base 5 Collector 150","condition":"Land the base-number 80 slice at least 150 times across completed official Daily runs (before Upgrade multipliers).","rule":"lifetime_base","base":80,"target":150},{"key":"proposal_linear_019","category":"Spin positions","rarity":"Common","name":"Number on Spin 1","condition":"On the 1st actual spin of an official Daily run, land any number slice.","rule":"spin_position","target":1},{"key":"proposal_linear_020","category":"Spin positions","rarity":"Common","name":"Number on Spin 2","condition":"On the 2nd actual spin of an official Daily run, land any number slice.","rule":"spin_position","target":2},{"key":"proposal_linear_021","category":"Spin positions","rarity":"Common","name":"Number on Spin 3","condition":"On the 3rd actual spin of an official Daily run, land any number slice.","rule":"spin_position","target":3},{"key":"proposal_linear_022","category":"Spin positions","rarity":"Common","name":"Number on Spin 4","condition":"On the 4th actual spin of an official Daily run, land any number slice.","rule":"spin_position","target":4},{"key":"proposal_linear_023","category":"Spin positions","rarity":"Common","name":"Number on Spin 5","condition":"On the 5th actual spin of an official Daily run, land any number slice.","rule":"spin_position","target":5},{"key":"proposal_linear_024","category":"Number slice patterns","rarity":"Common","name":"Ones in the Mix 2","condition":"Land at least 2 base-number 20 slices during the same completed official Daily run (not necessarily consecutive).","rule":"base_total","base":20,"target":2},{"key":"proposal_linear_025","category":"Number slice patterns","rarity":"Common","name":"Ones in the Mix 3","condition":"Land at least 3 base-number 20 slices during the same completed official Daily run (not necessarily consecutive).","rule":"base_total","base":20,"target":3},{"key":"proposal_linear_026","category":"Number slice patterns","rarity":"Uncommon","name":"Two Twos Together","condition":"Land base-number 40 on two consecutive actual spins during one completed official Daily run.","rule":"base_sequence","pattern":[40,40]},{"key":"proposal_linear_027","category":"Number slice patterns","rarity":"Uncommon","name":"Twos in the Mix 3","condition":"Land at least 3 base-number 40 slices during the same completed official Daily run (not necessarily consecutive).","rule":"base_total","base":40,"target":3},{"key":"proposal_linear_028","category":"Number slice patterns","rarity":"Uncommon","name":"Threes in the Mix 2","condition":"Land at least 2 base-number 60 slices during the same completed official Daily run (not necessarily consecutive).","rule":"base_total","base":60,"target":2},{"key":"proposal_linear_029","category":"Number slice patterns","rarity":"Mythic","name":"Triple Threes in a Row","condition":"Land base-number 60 on three consecutive actual spins during one completed official Daily run.","rule":"base_sequence","pattern":[60,60,60]},{"key":"proposal_linear_030","category":"Number slice patterns","rarity":"Uncommon","name":"Fives in the Mix 2","condition":"Land at least 2 base-number 80 slices during the same completed official Daily run (not necessarily consecutive).","rule":"base_total","base":80,"target":2},{"key":"proposal_linear_031","category":"Number slice patterns","rarity":"Epic","name":"Fives in the Mix 3","condition":"Land at least 3 base-number 80 slices during the same completed official Daily run (not necessarily consecutive).","rule":"base_total","base":80,"target":3},{"key":"proposal_linear_032","category":"Number slice patterns","rarity":"Uncommon","name":"One-Two Pair","condition":"Get consecutive number slices with base values 1 then 2 in one official Daily run; Upgrades do not change their base values.","rule":"number_sequence","pattern":[20,40]},{"key":"proposal_linear_033","category":"Number slice patterns","rarity":"Uncommon","name":"Two-Three Pair","condition":"Get consecutive number slices with base values 2 then 3 in one official Daily run; Upgrades do not change their base values.","rule":"number_sequence","pattern":[40,60]},{"key":"proposal_linear_034","category":"Number slice patterns","rarity":"Rare","name":"Three-Five Pair","condition":"Get consecutive number slices with base values 3 then 5 in one official Daily run; Upgrades do not change their base values.","rule":"number_sequence","pattern":[60,80]},{"key":"proposal_linear_035","category":"Number slice patterns","rarity":"Uncommon","name":"One-Five Pair","condition":"Get consecutive number slices with base values 1 then 5 in one official Daily run; Upgrades do not change their base values.","rule":"number_sequence","pattern":[20,80]},{"key":"proposal_linear_036","category":"Wheel placement","rarity":"Rare","name":"Duck Opens, 1 Closes","condition":"On one official Daily, the first actual spin lands duck, and the final actual spin lands a base-number 20 slice (the last outcome must be a number).","rule":"first_last","first":"duck","last_base":20},{"key":"proposal_linear_037","category":"Wheel placement","rarity":"Epic","name":"Duck Opens, 2 Closes","condition":"On one official Daily, the first actual spin lands duck, and the final actual spin lands a base-number 40 slice (the last outcome must be a number).","rule":"first_last","first":"duck","last_base":40},{"key":"proposal_linear_038","category":"Wheel placement","rarity":"Epic","name":"Duck Opens, 5 Closes","condition":"On one official Daily, the first actual spin lands duck, and the final actual spin lands a base-number 80 slice (the last outcome must be a number).","rule":"first_last","first":"duck","last_base":80},{"key":"proposal_linear_039","category":"Wheel placement","rarity":"Epic","name":"Double Opens, 1 Closes","condition":"On one official Daily, the first actual spin lands double, and the final actual spin lands a base-number 20 slice (the last outcome must be a number).","rule":"first_last","first":"double","last_base":20},{"key":"proposal_linear_040","category":"Wheel placement","rarity":"Epic","name":"Double Opens, 2 Closes","condition":"On one official Daily, the first actual spin lands double, and the final actual spin lands a base-number 40 slice (the last outcome must be a number).","rule":"first_last","first":"double","last_base":40},{"key":"proposal_linear_041","category":"Wheel placement","rarity":"Anomaly","name":"Double Opens, 5 Closes","condition":"On one official Daily, the first actual spin lands double, and the final actual spin lands a base-number 80 slice (the last outcome must be a number).","rule":"first_last","first":"double","last_base":80},{"key":"proposal_linear_042","category":"Wheel placement","rarity":"Epic","name":"Bonus Opens, 1 Closes","condition":"On one official Daily, the first actual spin lands spins, and the final actual spin lands a base-number 20 slice (the last outcome must be a number).","rule":"first_last","first":"spins","last_base":20},{"key":"proposal_linear_043","category":"Wheel placement","rarity":"Epic","name":"Bonus Opens, 2 Closes","condition":"On one official Daily, the first actual spin lands spins, and the final actual spin lands a base-number 40 slice (the last outcome must be a number).","rule":"first_last","first":"spins","last_base":40},{"key":"proposal_linear_044","category":"Wheel placement","rarity":"Anomaly","name":"Bonus Opens, 5 Closes","condition":"On one official Daily, the first actual spin lands spins, and the final actual spin lands a base-number 80 slice (the last outcome must be a number).","rule":"first_last","first":"spins","last_base":80},{"key":"proposal_linear_045","category":"Wheel placement","rarity":"Epic","name":"Upgrade Opens, 1 Closes","condition":"On one official Daily, the first actual spin lands upgrade, and the final actual spin lands a base-number 20 slice (the last outcome must be a number).","rule":"first_last","first":"upgrade","last_base":20},{"key":"proposal_linear_046","category":"Wheel placement","rarity":"Epic","name":"Upgrade Opens, 2 Closes","condition":"On one official Daily, the first actual spin lands upgrade, and the final actual spin lands a base-number 40 slice (the last outcome must be a number).","rule":"first_last","first":"upgrade","last_base":40},{"key":"proposal_linear_047","category":"Wheel placement","rarity":"Anomaly","name":"Upgrade Opens, 5 Closes","condition":"On one official Daily, the first actual spin lands upgrade, and the final actual spin lands a base-number 80 slice (the last outcome must be a number).","rule":"first_last","first":"upgrade","last_base":80},{"key":"proposal_linear_048","category":"Wheel gap patterns","rarity":"Rare","name":"Duck–Number–Double","condition":"Land the exact consecutive spin-result sequence duck → number → double in one completed official Daily run.","rule":"sequence","pattern":["duck","num","double"]},{"key":"proposal_linear_049","category":"Wheel gap patterns","rarity":"Rare","name":"Duck–Number–Bonus","condition":"Land the exact consecutive spin-result sequence duck → number → spins in one completed official Daily run.","rule":"sequence","pattern":["duck","num","spins"]},{"key":"proposal_linear_050","category":"Wheel gap patterns","rarity":"Rare","name":"Duck–Number–Upgrade","condition":"Land the exact consecutive spin-result sequence duck → number → upgrade in one completed official Daily run.","rule":"sequence","pattern":["duck","num","upgrade"]},{"key":"proposal_linear_051","category":"Wheel gap patterns","rarity":"Rare","name":"Double–Number–Duck","condition":"Land the exact consecutive spin-result sequence double → number → duck in one completed official Daily run.","rule":"sequence","pattern":["double","num","duck"]},{"key":"proposal_linear_052","category":"Wheel gap patterns","rarity":"Epic","name":"Double–Number–Bonus","condition":"Land the exact consecutive spin-result sequence double → number → spins in one completed official Daily run.","rule":"sequence","pattern":["double","num","spins"]},{"key":"proposal_linear_053","category":"Wheel gap patterns","rarity":"Epic","name":"Double–Number–Upgrade","condition":"Land the exact consecutive spin-result sequence double → number → upgrade in one completed official Daily run.","rule":"sequence","pattern":["double","num","upgrade"]},{"key":"proposal_linear_054","category":"Wheel gap patterns","rarity":"Rare","name":"Bonus–Number–Duck","condition":"Land the exact consecutive spin-result sequence spins → number → duck in one completed official Daily run.","rule":"sequence","pattern":["spins","num","duck"]},{"key":"proposal_linear_055","category":"Wheel gap patterns","rarity":"Epic","name":"Bonus–Number–Double","condition":"Land the exact consecutive spin-result sequence spins → number → double in one completed official Daily run.","rule":"sequence","pattern":["spins","num","double"]},{"key":"proposal_linear_056","category":"Wheel gap patterns","rarity":"Epic","name":"Bonus–Number–Upgrade","condition":"Land the exact consecutive spin-result sequence spins → number → upgrade in one completed official Daily run.","rule":"sequence","pattern":["spins","num","upgrade"]},{"key":"proposal_linear_057","category":"Wheel gap patterns","rarity":"Epic","name":"Upgrade–Number–Bonus","condition":"Land the exact consecutive spin-result sequence upgrade → number → spins in one completed official Daily run.","rule":"sequence","pattern":["upgrade","num","spins"]},{"key":"proposal_explore_home_view","category":"Exploration & onboarding","rarity":"Common","name":"First Look","condition":"Open the Crilo Home page while signed in. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"home_view"},{"key":"proposal_explore_info_open","category":"Exploration & onboarding","rarity":"Common","name":"The Rulebook","condition":"Open the game's Info or instructions menu. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"info_open"},{"key":"proposal_explore_rarity_info","category":"Exploration & onboarding","rarity":"Common","name":"Odds Curious","condition":"Open the rarity explanation in the Info menu. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"rarity_info"},{"key":"proposal_explore_ducks_page","category":"Exploration & onboarding","rarity":"Common","name":"Around the Pond","condition":"Visit the Ducks page. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"ducks_page"},{"key":"proposal_explore_duck_details","category":"Exploration & onboarding","rarity":"Common","name":"Duck Detective","condition":"Open the detail view of any Duck. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"duck_details"},{"key":"proposal_explore_duck_sound","category":"Exploration & onboarding","rarity":"Common","name":"Quack Check","condition":"Play the sound of an unlocked Duck on the Ducks page. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"duck_sound"},{"key":"proposal_explore_badges_page","category":"Exploration & onboarding","rarity":"Common","name":"Trophy Case","condition":"Visit the Badge Collection section on your Player Profile while signed in.","rule":"exploration","event":"badges_page"},{"key":"proposal_explore_badge_detail","category":"Exploration & onboarding","rarity":"Common","name":"Open the Collection","condition":"Expand a category in the Badge Collection on your Player Profile.","rule":"exploration","event":"badge_detail"},{"key":"proposal_explore_badge_search","category":"Exploration & onboarding","rarity":"Common","name":"Featured Curator","condition":"Open the Featured Badge selection dialog on your Player Profile.","rule":"exploration","event":"badge_search"},{"key":"proposal_explore_badge_filter","category":"Exploration & onboarding","rarity":"Common","name":"Showcase Something","condition":"Set or change one of your Featured Badges on your Player Profile.","rule":"exploration","event":"badge_filter"},{"key":"proposal_explore_leaderboard_page","category":"Exploration & onboarding","rarity":"Common","name":"The Rankings","condition":"Visit the Leaderboard page. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"leaderboard_page"},{"key":"proposal_explore_daily_leaderboard","category":"Exploration & onboarding","rarity":"Common","name":"The Big Picture","condition":"Open the current Daily leaderboard. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"daily_leaderboard"},{"key":"proposal_linear_070","category":"Single-run number variety","rarity":"Common","name":"2 Different Digits","condition":"Land at least 2 distinct base-number values from {1,2,3,5} within one completed official Daily run.","rule":"variety","target":2},{"key":"proposal_linear_071","category":"Single-run number variety","rarity":"Common","name":"3 Different Digits","condition":"Land at least 3 distinct base-number values from {1,2,3,5} within one completed official Daily run.","rule":"variety","target":3},{"key":"proposal_linear_072","category":"Single-run number variety","rarity":"Uncommon","name":"4 Different Digits","condition":"Land at least 4 distinct base-number values from {1,2,3,5} within one completed official Daily run.","rule":"variety","target":4},{"key":"proposal_explore_other_player_profile","category":"Exploration & onboarding","rarity":"Common","name":"People Watching","condition":"Open another player's public profile from a ranking. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"other_player_profile"},{"key":"proposal_explore_profile_page","category":"Exploration & onboarding","rarity":"Common","name":"Numbers Person","condition":"Visit your Profile or Stats page. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"profile_page"},{"key":"proposal_explore_personal_best","category":"Exploration & onboarding","rarity":"Common","name":"Personal Best","condition":"Open your best-score statistics. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"personal_best"},{"key":"proposal_explore_run_history","category":"Exploration & onboarding","rarity":"Common","name":"Stat Inspector","condition":"Open the explanation of any statistic on your Player Profile.","rule":"exploration","event":"run_history"},{"key":"proposal_explore_settings_page","category":"Exploration & onboarding","rarity":"Common","name":"Getting Personal","condition":"Open Settings. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"settings_page"},{"key":"proposal_explore_dark_mode","category":"Exploration & onboarding","rarity":"Common","name":"Lights Out","condition":"Switch the site from light to dark mode. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"dark_mode"},{"key":"proposal_explore_light_mode","category":"Exploration & onboarding","rarity":"Common","name":"Let There Be Light","condition":"Switch the site from dark to light mode. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"light_mode"},{"key":"proposal_explore_name_color_saved","category":"Exploration & onboarding","rarity":"Common","name":"Pick Your Shade","condition":"Save a different display-name color in Settings. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"name_color_saved"},{"key":"proposal_explore_display_name_saved","category":"Exploration & onboarding","rarity":"Common","name":"New Identity","condition":"Save a changed display name. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"display_name_saved"},{"key":"proposal_explore_more_games_page","category":"Exploration & onboarding","rarity":"Common","name":"The Arcade","condition":"Visit More Games. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"more_games_page"},{"key":"proposal_explore_domain_open","category":"Exploration & onboarding","rarity":"Common","name":"Domain Curious","condition":"Open How Much Was the Domain? Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"domain_open"},{"key":"proposal_explore_domain_instructions","category":"Exploration & onboarding","rarity":"Common","name":"Domain 101","condition":"Open the instructions for How Much Was the Domain? Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"domain_instructions"},{"key":"proposal_explore_domain_guess","category":"Exploration & onboarding","rarity":"Common","name":"First Guess","condition":"Submit a guess in How Much Was the Domain?. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"domain_guess"},{"key":"proposal_explore_domain_set","category":"Exploration & onboarding","rarity":"Common","name":"Five for Five","condition":"Complete a five-question set in How Much Was the Domain?. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"domain_set"},{"key":"proposal_explore_drawing_canvas","category":"Exploration & onboarding","rarity":"Common","name":"Fill It In","condition":"Switch the drawing tool to Fill during an official Daily run.","rule":"exploration","event":"drawing_canvas"},{"key":"proposal_explore_drawing_mark","category":"Exploration & onboarding","rarity":"Common","name":"First Mark","condition":"Make at least one drawing mark during a Daily run. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"drawing_mark"},{"key":"proposal_explore_daily_run_screen","category":"Exploration & onboarding","rarity":"Common","name":"Wheel Ready","condition":"Enter the official Daily Run screen. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"daily_run_screen"},{"key":"proposal_explore_daily_results","category":"Exploration & onboarding","rarity":"Common","name":"Results Day","condition":"Open the completed-Daily results screen. Award only once per account upon a real signed-in user action; no Test Run badge awarding.","rule":"exploration","event":"daily_results"},{"key":"proposal_linear_091","category":"Four-outcome chains","rarity":"Epic","name":"Bonus Two Numbers Duck","condition":"Land the exact four-spin sequence spins → number → number → duck in one official Daily run.","rule":"sequence","pattern":["spins","num","num","duck"]},{"key":"proposal_linear_092","category":"Four-outcome chains","rarity":"Anomaly","name":"Bonus Two Numbers Double","condition":"Land the exact four-spin sequence spins → number → number → double in one official Daily run.","rule":"sequence","pattern":["spins","num","num","double"]},{"key":"proposal_linear_093","category":"Four-outcome chains","rarity":"Anomaly","name":"Bonus Two Numbers Upgrade","condition":"Land the exact four-spin sequence spins → number → number → upgrade in one official Daily run.","rule":"sequence","pattern":["spins","num","num","upgrade"]},{"key":"proposal_linear_094","category":"Four-outcome chains","rarity":"Epic","name":"Upgrade Two Numbers Duck","condition":"Land the exact four-spin sequence upgrade → number → number → duck in one official Daily run.","rule":"sequence","pattern":["upgrade","num","num","duck"]},{"key":"proposal_linear_095","category":"Four-outcome chains","rarity":"Anomaly","name":"Upgrade Two Numbers Double","condition":"Land the exact four-spin sequence upgrade → number → number → double in one official Daily run.","rule":"sequence","pattern":["upgrade","num","num","double"]},{"key":"proposal_linear_096","category":"Four-outcome chains","rarity":"Anomaly","name":"Upgrade Two Numbers Bonus","condition":"Land the exact four-spin sequence upgrade → number → number → spins in one official Daily run.","rule":"sequence","pattern":["upgrade","num","num","spins"]},{"key":"v2_score_rarity_divine","category":"Score rarity","rarity":"Epic","name":"Divine Score","condition":"Finish one official Daily with a final score of at least 14,421 points.","rule":"score_band","lower":14421,"upper":null,"probability_percent":0.0999}]$catalog$::jsonb))
update public.crilo_v3_badge_stage s set rule=src.obj,display_name=src.obj->>'name',
description=src.obj->>'condition',rarity=src.obj->>'rarity'
from src where s.badge_key=src.obj->>'key';

insert into public.badges(badge_key,name,description,category,requirement,is_secret,sort_order)
select s.badge_key,s.display_name,s.description,s.category,
jsonb_build_object('type','score_band','rarity','epic','min_score',14421,
'max_score',null,'probability_percent',0.0999,'simulation_runs',6000000),
false,coalesce((select max(sort_order)+1 from public.badges),350)
from public.crilo_v3_badge_stage s where s.badge_key='v2_score_rarity_divine'
on conflict(badge_key) do nothing;

update public.badges b set name=s.display_name,description=s.description,
requirement=case when s.rule->>'rule'='score_band'
then (coalesce(b.requirement,'{}'::jsonb)-'probability_percent') ||
 jsonb_build_object('type','score_band',
 'min_score',(s.rule->>'lower')::bigint,
 'max_score',case when s.rule->>'upper' is null then null else (s.rule->>'upper')::bigint end,
 'rarity',lower(coalesce(b.requirement->>'rarity',s.rarity)),
 'probability_percent',(s.rule->>'probability_percent')::numeric,'simulation_runs',6000000)
else jsonb_set(coalesce(b.requirement,'{}'::jsonb)-'probability_percent','{rule}',s.rule,true) end
from public.crilo_v3_badge_stage s
where b.badge_key=s.badge_key and s.badge_key<>'green_needle';

with totals as (
 select user_id,coalesce(sum(score),0) total_score,
 coalesce(max(score),0)::bigint best_score,coalesce(max(best_roll_points),0)::bigint best_roll_points
 from public.daily_runs where is_test=false group by user_id
)
update public.player_stats p set total_score=t.total_score,best_score=t.best_score,
best_roll_points=t.best_roll_points,updated_at=now()
from totals t where p.user_id=t.user_id;

-- Original awards are never deleted; trigger gate validates only new awards.
do $refresh$ declare r record;begin
for r in select distinct user_id from public.daily_runs where is_test=false loop
 perform public.crilo_v3_refresh_user_badges(r.user_id);
end loop;end $refresh$;

do $verify$ declare old_runs int; new_runs int; old_awards int;new_awards int;broken int;begin
select count(*) into old_runs from crilo_wheel_20261014.daily_runs;
select count(*) into new_runs from public.daily_runs;
select count(*) into old_awards from crilo_wheel_20261014.user_badges;
select count(*) into new_awards from public.user_badges;
if old_runs<>new_runs or new_awards<old_awards then raise exception 'Crilo migration count mismatch';end if;
select count(*) into broken from public.daily_runs d where
 jsonb_typeof(d.results)='array' and jsonb_array_length(d.results)>0 and
 (d.score<>crilo_wheel_20261014.history_score(d.results)
 or exists(select 1 from jsonb_array_elements(d.results) e
 where e->>'type'='num' and (e->>'base')::int not in (20,40,60,80,120,160)));
if broken>0 then raise exception 'Crilo history mismatch: % runs',broken;end if;
end $verify$;
