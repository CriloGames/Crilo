-- Fully server-bound daily periods survive delayed submissions across reset.
-- In-progress runs have a 30 minute grace period to finish the previous day.
-- Terminal sessions stop at 500 spins or JS-safe maximum score, not a dead end.
-- All historic player rows are untouched.
CREATE OR REPLACE FUNCTION public.set_crilo_daily_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_period date;
begin
  -- Bind a completed official run to the day on which its server spins
  -- actually happened. A delayed save must not become tomorrow's Daily.
  if new.verified_spin_session_id is not null then
    select s.daily_period into v_period
    from public.crilo_spin_sessions s
    where s.id=new.verified_spin_session_id
      and s.user_id=new.user_id
      and s.finished_at is not null
    for update;
    if v_period is null then
      raise exception 'Invalid or unfinished server spin proof'
        using errcode='23514';
    end if;
    new.daily_period:=v_period;
    new.run_date:=v_period;
  else
    new.daily_period:=((new.created_at at time zone 'UTC') - interval '22 hours')::date;
  end if;
  return new;
end;
$function$;

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
     s.segments:=s.segments || jsonb_build_array(jsonb_build_object('type','num','base',choice_bases[1+(public.crilo_secure_random_index(10))]));
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
     IF base_value NOT IN (1,2,3,5,8,10)
       OR (upgrade_count=0 AND base_value NOT IN (1,2,3,5))
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
   if base not in (1,2,3,5,8,10) then return false;end if;
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
  select count(distinct x) into distinct_count from unnest(bases) x where x in (1,2,3,5);
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
  elsif n=149 then return array[1,3,5] <@ bases;
  elsif n=150 then return 1=any(bases);
  elsif n=151 then select count(*) into bcounter from unnest(bases) b where b=2;return bcounter>=2;
  elsif n=152 then return 5=any(bases);
  elsif n=153 then select count(*) into bcounter from unnest(bases) b where b=3;return bcounter>=3;
  elsif n=154 then return not (1=any(bases));
  elsif n=155 then select count(*) into bcounter from unnest(bases) b where b=1;return bcounter>=5;
  elsif n=156 then
   -- "four consecutive numerical spins" means four adjacent wheel results, not numerical subsequence.
   for j in 1..run_count-3 loop
    if types[j]='num' and bases[j]=bases[j+1] and bases[j]=bases[j+2] and bases[j]=bases[j+3] then return true;end if;
   end loop;return false;
  elsif n=157 then
   mult:=1;for j in 1..run_count loop
    if types[j]='upgrade' then mult:=mult*3;end if;
    if types[j]='num' and mult>1 and bases[j]*mult>=15 then return true;end if;
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
REVOKE EXECUTE ON FUNCTION public.set_crilo_daily_period() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.crilo_validate_daily_run_replay() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.crilo_v3_run_matches(jsonb,jsonb,bigint) FROM PUBLIC,anon;
-- Badge matching is an immutable predicate, not a privileged mutation. Preserve
-- authenticated access if existing badge views expect it.
GRANT EXECUTE ON FUNCTION public.crilo_v3_run_matches(jsonb,jsonb,bigint) TO authenticated,service_role;
