create function public.ascent_top_answers(p_ticket uuid,p_day date,p_archive date default null,p_seed uuid default null,p_pitch int default 1)
returns jsonb language sql stable security definer set search_path='' as $$
with board as (
 select c.lex_version, array(select jsonb_array_elements_text(c.boards->(p_pitch-1)->'clues')) clues
 from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when p_seed is null then 'daily:'||to_char(r.day,'YYYY-MM-DD') else 'practice:'||p_seed end
 where r.ticket=p_ticket and r.day=p_day and jsonb_array_length(r.history)=5
 and r.scope=case when p_seed is not null then 'practice:'||p_seed when p_archive=p_day then 'replay' else 'daily' end
 and p_pitch between 1 and 5
), matches as (
 select e.key word,count(*)::int hits,jsonb_object_agg(l.clue,e.value) links,b.clues
 from board b join ascent_game.circuit_lexicon l on l.edition=b.lex_version and l.clue=any(b.clues)
 cross join lateral jsonb_each_text(l.links) e
 where e.key<>all(b.clues) group by e.key,b.clues
), ranked as (
 select word,hits,links,case when hits=6 then 200 else 10*(hits*(hits+1)/2+
 (select count(*) from generate_series(1,3) i where links ? clues[i] and links ? clues[i+3])) end points
 from matches order by points desc,word collate "C" limit 100
)
select coalesce(jsonb_agg(jsonb_build_object('word',word,'hits',hits,'links',links,'points',points) order by points desc,word collate "C"),'[]') from ranked;
$$;
revoke all on function public.ascent_top_answers(uuid,date,date,uuid,int) from public;
grant execute on function public.ascent_top_answers(uuid,date,date,uuid,int) to anon,authenticated;
notify pgrst,'reload schema';