create or replace function ascent_game.reviewed_route_pairs(boards jsonb)
returns table(guess text,clue text,reason text)
language sql stable set search_path to '' as $$
 select distinct on (a->>'word',c.clue) a->>'word',c.clue,r.reason
 from jsonb_array_elements(boards) b
 cross join lateral jsonb_array_elements(b->'answers') a
 cross join lateral jsonb_array_elements_text(b->'clues') with ordinality c(clue,i)
 cross join lateral jsonb_array_elements_text(a->'reasons') with ordinality r(reason,i)
 where b->>'review'='ascent-standard-review-v1' and c.i=r.i and r.reason is not null and length(r.reason) between 4 and 160
 and a->>'word' is not null and not ascent_game.is_displayed_clue(array(select jsonb_array_elements_text(b->'clues')),a->>'word')
 and not exists(select 1 from ascent_game.rejected_associations x where (x.clue=c.clue and x.word=a->>'word') or (x.clue=a->>'word' and x.word=c.clue))
 order by a->>'word',c.clue,r.reason
$$;
revoke all on function ascent_game.reviewed_route_pairs(jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ascent_store_generated_practice(p_seed uuid, p_ticket uuid, p_reply jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare avoid text[]; reply jsonb:=p_reply; pitch jsonb; alt jsonb; target text; clues text[]; used_clues text[]:='{}'; used_targets text[]:='{}'; words text[]; answer_list jsonb; results jsonb:='[]'; stage int:=0; n int; best int; candidate jsonb;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 perform pg_advisory_xact_lock(hashtextextended('ascent-fresh-store',0));
 if exists(select 1 from ascent_game.circuits where route_id='practice:'||p_seed) then return '{"ok":true}'::jsonb;end if;
 select coalesce(array_agg(t),'{}') into avoid from (select distinct b->>'target' t from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) b where c.route_id like 'daily:%' or exists(select 1 from ascent_game.runs r where r.ticket=p_ticket and r.scope=c.route_id) limit 250) a;
  if reply->>'review' is distinct from 'ascent-standard-review-v1' then raise exception 'Independent connection review required';end if;
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
    if n not between 1 and 5 then continue;end if;
    best:=greatest(best,n);words:=array_append(words,alt->>'word');answer_list:=answer_list||jsonb_build_array(alt);
   end loop;
  end if;
  -- Save independently generated common guesses for each clue, without a fixed word pool.
  answer_list:=ascent_game.augment_generated_answers(clues,target,answer_list,pitch->'common');
  -- Optional model decoys must never invalidate an otherwise playable fresh board.
  -- The generated target and its six explanations remain mandatory.
  select jsonb_agg(a order by (a->>'word'=target) desc,(select count(*) from jsonb_array_elements(a->'reasons') r where jsonb_typeof(r)='string') desc) into answer_list from jsonb_array_elements(answer_list) a;
  candidate:=candidate||jsonb_build_object('contexts',stage,'answers',answer_list,'review','ascent-standard-review-v1');
  if (select count(*) from jsonb_object_keys(ascent_game.generated_links(candidate,target)))<>6 then raise exception 'Generated target cannot be scored on every clue %',stage;end if;
  results:=results||jsonb_build_array(candidate);
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;

 insert into ascent_game.circuits(route_id,boards,lex_version) values('practice:'||p_seed,results,7);
 insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason)
 select guess,clue,'ascent-reviewed-v1',true,reason from ascent_game.reviewed_route_pairs(results)
 on conflict on constraint llm_pair_cache_pkey do update set accepted=true,reason=excluded.reason,created_at=now();
 return '{"ok":true}'::jsonb;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_cached_matches(clues text[], guess text, known jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with candidates as (
 select c.clue,c.reason,c.created_at,c.version,0 direction from ascent_game.llm_pair_cache c where c.guess=$2 and c.clue=any($1) and c.version in ('llama70b-r3','llama70b-r4','gptoss120b-r5','gptoss120b-r6','ascent-reviewed-v1') and c.accepted
 union all
 select c.guess,c.reason,c.created_at,c.version,1 direction from ascent_game.llm_pair_cache c where c.clue=$2 and c.guess=any($1) and c.version in ('llama70b-r4','gptoss120b-r5','gptoss120b-r6','ascent-reviewed-v1') and c.accepted
), chosen as (
 select distinct on(c.clue) c.clue,c.reason,c.version from candidates c where not $3 ? c.clue and (c.version='ascent-reviewed-v1' or c.created_at>now()-interval '30 days')
 and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=c.clue and k.version='gptoss120b-r6' and not k.accepted and k.created_at>=c.created_at and k.created_at>now()-interval '4 hours')
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=c.clue and r.word=$2) or (r.clue=$2 and r.word=c.clue))
 order by c.clue,(c.version in ('gptoss120b-r6','ascent-reviewed-v1')) desc,c.version desc,c.direction,c.created_at desc
)
select $3||coalesce((select jsonb_object_agg(clue,reason||case when version='ascent-reviewed-v1' then ' — independently reviewed' else ' — AI relationship' end) from chosen where version='ascent-reviewed-v1' or (select enabled from ascent_game.llm_config where singleton)),'{}'::jsonb)
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
 union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version in ('llama70b-r3','llama70b-r4','gptoss120b-r5','gptoss120b-r6','ascent-reviewed-v1') and k.accepted and (k.version='ascent-reviewed-v1' or k.created_at>now()-interval '30 days') and (select enabled from ascent_game.llm_config where singleton)
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
