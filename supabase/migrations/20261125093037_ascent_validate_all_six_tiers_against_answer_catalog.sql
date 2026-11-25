insert into ascent_game.association_scores_v7(clue,word,strength,reason) values
('beacon','light',96,'A beacon emits light as a navigation signal.'),
('beacon','illumination',96,'A lighted beacon is a source of illumination.'),
('beacon','brightness',96,'A beacon must be bright enough to be seen at a distance.'),
('beacon','artificial light',96,'A navigation beacon emits artificial light.'),
('beacon','visibility',96,'Visibility is essential for an effective beacon.'),
('beacon','electric light',96,'Modern lighted beacons use electric lamps.')
on conflict(clue,word) do update set strength=greatest(ascent_game.association_scores_v7.strength,excluded.strength),reason=excluded.reason;
insert into ascent_game.ascent_target_clues(target,context_name,clue) values ('light','navigation','beacon') on conflict do nothing;
create or replace function ascent_game.pitch_catalog_tiers(p_board jsonb,p_version integer default 7) returns integer[] language sql stable set search_path='' as $fn$
with board as (select p_version lex_version,p_board generated,array(select jsonb_array_elements_text(p_board->'clues')) clues
), raw as (
 select e.key word,count(distinct e.clue)::int hits,jsonb_object_agg(e.clue,e.value) links,b.clues,b.lex_version,b.generated
 from board b cross join lateral (
 select l.clue,e.key,e.value from ascent_game.circuit_lexicon l cross join lateral jsonb_each_text(l.links) e where l.edition=b.lex_version and b.lex_version<>7 and l.clue=any(b.clues)
 union all select s.clue,s.word,s.reason||' ('||s.strength||'% match)' from ascent_game.association_scores_v7 s where b.lex_version=7 and s.clue=any(b.clues) and s.strength>=65
 union all select k.clue,k.word,k.source from ascent_game.knowledge_edges k where b.lex_version=7 and k.clue=any(b.clues)
 union all select k.clue,k.word,k.reason from ascent_game.direct_connection_facts k where b.lex_version=7 and k.clue=any(b.clues)
 union all select k.word,k.clue,k.reason from ascent_game.direct_connection_facts k where b.lex_version=7 and k.word=any(b.clues)
 union all select s.word,s.clue,s.reason from ascent_game.association_scores_v7 s where b.lex_version=7 and s.word=any(b.clues) and s.strength>=90 and s.reason not like 'Semantic link via %'
 union all select cc.clue,aa->>'word',rr.reason from jsonb_array_elements(coalesce(b.generated->'answers','[]'::jsonb)) aa cross join lateral jsonb_array_elements_text(b.generated->'clues') with ordinality cc(clue,i) cross join lateral jsonb_array_elements_text(aa->'reasons') with ordinality rr(reason,i) where cc.i=rr.i and rr.reason is not null
 union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version in ('llama70b-r3','llama70b-r4','gptoss120b-r5','gptoss120b-r6','ascent-reviewed-v1') and k.accepted and (k.version='ascent-reviewed-v1' or k.created_at>now()-interval '30 days') and (k.version='ascent-reviewed-v1' or (select enabled from ascent_game.llm_config where singleton)) and not exists(select 1 from ascent_game.llm_pair_cache n where n.guess=k.guess and n.clue=k.clue and n.version='gptoss120b-r6' and not n.accepted and n.created_at>=k.created_at and n.created_at>now()-interval '4 hours')
 ) e where e.key<>all(b.clues) and (b.lex_version<>7 or not exists(select 1 from ascent_game.rejected_associations x where (x.clue=e.clue and x.word=e.key) or (x.clue=e.key and x.word=e.clue))) group by e.key,b.clues,b.lex_version,b.generated

), buckets as (select hits,array_agg(word order by length(word),word) words,clues from raw group by hits,clues)
select coalesce(array_agg(hits order by hits),'{}'::integer[]) from buckets b where exists(select 1 from unnest(b.words) w where not ascent_game.is_displayed_clue(b.clues,w))
$fn$;
CREATE OR REPLACE FUNCTION ascent_game.generate_full_tier_candidate(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb:='[]'; used_clues text[]:='{}'; used_targets text[]:='{}'; issued text[]; personal text[]; daily_used text[]:='{}'; stage int; chosen record;
begin
 select coalesce(array_agg(ascent_game.pitch_signature(b)),'{}') into issued from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b;
 select coalesce(array_agg(distinct b->>'target'),'{}') into personal from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards)b where r.ticket=player;
 if seed like 'daily:%' then select coalesce(array_agg(distinct b->>'target'),'{}') into daily_used from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b where c.route_id like 'daily:%';end if;
 for stage in reverse 5..1 loop
  with available as materialized (
   select t.target,t.clue,t.context_name sense from ascent_game.ascent_target_clues t
   join ascent_game.association_scores_v7 a on a.clue=t.clue and a.word=t.target and a.strength>=65
   where (t.context_name='opening theme')=(stage=1) and t.target<>all(used_targets||daily_used) and t.clue<>all(used_clues)
   and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=t.clue and r.word=t.target) or (r.word=t.clue and r.clue=t.target))
  ), targets as materialized (
   select target,count(distinct sense) senses from available group by target
   having count(distinct sense)>=stage and count(distinct clue)>=6
   order by target=any(personal),md5(seed||stage||target) limit 40
  ), sense_order as (
   select target,sense,k,row_number() over(partition by target,k order by md5(seed||stage||k||sense)) rn
   from (select distinct a.target,a.sense from available a join targets t using(target)) s cross join generate_series(1,32) k
  ), ranked as (
   select a.target,a.clue,a.sense,s.k,row_number() over(partition by a.target,s.k,a.sense order by md5(seed||stage||s.k||a.clue)) sr
   from available a join sense_order s using(target,sense) where s.rn<=stage
  ), picks as (
   select *,row_number() over(partition by target,k order by (sr<>1),md5(seed||stage||k||clue)) pick from ranked
  ), candidates as materialized (
   select target,array_agg(clue order by md5(seed||stage||'position'||clue)) clues
   from picks where pick<=6 group by target,k
   having count(distinct clue)=6 and count(distinct sense)=stage and count(*) filter(where position(' ' in clue)>0) between 1 and 5
  ), unique_candidates as materialized (
   select distinct target,clues,ascent_game.pitch_signature(jsonb_build_object('clues',clues)) sig from candidates
  ), eligible as materialized (
   select * from unique_candidates c where c.sig<>all(issued) and not exists(select 1 from ascent_game.published_pitches p where p.signature=c.sig)
   order by target=any(personal),md5(seed||stage||sig) limit 160
  ), scores as (
   select e.target,e.clues,e.sig,count(*) n,count(*) filter(where hits=6) fulls,count(*) filter(where hits between 2 and 5) partials,count(*) filter(where hits between 3 and 5) strong,count(*) filter(where hits in (4,5)) near,count(*) filter(where hits=5) fives,count(distinct hits) tier_coverage,count(distinct pattern) filter(where hits between 2 and 5) patterns
   from eligible e cross join lateral (
    select a.word,count(*) hits,array_agg(a.clue order by a.clue) pattern from ascent_game.association_scores_v7 a where a.clue=any(e.clues) and a.strength>=65 and a.word<>all(e.clues) and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=a.clue and r.word=a.word) or (r.word=a.clue and r.clue=a.word)) group by a.word
   )m group by e.target,e.clues,e.sig
  )
  , shortlist as materialized (select * from scores where tier_coverage=6 and fulls>=1 and not ascent_game.is_displayed_clue(clues,target)
  order by (n>=65 and fulls between 1 and 2 and (stage=1 or fulls=1) and partials>=5 and patterns>=3 and (stage=1 or strong>=2) and (stage<4 or (strong>=3 and near>=1))) desc, (fives>=2) desc,(fives>=1) desc, target=any(personal), (stage>=2 and fulls<>1), (stage>=4 and near=0), (n<65), md5(seed||stage||sig) limit 40)
  select target,clues,sig into chosen from shortlist where ascent_game.pitch_catalog_tiers(jsonb_build_object('clues',clues),7)=array[1,2,3,4,5,6] limit 1;
  if not found then return null;end if;
  result:=jsonb_build_array(jsonb_build_object('target',chosen.target,'clues',chosen.clues,'contexts',stage))||result;
  used_targets:=array_append(used_targets,chosen.target);used_clues:=used_clues||chosen.clues;
 end loop;
 return result;
end;$function$;
