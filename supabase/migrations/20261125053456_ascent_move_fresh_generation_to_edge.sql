create or replace function public.ascent_prepare_generated_practice(p_seed uuid,p_ticket uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare avoid text[]; token text;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 if exists(select 1 from ascent_game.circuits where route_id='practice:'||p_seed) then return '{"exists":true}'::jsonb;end if;
 select secret into token from ascent_game.semantic_config where singleton;
 if not public.ascent_llm_reserve(token,p_ticket) then return '{"quota":true}'::jsonb;end if;
 select coalesce(array_agg(t),'{}') into avoid from (select distinct b->>'target' t from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) b where c.route_id like 'daily:%' or exists(select 1 from ascent_game.runs r where r.ticket=p_ticket and r.scope=c.route_id) limit 250) a;
 return jsonb_build_object('avoid',avoid);
end;$$;
revoke all on function public.ascent_prepare_generated_practice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ascent_prepare_generated_practice(uuid,uuid) to service_role;
create or replace function public.ascent_store_generated_practice(p_seed uuid,p_ticket uuid,p_reply jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare avoid text[]; reply jsonb:=p_reply; pitch jsonb; alt jsonb; target text; clues text[]; used_clues text[]:='{}'; used_targets text[]:='{}'; words text[]; answer_list jsonb; results jsonb:='[]'; stage int:=0; n int; best int; candidate jsonb;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 perform pg_advisory_xact_lock(hashtextextended('ascent-fresh-store',0));
 if exists(select 1 from ascent_game.circuits where route_id='practice:'||p_seed) then return '{"ok":true}'::jsonb;end if;
 select coalesce(array_agg(t),'{}') into avoid from (select distinct b->>'target' t from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) b where c.route_id like 'daily:%' or exists(select 1 from ascent_game.runs r where r.ticket=p_ticket and r.scope=c.route_id) limit 250) a;
  if jsonb_typeof(reply->'pitches') is distinct from 'array' or jsonb_array_length(reply->'pitches')<>5 then raise exception 'Invalid generated climb';end if;
 for pitch in select value from jsonb_array_elements(reply->'pitches') loop
  stage:=stage+1;target:=pitch->>'target';
  if target is null or target !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$' or length(target)>60 or target=any(avoid||used_targets) or jsonb_typeof(pitch->'clues') is distinct from 'array' or jsonb_array_length(pitch->'clues')<>6 or jsonb_typeof(pitch->'reasons') is distinct from 'array' or jsonb_array_length(pitch->'reasons')<>6 then raise exception 'Invalid generated pitch %',stage;end if;
  clues:=array(select jsonb_array_elements_text(pitch->'clues'));
  if (select count(distinct c) from unnest(clues)c)<>6 or clues&&used_clues or ascent_game.is_displayed_clue(clues,target) or exists(select 1 from unnest(clues)c where c is null or length(c)>60 or c !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$') or exists(select 1 from jsonb_array_elements(pitch->'reasons') r where jsonb_typeof(r)<>'string' or length(r#>>'{}') not between 4 and 160) then raise exception 'Invalid generated clues %',stage;end if;
  candidate:=jsonb_build_object('target',target,'clues',clues);
  if exists(select 1 from ascent_game.published_pitches where signature=ascent_game.pitch_signature(candidate)) or exists(select 1 from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b where c.route_id like 'practice:%' and ascent_game.pitch_signature(b)=ascent_game.pitch_signature(candidate)) then raise exception 'Repeated generated pitch';end if;
  answer_list:=jsonb_build_array(jsonb_build_object('word',target,'reasons',pitch->'reasons')); words:=array[target];best:=0;
  if jsonb_typeof(pitch->'alternatives')='array' then
   for alt in select value from jsonb_array_elements(pitch->'alternatives') limit 5 loop
    if alt->>'word' is null or alt->>'word' !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$' or length(alt->>'word')>60 or alt->>'word'=any(words) or ascent_game.is_displayed_clue(clues,alt->>'word') or jsonb_typeof(alt->'reasons') is distinct from 'array' or jsonb_array_length(alt->'reasons')<>6 then continue;end if;
    if exists(select 1 from jsonb_array_elements(alt->'reasons') r where jsonb_typeof(r) not in ('string','null') or (jsonb_typeof(r)='string' and length(r#>>'{}') not between 4 and 160)) then continue;end if;
    select count(*) into n from jsonb_array_elements(alt->'reasons') r where jsonb_typeof(r)='string';
    if n not between 2 and 5 then continue;end if;
    best:=greatest(best,n);words:=array_append(words,alt->>'word');answer_list:=answer_list||jsonb_build_array(alt);
   end loop;
  end if;
  if jsonb_array_length(answer_list)<2 or (stage>=4 and best<4) then raise exception 'Generated pitch lacks a convincing alternate answer %',stage;end if;
  results:=results||jsonb_build_array(candidate||jsonb_build_object('contexts',stage,'answers',answer_list));
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;

 insert into ascent_game.circuits(route_id,boards,lex_version) values('practice:'||p_seed,results,7);
 return '{"ok":true}'::jsonb;
end;$$;
revoke all on function public.ascent_store_generated_practice(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ascent_store_generated_practice(uuid,uuid,jsonb) to service_role;
drop function ascent_game.generate_fresh_practice(uuid,uuid);

CREATE OR REPLACE FUNCTION public.ascent_circuit(p_ticket uuid, p_action text DEFAULT 'read'::text, p_day date DEFAULT NULL::date, p_round integer DEFAULT NULL::integer, p_guess text DEFAULT NULL::text, p_archive date DEFAULT NULL::date, p_seed uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
declare
 received timestamptz:=statement_timestamp();
 d date:=(received at time zone 'America/Los_Angeles')::date;
 local_today date:=d;
 run_scope text:='daily';
 route_key text;
 pitches jsonb;
 dictionary_version int:=4; pitch_seconds int:=20;
 h jsonb; total_points integer; until_at timestamptz; ix integer;
 b ascent_game.boards%rowtype; answer text; canonical text; candidates text[]; links jsonb:='{}'; solution jsonb;
 decoy_word text; decoy_links jsonb; hits integer; pairs integer; points integer; expired boolean; auto_submitted boolean:=false; rejected boolean:=false; crowd jsonb;
begin
 if p_archive is not null and (p_seed is not null or p_archive<date '2026-11-24' or p_archive>=local_today) then
  raise exception 'Only past published climbs can be replayed'; end if;
 if p_archive is not null then d:=p_archive;run_scope:='replay';end if;
 if p_seed is not null then d:=date '2026-11-24';run_scope:='practice:'||p_seed;end if;
 route_key:=case when p_seed is null then 'daily:'||to_char(d,'YYYY-MM-DD') else run_scope end;
 if p_ticket is null or p_action is null or p_action not in ('read','start','guess','retry_pitch','auto_guess') then raise exception 'Invalid request'; end if;
 if p_seed is not null and not exists(select 1 from ascent_game.circuits where route_id=route_key) then
  if p_action='read' then return jsonb_build_object('needsGeneration',true,'day',d,'history','[]'::jsonb,'deadline',null,'serverTime',clock_timestamp());end if;
  raise exception 'Generate the practice route before starting';
 end if;
 if p_action='retry_pitch' then
   select r.history->(p_round-1),c.lex_version into h,dictionary_version
   from ascent_game.runs r join ascent_game.circuits c on c.route_id=route_key
   where r.day=d and r.scope=run_scope and r.ticket=p_ticket and p_day=d
     and p_round between 1 and jsonb_array_length(r.history);
   if h is null then raise exception 'Finish this pitch first';end if;
   b.clues:=array(select jsonb_array_elements_text(h->'clues'));
   answer:=lower(btrim(regexp_replace(coalesce(p_guess,''),'[[:space:]]+',' ','g')));
   if ascent_game.is_displayed_clue(b.clues,answer) then return jsonb_build_object('links','{}'::jsonb,'points',0,'rejected',true,'clueGuess',true);end if;
   links:=ascent_game.match_guess(dictionary_version,b.clues,answer);
   if p_seed is not null then links:=links||ascent_game.generated_links((select c.boards->(p_round-1) from ascent_game.circuits c where c.route_id=route_key),answer);end if;
   if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;

   if length(answer) between 1 and 120 and answer ~ '^[a-z0-9]+( [a-z0-9]+){0,15}$' and (select count(*) from ascent_game.connection_retry_evidence e where e.day=d and e.ticket=p_ticket and e.scope=run_scope and e.pitch=p_round)<30 then
    insert into ascent_game.connection_retry_evidence(day,ticket,scope,pitch,guess,links) values(d,p_ticket,run_scope,p_round,answer,links) on conflict(day,ticket,scope,pitch,guess) do update set links=excluded.links;
   end if;
   return jsonb_build_object('links',links,'points',points,'rejected',hits=0);
 end if;
 if p_action='start' and p_day=d and p_round=1 then
  insert into ascent_game.runs(day,ticket,scope) values(d,p_ticket,run_scope) on conflict do nothing;
 end if;
 select history,total,deadline into h,total_points,until_at from ascent_game.runs where day=d and ticket=p_ticket and scope=run_scope for update;
 h:=coalesce(h,'[]'); total_points:=coalesce(total_points,0); ix:=jsonb_array_length(h)+1;
 select coalesce((select lex_version from ascent_game.circuits where route_id=route_key),4) into dictionary_version;
 if ix<=5 then
  if until_at is not null or (p_action='start' and p_day=d and p_round=ix) then
   select c.boards,c.lex_version into pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key;
   if pitches is null then
    perform pg_advisory_xact_lock(hashtextextended('ascent-route-generation',0)); select c.boards,c.lex_version into pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key; if pitches is null then pitches:=ascent_game.generate_misdirection_climb(route_key,p_ticket);dictionary_version:=7; end if;
    insert into ascent_game.circuits(route_id,boards,lex_version) values(route_key,pitches,dictionary_version) on conflict do nothing;
    select c.boards,c.lex_version into strict pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key;
   end if;
   if pitches->(ix-1) ? 'contexts' then pitch_seconds:=(array[20,21,22,24,25])[ix];end if;
   b.target:=pitches->(ix-1)->>'target';
   b.clues:=array(select jsonb_array_elements_text(pitches->(ix-1)->'clues'));
  end if;
  if p_action='start' and p_day=d and p_round=ix and until_at is null then
   until_at:=clock_timestamp()+make_interval(secs=>pitch_seconds);
   update ascent_game.runs set deadline=until_at where day=d and ticket=p_ticket and scope=run_scope;
  end if;
  expired:=until_at is not null and received>=until_at;
  -- Allow only a short network delivery window for the answer frozen by the client at zero.
  auto_submitted:=coalesce(p_action='auto_guess' and p_day=d and p_round=ix
   and until_at is not null and received>=until_at-interval '250 milliseconds'
   and received<=until_at+interval '2 seconds'
   and length(btrim(coalesce(p_guess,''))) between 1 and 120,false);
  if (p_action='read' or (p_day=d and p_round=ix)) and (expired or auto_submitted or (until_at is not null and p_action='guess' and p_day=d and p_round=ix)) then
   answer:=lower(btrim(regexp_replace(coalesce(p_guess,''),'[[:space:]]+',' ','g')));
   if ascent_game.is_displayed_clue(b.clues,answer) then answer:='';end if;
   if (not expired or auto_submitted) and answer<>'' then links:=ascent_game.match_guess(dictionary_version,b.clues,answer);
   if p_seed is not null then links:=links||ascent_game.generated_links((select c.boards->(p_round-1) from ascent_game.circuits c where c.route_id=route_key),answer);end if;
   if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;end if;
   if expired or auto_submitted or links<>'{}'::jsonb then
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;
    if dictionary_version>=6 then solution:=ascent_game.match_guess(dictionary_version,b.clues,b.target); else select jsonb_object_agg(l.clue,l.links->b.target) into solution from ascent_game.circuit_lexicon l where l.edition=dictionary_version and l.clue=any(b.clues); end if;
    if p_seed is not null and pitches->(ix-1) ? 'answers' then
     solution:=ascent_game.generated_links(pitches->(ix-1),b.target);
     decoy_word:=pitches->(ix-1)->'answers'->1->>'word';
     decoy_links:=ascent_game.generated_links(pitches->(ix-1),decoy_word);
    elsif dictionary_version=7 then
     select m.bait into decoy_word from ascent_game.misdirection_boards m where m.verified and m.target=b.target and m.clues @> b.clues and b.clues @> m.clues limit 1;
     if decoy_word is not null and not ascent_game.is_displayed_clue(b.clues,decoy_word) then decoy_links:=ascent_game.preview_registered_guess(b.clues,decoy_word);
      if (select count(*) from jsonb_object_keys(decoy_links)) not between 2 and 4 then decoy_word:=null;decoy_links:=null;end if;
     end if;
    end if;
    h:=h||jsonb_build_array(jsonb_build_object('guess',case when expired and not auto_submitted then '' else answer end,'timedOut',expired and not auto_submitted,'autoSubmitted',auto_submitted,'clues',b.clues,'links',links,'points',points,'target',b.target,'solution',solution,'decoy',decoy_word,'decoyLinks',decoy_links));
    total_points:=total_points+points;
    update ascent_game.runs set history=h,total=total_points,deadline=null where day=d and ticket=p_ticket and scope=run_scope;
    until_at:=null;ix:=ix+1;
   else rejected:=true; end if;
  end if;
 end if;
 if ix=6 then
  select lex_version into dictionary_version from ascent_game.circuits where route_id=route_key;
  if p_seed is not null then
   return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',dictionary_version>=3,'results',jsonb_build_object('score',total_points,'average',null,'players',0));
  end if;
  select jsonb_build_object(
    'average',round(sum(score_sum)/nullif(sum(n),0)),
    'players',coalesce(sum(n),0),
    'finishBands',case when sum(n)>=10 then jsonb_object_agg(band,n) end
  ) into crowd
  from (
    select least(total/100,9) as band,count(*) as n,sum(total) as score_sum
    from ascent_game.runs
    where day=d and scope='daily' and (jsonb_array_length(history)=5 or (jsonb_array_length(history)=4 and deadline<=received))
    group by 1
  ) as bins;
  return jsonb_build_object('day',d,'history',h,'results',crowd||jsonb_build_object('score',total_points));
 end if;
 return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',coalesce(dictionary_version>=3,true),'deadline',until_at,'pitchSeconds',pitch_seconds,'contexts',case when until_at is not null then pitches->(ix-1)->'contexts' end,'serverTime',clock_timestamp(),'clues',case when until_at is not null then b.clues end,'rejected',rejected);
end;
$function$;
CREATE OR REPLACE FUNCTION public.ascent_top_answers(p_ticket uuid, p_day date, p_archive date DEFAULT NULL::date, p_seed uuid DEFAULT NULL::uuid, p_pitch integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
with board as (
 select c.lex_version,c.boards->(p_pitch-1) generated,array(select jsonb_array_elements_text(c.boards->(p_pitch-1)->'clues')) clues
 from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when p_seed is null then 'daily:'||to_char(r.day,'YYYY-MM-DD') else 'practice:'||p_seed end
 where r.ticket=p_ticket and r.day=p_day and jsonb_array_length(r.history)=5
 and r.scope=case when p_seed is not null then 'practice:'||p_seed when p_archive=p_day then 'replay' else 'daily' end and p_pitch between 1 and 5
), raw as (
 select e.key word,count(distinct e.clue)::int hits,jsonb_object_agg(e.clue,e.value) links,b.clues,b.lex_version,b.generated
 from board b cross join lateral (
 select l.clue,e.key,e.value from ascent_game.circuit_lexicon l cross join lateral jsonb_each_text(l.links) e where l.edition=b.lex_version and b.lex_version<>7 and l.clue=any(b.clues)
 union all select s.clue,s.word,s.reason||' ('||s.strength||'% match)' from ascent_game.association_scores_v7 s where b.lex_version=7 and s.clue=any(b.clues) and s.strength>=65
 union all select k.clue,k.word,k.source from ascent_game.knowledge_edges k where b.lex_version=7 and k.clue=any(b.clues)
 union all select cc.clue,aa->>'word',rr.reason from jsonb_array_elements(coalesce(b.generated->'answers','[]'::jsonb)) aa cross join lateral jsonb_array_elements_text(b.generated->'clues') with ordinality cc(clue,i) cross join lateral jsonb_array_elements_text(aa->'reasons') with ordinality rr(reason,i) where cc.i=rr.i and rr.reason is not null
 union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version='llama70b-r3' and k.accepted and k.created_at>now()-interval '30 days' and (select enabled from ascent_game.llm_config where singleton)
 ) e where e.key<>all(b.clues) group by e.key,b.clues,b.lex_version,b.generated
), raw_ranked as (
 select *,row_number() over(partition by hits order by length(word),word collate "C") rn from raw
), witnesses as (
 select distinct w.word from board b join ascent_game.rich_tier_boards_v7 r on b.clues @> r.clues and r.clues @> b.clues and r.semantic_verified
 cross join lateral jsonb_array_elements(r.tier_witnesses) t(words) cross join lateral jsonb_array_elements_text(t.words) w(word)
), evaluated as materialized (
 select word,clues,case when lex_version=7 then ascent_game.preview_registered_guess(clues,word)||ascent_game.generated_links(generated,word) else links end links
 from raw_ranked where lex_version<>7 or rn<=30 or word in(select word from witnesses)
), matched as (
 select *, (select count(*)::int from jsonb_object_keys(links)) hits from evaluated
), ranked as (
 select word,hits,links,case when hits=6 then 200 else 10*(hits*(hits+1)/2+(select count(*) from generate_series(1,3) i where links ? clues[i] and links ? clues[i+3])) end points from matched where hits>0 and not ascent_game.is_displayed_clue(clues,word)
), tier_ranked as (
 select *,row_number() over(partition by hits order by points desc,word collate "C") tier_rank from ranked
), chosen as (
 select * from tier_ranked order by (tier_rank<=case hits when 1 then 10 when 2 then 5 when 3 then 4 when 4 then 5 when 5 then 3 else 1 end) desc,points desc,word collate "C" limit 100
)
select coalesce(jsonb_agg(jsonb_build_object('word',word,'hits',hits,'links',links,'points',points) order by points desc,word collate "C"),'[]') from chosen;
$function$;
