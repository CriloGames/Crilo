create or replace function ascent_game.generate_quick_practice_climb(seed text, player uuid)
returns jsonb language plpgsql stable set search_path to '' as $$
declare result jsonb:='[]'; used_clues text[]:='{}'; used_targets text[]:='{}'; issued text[]; personal text[]; stage int; chosen record;
begin
 select coalesce(array_agg(ascent_game.pitch_signature(b)),'{}') into issued from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b;
 select coalesce(array_agg(distinct b->>'target'),'{}') into personal from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards)b where r.ticket=player;
 for stage in 1..5 loop
  with available as materialized (
   select t.target,t.clue,t.context_name sense from ascent_game.ascent_target_clues t
   join ascent_game.association_scores_v7 a on a.clue=t.clue and a.word=t.target and a.strength>=65
   where (t.context_name='opening theme')=(stage=1) and t.target<>all(used_targets) and t.clue<>all(used_clues)
   and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=t.clue and r.word=t.target) or (r.word=t.clue and r.clue=t.target))
  ), targets as materialized (
   select target,count(distinct sense) senses from available group by target
   having count(distinct sense)>=stage and count(distinct clue)>=6
   order by target=any(personal), (stage between 2 and 4 and count(distinct sense)>=5),md5(seed||stage||target) limit 12
  ), sense_order as (
   select target,sense,k,row_number() over(partition by target,k order by md5(seed||stage||k||sense)) rn
   from (select distinct a.target,a.sense from available a join targets t using(target)) s cross join generate_series(1,24) k
  ), ranked as (
   select a.target,a.clue,a.sense,s.k,row_number() over(partition by a.target,s.k,a.sense order by md5(seed||stage||s.k||a.clue)) sr
   from available a join sense_order s using(target,sense) where s.rn<=stage
  ), picks as (
   select *,row_number() over(partition by target,k order by (sr<>1),md5(seed||stage||k||clue)) pick from ranked
  ), candidates as materialized (
   select target,array_agg(clue order by md5(seed||stage||'position'||clue)) clues
   from picks where pick<=6 group by target,k
   having count(distinct clue)=6 and count(distinct sense)=stage and count(*) filter(where position(' ' in clue)>0) between 2 and 3
  ), unique_candidates as materialized (
   select distinct target,clues,ascent_game.pitch_signature(jsonb_build_object('clues',clues)) sig from candidates
  ), eligible as materialized (
   select * from unique_candidates c where c.sig<>all(issued) and not exists(select 1 from ascent_game.published_pitches p where p.signature=c.sig)
   and not ascent_game.is_displayed_clue(c.clues,c.target)
   order by target=any(personal),md5(seed||stage||sig) limit 40
  ), scores as (
   select e.target,e.clues,e.sig,count(*) n,count(*) filter(where hits=6) fulls,count(*) filter(where hits between 2 and 5) partials,count(*) filter(where hits between 3 and 5) strong,count(*) filter(where hits in (4,5)) near,count(distinct pattern) filter(where hits between 2 and 5) patterns
   from eligible e cross join lateral (
    select a.word,count(*) hits,array_agg(a.clue order by a.clue) pattern from ascent_game.association_scores_v7 a where a.clue=any(e.clues) and a.strength>=65 and a.word<>all(e.clues) group by a.word
   )m group by e.target,e.clues,e.sig
  )
  select target,clues,sig into chosen from scores
  where n>=65 and fulls between 1 and 2 and (stage=1 or fulls=1) and partials>=5 and patterns>=3 and (stage=1 or strong>=2) and (stage<4 or (strong>=3 and near>=1))
  order by target=any(personal),md5(seed||stage||sig) limit 1;
  if not found then return ascent_game.generate_fast_practice_climb(seed,player);end if;
  result:=result||jsonb_build_array(jsonb_build_object('target',chosen.target,'clues',chosen.clues,'contexts',stage));
  used_targets:=array_append(used_targets,chosen.target);used_clues:=used_clues||chosen.clues;
 end loop;
 return result;
end;$$;
revoke all on function ascent_game.generate_quick_practice_climb(text,uuid) from public,anon,authenticated;
