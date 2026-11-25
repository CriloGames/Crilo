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
 where r.ticket=p_ticket and r.day=p_day and jsonb_array_length(r.history)>=p_pitch
 and r.scope=case when p_seed is not null then 'practice:'||p_seed when p_archive=p_day then 'replay' else 'daily' end and p_pitch between 1 and 5
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
), evaluated as materialized (
 select word,clues,links,lex_version from raw where hits>=1
), matched as (
 select *, (select count(*)::int from jsonb_object_keys(links)) hits,
 array(select jsonb_object_keys(links) order by 1) pattern
 from evaluated
), ranked as materialized (
 select m.word,m.hits,m.links,m.pattern,
 case when m.hits=6 then 200 else 10*(m.hits*(m.hits+1)/2+(select count(*) from generate_series(1,3) i where m.links ? m.clues[i] and m.links ? m.clues[i+3])) end points,
 (select sum(case
  when exists(select 1 from ascent_game.direct_connection_facts f where (f.clue=e.clue and f.word=m.word) or (f.word=e.clue and f.clue=m.word)) then 110
  when exists(select 1 from ascent_game.llm_pair_cache k where k.clue=e.clue and k.guess=m.word and k.accepted and k.version='ascent-reviewed-v1') then 105
  else greatest(coalesce((select max(s.strength) from ascent_game.association_scores_v7 s where s.clue=e.clue and s.word=m.word),0),coalesce((select max(k.strength) from ascent_game.knowledge_edges k where k.clue=e.clue and k.word=m.word),0),65)
 end) from jsonb_object_keys(m.links) e(clue)) evidence
 from matched m where m.hits>=1 and not ascent_game.is_displayed_clue(m.clues,m.word)
), diversified as (
 select *,row_number() over(partition by hits,pattern order by evidence desc,points desc,word collate "C") pattern_rank
 from ranked
), tier_ranked as (
 select *,row_number() over(partition by hits order by pattern_rank,evidence desc,points desc,word collate "C") tier_rank
 from diversified
), chosen as (
 select * from tier_ranked where hits=6 or tier_rank<=case hits when 5 then 3 when 4 then 5 when 3 then 5 when 2 then 5 when 1 then 5 else 0 end
)

select coalesce(jsonb_agg(jsonb_build_object('word',word,'hits',hits,'links',links,'points',points) order by hits desc,tier_rank),'[]') from chosen;
$function$;

