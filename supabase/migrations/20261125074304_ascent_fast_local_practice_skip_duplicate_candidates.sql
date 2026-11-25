CREATE OR REPLACE FUNCTION ascent_game.generate_fast_practice_climb(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
 pitches jsonb:='[]'; used_targets text[]:='{}'; used_clues text[]:='{}';
 target_row record; pool record; holds text[]; stage int; attempt int; phrase_goal int;
 hits6 int; partials int; answer_count int; strong_decoys int; near_decoys int; distinct_patterns int; candidate_signature text; found_board boolean;
 prior jsonb; issued text[]; issued_by_player text[]; tested_signatures text[];
begin
 select coalesce(jsonb_agg(p),'[]') into prior from ascent_game.circuits c
 cross join lateral jsonb_array_elements(c.boards) p
 where c.route_id<>seed and (case when seed like 'daily:%' then c.route_id like 'daily:%' else
 exists(select 1 from ascent_game.runs r where r.ticket=player and c.route_id=case when r.scope like 'practice:%' or r.scope like 'superseded:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end) end);
 select coalesce(array_agg(ascent_game.pitch_signature(p)),'{}') into issued_by_player from jsonb_array_elements(prior)p;
 select coalesce(array_agg(ascent_game.pitch_signature(p)),'{}') into issued from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)p;
 for stage in 1..5 loop
  found_board:=false;
  phrase_goal:=2+case when mod(get_byte(decode(md5(seed),'hex'),0),2)=1 and stage=1+mod(get_byte(decode(md5(seed),'hex'),1),5) then 1 else 0 end;
  for target_row in
   with possible as (
    select t.target,count(distinct t.context_name) available_contexts from ascent_game.ascent_target_clues t where (t.context_name='opening theme')=(stage=1) and t.target<>all(used_targets) and t.clue<>all(used_clues)
    group by t.target having count(distinct context_name)>=stage and count(distinct clue)>=6 and count(*) filter(where position(' ' in t.clue)>0)>=2 and count(*) filter(where position(' ' in t.clue)=0)>=3
   ), frequency as (
    select p->>'target' answer,count(*) uses from jsonb_array_elements(prior)p group by 1
   ), exposure as (
    select p->>'target' answer,count(*) uses from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)p
    where (seed not like 'daily:%' or c.route_id like 'daily:%') group by 1
   )
   select x.target from possible x left join frequency f on f.answer=x.target left join exposure g on g.answer=x.target
   order by coalesce(f.uses,0),coalesce(g.uses,0), (stage between 2 and 4 and x.available_contexts>=5),md5(seed||stage||x.target)
  loop
   select array_agg(t.clue order by t.clue) clues,array_agg(t.context_name order by t.clue) senses
   into pool from ascent_game.ascent_target_clues t
   where t.target=target_row.target and (t.context_name='opening theme')=(stage=1)
    and not ascent_game.is_displayed_clue(array[t.clue],t.target) and t.clue<>all(used_clues);
   if cardinality(pool.clues)<6 then continue;end if;
   tested_signatures:='{}';
   for attempt in 1..64 loop
    with available as (
     select * from unnest(pool.clues,pool.senses) t(clue,sense)
    ), senses as (
     select sense from available group by sense order by md5(seed||stage||attempt||sense) limit stage
    ), sample as (
     select clue,sense,row_number() over(partition by (position(' ' in clue)>0) order by md5(seed||stage||attempt||clue)) rn
     from available join senses using(sense)
    )
    select array_agg(clue order by md5(seed||stage||'pos'||clue)) into holds from sample
    where rn<=case when position(' ' in clue)>0 then (case when attempt>40 then 2 else phrase_goal end) else 6-(case when attempt>40 then 2 else phrase_goal end) end
    having count(*)=6 and count(distinct sense)=stage;
    if holds is null then continue;end if;
    candidate_signature:=ascent_game.pitch_signature(jsonb_build_object('clues',holds));
    if candidate_signature=any(tested_signatures) then continue;end if;
    tested_signatures:=array_append(tested_signatures,candidate_signature);
    if candidate_signature=any(issued) or candidate_signature=any(issued_by_player) or exists(select 1 from ascent_game.published_pitches p where p.signature=candidate_signature) then continue;end if;
    select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 2 and 5),count(*) filter(where hits between 3 and 5),count(*) filter(where hits in (4,5)),count(distinct pattern) filter(where hits between 2 and 5)
     into answer_count,hits6,partials,strong_decoys,near_decoys,distinct_patterns from (
      select a.word,count(*) hits,array_agg(a.clue order by a.clue) pattern from ascent_game.association_scores_v7 a where a.clue=any(holds) and a.strength>=65 and a.word<>all(holds) group by a.word
     ) matches;
    if hits6 not between 1 and 2 or (stage>=2 and hits6<>1) or partials<5 or answer_count<(case when attempt>40 then 65 else 75 end) or distinct_patterns<(case when attempt>40 then 3 else 4 end) or (stage>=2 and strong_decoys<2) or (stage>=4 and (strong_decoys<3 or near_decoys<1)) or (select count(*) from jsonb_object_keys(ascent_game.match_guess(7,holds,target_row.target)))<>6 then continue;end if;
    pitches:=pitches||jsonb_build_array(jsonb_build_object('target',target_row.target,'clues',holds,'contexts',stage));
    used_targets:=array_append(used_targets,target_row.target);used_clues:=used_clues||holds;
    found_board:=true;exit;
   end loop;
   exit when found_board;
  end loop;
  if not found_board then return ascent_game.generate_misdirection_climb(seed,player);end if;
 end loop;
 return pitches;
end;$function$;
revoke all on function ascent_game.generate_fast_practice_climb(text,uuid) from public,anon,authenticated;

