CREATE OR REPLACE FUNCTION ascent_game.llm_request(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare resp extensions.http_response;token text;
begin
 select secret into token from ascent_game.semantic_config where singleton;
 perform set_config('http.curlopt_timeout_msec','3300',true);
 perform set_config('http.curlopt_connecttimeout_msec','900',true);
 select * into resp from extensions.http(('POST','https://mqozqigwkobnhijvvboy.supabase.co/functions/v1/ascent-reasoning',array[extensions.http_header('x-ascent-token',token)],'application/json',payload::text)::extensions.http_request);
 if resp.status=200 then return resp.content::jsonb;end if;
 return jsonb_build_object('error','reasoning unavailable','status',resp.status);
 exception when others then return jsonb_build_object('error','reasoning request failed','state',sqlstate);
end;$function$;

create or replace function ascent_game.llm_cached_matches(clues text[],guess text,known jsonb)
returns jsonb language sql stable set search_path to '' as $$
with candidates as (
 select c.clue,c.reason,c.created_at,c.version,0 direction from ascent_game.llm_pair_cache c where c.guess=$2 and c.clue=any($1) and c.version in ('llama70b-r3','llama70b-r4') and c.accepted
 union all
 select c.guess,c.reason,c.created_at,c.version,1 direction from ascent_game.llm_pair_cache c where c.clue=$2 and c.guess=any($1) and c.version='llama70b-r4' and c.accepted
), chosen as (
 select distinct on(c.clue) c.clue,c.reason from candidates c where not $3 ? c.clue and c.created_at>now()-interval '30 days'
 and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=c.clue and k.version='llama70b-r4' and not k.accepted and k.created_at>=c.created_at and k.created_at>now()-interval '4 hours')
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=c.clue and r.word=$2) or (r.clue=$2 and r.word=c.clue))
 order by c.clue,c.version desc,c.direction,c.created_at desc
)
select $3||coalesce((select jsonb_object_agg(clue,reason||' — AI relationship') from chosen where (select enabled from ascent_game.llm_config where singleton)),'{}'::jsonb)
$$;

create or replace function ascent_game.direct_synonym_links(clues text[],guess text,known jsonb)
returns jsonb language sql stable set search_path to '' as $$
with g as materialized (
 select guess word,0 priority
 union
 select distinct a.word,1 from ascent_game.wordnet_members m join ascent_game.wordnet_members a using(synset)
 where m.word=guess and a.word<>guess and (select count(*) from ascent_game.wordnet_members z where z.word=a.word)=1
), c as materialized (
 select x clue,x word,0 priority from unnest(clues) x where not known ? x
 union
 select distinct x,a.word,1 from unnest(clues) x join ascent_game.wordnet_members m on m.word=x join ascent_game.wordnet_members a using(synset)
 where not known ? x and a.word<>x and (select count(*) from ascent_game.wordnet_members z where z.word=a.word)=1
), evidence as (
 select c.clue,s.reason,s.strength,g.word guess_anchor,c.word clue_anchor from c join ascent_game.association_scores_v7 s on s.clue=c.word join g on g.word=s.word
 where c.priority+g.priority=1
 union all
 select c.clue,s.reason,s.strength,g.word,c.word from c join ascent_game.association_scores_v7 s on s.word=c.word join g on g.word=s.clue where c.priority+g.priority=1
), best as (
 select distinct on (e.clue) e.clue,e.reason,e.guess_anchor,e.clue_anchor from evidence e where e.strength>=95 and length(e.reason)>=18
 and e.reason !~* '^(Related|Associated|A direct association|Direct reverse|Shared meaning|Semantic link|“|")'
 and e.reason not like '%↔%' and e.reason not like '%similarity%'
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=e.clue and r.word=guess) or (r.clue=e.clue_anchor and r.word=e.guess_anchor) or (r.clue=e.guess_anchor and r.word=e.clue_anchor) or (r.clue=guess and r.word=e.clue))
 order by e.clue,e.strength desc,e.guess_anchor,e.clue_anchor,e.reason
)
select case when guess is null or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,7}$' or guess in ('thing','object','entity','stuff','part','type','kind','group','person','something','anything','everything','activity','action','event','matter','process') or ascent_game.is_displayed_clue(clues,guess) then known else known||coalesce((select jsonb_object_agg(clue,reason||' — dictionary synonym: '||case when guess_anchor<>guess then guess_anchor else clue_anchor end) from best),'{}'::jsonb) end
$$;
revoke all on function ascent_game.direct_synonym_links(text[],text,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION ascent_game.llm_complete(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if not coalesce(enabled_flag,false) then perform set_config('ascent.match_incomplete','true',true);return known;end if;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '^(not|unrelated|none|except|without)($| )' or guess ~ '(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 missing:=array(select x from unnest(clues) x where not result ? x and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=x and k.version='llama70b-r4' and not k.accepted and k.created_at>now()-interval '4 hours'));
 -- Known, cached and vector-backed matches are ready to score locally.
 if cardinality(missing)=0 then return result;end if;
 -- Obvious keyboard noise cannot form a conventional relationship.
 if guess !~ '[aeiouy]' and length(guess)>=4 or guess ~ '([a-z])\1\1\1' then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'llama70b-r4' or jsonb_typeof(reply->'matches') is distinct from 'object' then
   -- Never stack a second model request on a slow or timed-out request.
   perform set_config('ascent.match_incomplete','true',true);return result;
 end if;
 if exists(select 1 from jsonb_each(reply->'matches') e where e.key<>all(missing) or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}') not between 4 and 150) then perform set_config('ascent.match_incomplete','true',true);return result;end if;
 foreach c in array missing loop
  explanation:=reply->'matches'->>c;
  insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason) values(guess,c,'llama70b-r4',explanation is not null,coalesce(explanation,'')) on conflict on constraint llm_pair_cache_pkey do update set accepted=excluded.accepted,reason=excluded.reason,created_at=now();
  if explanation is not null then result:=result||jsonb_build_object(c,explanation||' — AI relationship');end if;
 end loop;
 return result;
exception when others then perform set_config('ascent.match_incomplete','true',true);return result;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.semantic_complete_guess(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare normalized text; corrected text; missing text[]; more jsonb; result jsonb;
begin
 perform set_config('ascent.match_incomplete','false',true);
 normalized:=lower(btrim(regexp_replace(regexp_replace(coalesce(guess,''),'[’'']','','g'),'[[:space:]‐‑–—-]+',' ','g')));
 normalized:=btrim(regexp_replace(normalized,'[.!?]+$','','g'));
 if ascent_game.is_displayed_clue(clues,normalized) then return '{}'::jsonb;end if;
 if normalized=any(clues) or (select count(*) from jsonb_object_keys(known))=cardinality(clues) then return ascent_game.filter_rejected_associations(normalized,known);end if;
 corrected:=normalized;
 known:=ascent_game.local_association_variants(clues,normalized,known);
 known:=ascent_game.live_dictionary_links(clues,normalized,ascent_game.knowledge_matches(clues,normalized,known));
 known:=ascent_game.direct_synonym_links(clues,normalized,known);
 if known='{}'::jsonb then
  corrected:=ascent_game.correct_spelling(normalized);
  if ascent_game.is_displayed_clue(clues,corrected) then return '{}'::jsonb;end if;
  if corrected<>normalized then known:=ascent_game.local_association_variants(clues,corrected,ascent_game.match_guess(7,clues,corrected));end if;
 end if;
 -- Reciprocal high-confidence registered relationships are direct evidence, not similarity guesses.
 known:=known||coalesce((select jsonb_object_agg(s.word,s.reason||' (reciprocal registered relationship)') from ascent_game.association_scores_v7 s where s.clue=corrected and s.word=any(clues) and not known ? s.word and s.strength>=85 and s.reason not like 'Semantic link via %' and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=s.word and r.word=corrected) or (r.clue=corrected and r.word=s.word))),'{}'::jsonb);
 known:=ascent_game.complete_equivalent_answers(clues,corrected,known);
 if corrected<>normalized then known:=ascent_game.direct_synonym_links(clues,corrected,ascent_game.live_dictionary_links(clues,corrected,ascent_game.knowledge_matches(clues,corrected,known)));end if;
 missing:=array(select c from unnest(clues) c where not known ? c);
 if cardinality(missing)>0 then result:=ascent_game.llm_complete(clues,corrected,ticket,known);else result:=known;end if;
 result:=ascent_game.filter_rejected_associations(corrected,result);
 if corrected<>normalized and result<>'{}'::jsonb then
  select jsonb_object_agg(key,'Interpreted as “'||corrected||'” — '||value) into result from jsonb_each_text(result);
 end if;
 return result;