CREATE OR REPLACE FUNCTION ascent_game.generate_quick_practice_climb(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb:='[]'; used_clues text[]:='{}'; used_targets text[]:='{}'; issued text[]; personal text[]; stage int; chosen record;
begin
 select coalesce(array_agg(ascent_game.pitch_signature(b)),'{}') into issued from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b;
 select coalesce(array_agg(distinct b->>'target'),'{}') into personal from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards)b where r.ticket=player;
 for stage in reverse 5..1 loop
  with available as materialized (
   select t.target,t.clue,t.context_name sense from ascent_game.ascent_target_clues t
   join ascent_game.association_scores_v7 a on a.clue=t.clue and a.word=t.target and a.strength>=65
   where (t.context_name='opening theme')=(stage=1) and t.target<>all(used_targets) and t.clue<>all(used_clues)
   and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=t.clue and r.word=t.target) or (r.word=t.clue and r.clue=t.target))
  ), targets as materialized (
   select target,count(distinct sense) senses from available group by target
   having count(distinct sense)>=stage and count(distinct clue)>=6
   order by target=any(personal),md5(seed||stage||target) limit 24
  ), sense_order as (
   select target,sense,k,row_number() over(partition by target,k order by md5(seed||stage||k||sense)) rn
   from (select distinct a.target,a.sense from available a join targets t using(target)) s cross join generate_series(1,12) k
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
   order by target=any(personal),md5(seed||stage||sig) limit 32
  ), scores as (
   select e.target,e.clues,e.sig,count(*) n,count(*) filter(where hits=6) fulls,count(*) filter(where hits between 2 and 5) partials,count(*) filter(where hits between 3 and 5) strong,count(*) filter(where hits in (4,5)) near,count(*) filter(where hits=5) fives,count(distinct hits) tier_coverage,count(distinct pattern) filter(where hits between 2 and 5) patterns
   from eligible e cross join lateral (
    select a.word,count(*) hits,array_agg(a.clue order by a.clue) pattern from ascent_game.association_scores_v7 a where a.clue=any(e.clues) and a.strength>=65 and a.word<>all(e.clues) and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=a.clue and r.word=a.word) or (r.word=a.clue and r.clue=a.word)) group by a.word
   )m group by e.target,e.clues,e.sig
  )
  select target,clues,sig into chosen from scores
  where fulls>=1 and not ascent_game.is_displayed_clue(clues,target)
  order by (tier_coverage=6) desc,tier_coverage desc,(n>=65 and fulls between 1 and 2 and (stage=1 or fulls=1) and partials>=5 and patterns>=3 and (stage=1 or strong>=2) and (stage<4 or (strong>=3 and near>=1))) desc, (fives>=2) desc,(fives>=1) desc, target=any(personal), (stage>=2 and fulls<>1), (stage>=4 and near=0), (n<65), md5(seed||stage||sig) limit 1;
  if not found then return ascent_game.generate_fast_practice_climb(seed,player);end if;
  result:=jsonb_build_array(jsonb_build_object('target',chosen.target,'clues',chosen.clues,'contexts',stage))||result;
  used_targets:=array_append(used_targets,chosen.target);used_clues:=used_clues||chosen.clues;
 end loop;
 return result;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.generate_misdirection_climb(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
 pitches jsonb:='[]'; used_targets text[]:='{}'; used_clues text[]:='{}';
 target_row record; pool record; holds text[]; stage int; attempt int; phrase_goal int;
 hits6 int; partials int; answer_count int; strong_decoys int; near_decoys int; five_decoys int; tier_coverage int; distinct_patterns int; candidate_signature text; found_board boolean;
 prior jsonb; issued text[]; issued_by_player text[];
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
    select t.target,count(distinct t.context_name) available_contexts from ascent_game.ascent_target_clues t where (t.context_name='opening theme')=(stage=1) and t.target<>all(used_targets)
    group by t.target having count(distinct context_name)>=stage and count(distinct clue)>=6
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
    if candidate_signature=any(issued) or candidate_signature=any(issued_by_player) or exists(select 1 from ascent_game.published_pitches p where p.signature=candidate_signature) then continue;end if;
    select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 2 and 5),count(*) filter(where hits between 3 and 5),count(*) filter(where hits in (4,5)),count(*) filter(where hits=5),count(distinct hits),count(distinct pattern) filter(where hits between 2 and 5)
     into answer_count,hits6,partials,strong_decoys,near_decoys,five_decoys,tier_coverage,distinct_patterns from (
      select a.word,count(*) hits,array_agg(a.clue order by a.clue) pattern from ascent_game.association_scores_v7 a where a.clue=any(holds) and a.strength>=65 and a.word<>all(holds) and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=a.clue and r.word=a.word) or (r.word=a.clue and r.clue=a.word)) group by a.word
     ) matches;
    if (attempt<=16 and tier_coverage<6) or (attempt<=8 and five_decoys<2) or hits6 not between 1 and 2 or (stage>=2 and hits6<>1) or partials<5 or answer_count<(case when attempt>40 then 65 else 75 end) or distinct_patterns<(case when attempt>40 then 3 else 4 end) or (stage>=2 and strong_decoys<2) or (stage>=4 and (strong_decoys<3 or near_decoys<1)) or (select count(*) from jsonb_object_keys(ascent_game.match_guess(7,holds,target_row.target)))<>6 then continue;end if;
    pitches:=pitches||jsonb_build_array(jsonb_build_object('target',target_row.target,'clues',holds,'contexts',stage));
    used_targets:=array_append(used_targets,target_row.target);used_clues:=used_clues||holds;
    found_board:=true;exit;
   end loop;
   exit when found_board;
  end loop;
  if not found_board then return ascent_game.generate_varied_climb(seed,player);end if;
 end loop;
 return pitches;
end;$function$;
