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
 -- Use registered evidence in a single set-based query, not the expensive
 -- full live guess resolver for each candidate word.
 select word,clues,links from raw
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
$function$