exception when others then perform set_config('ascent.match_incomplete','true',true);return known;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.preview_registered_guess(clues text[], guess text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with base as (select ascent_game.direct_synonym_links(clues,guess,ascent_game.live_dictionary_links(clues,guess,ascent_game.knowledge_matches(clues,guess,ascent_game.complete_equivalent_answers(clues,guess,ascent_game.local_association_variants(clues,guess,ascent_game.match_guess(7,clues,guess)))))) known), v as (select embedding from ascent_game.semantic_word_vectors where word=guess)
 select case when ascent_game.is_displayed_clue(clues,guess) then '{}'::jsonb else ascent_game.filter_rejected_associations(guess,ascent_game.llm_cached_matches(clues,guess,known||coalesce((select ascent_game.vector_clue_matches(array(select c from unnest(clues) c where not known ? c),guess,embedding) from v where (select enabled from ascent_game.semantic_config where singleton)), '{}'::jsonb))) end from base
$function$;

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
 perform set_config('ascent.match_incomplete','false',true);
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
   return jsonb_build_object('links',links,'points',points,'rejected',hits=0,'checkIncomplete',coalesce(current_setting('ascent.match_incomplete',true)='true',false));
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
    h:=h||jsonb_build_array(jsonb_build_object('guess',case when expired and not auto_submitted then '' else answer end,'timedOut',expired and not auto_submitted,'autoSubmitted',auto_submitted,'clues',b.clues,'links',links,'points',points,'checkIncomplete',coalesce(current_setting('ascent.match_incomplete',true)='true',false),'target',b.target,'solution',solution,'decoy',decoy_word,'decoyLinks',decoy_links));
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
 return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',coalesce(dictionary_version>=3,true),'deadline',until_at,'pitchSeconds',pitch_seconds,'contexts',case when until_at is not null then pitches->(ix-1)->'contexts' end,'serverTime',clock_timestamp(),'clues',case when until_at is not null then b.clues end,'rejected',rejected,'checkIncomplete',coalesce(current_setting('ascent.match_incomplete',true)='true',false));
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
 union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version in ('llama70b-r3','llama70b-r4') and k.accepted and k.created_at>now()-interval '30 days' and (select enabled from ascent_game.llm_config where singleton)
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
