CREATE OR REPLACE FUNCTION ascent_game.generate_misdirection_climb(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare prior_signatures text[]; issued_signatures text[]; prior_targets text[]; prior_boards jsonb; recent_clues text[]; used_targets text[]:='{}'; used_clues text[]:='{}'; pitches jsonb:='[]'; selected record; shuffled text[]; i int; phrase_goal int;
begin
 select coalesce(array_agg(distinct ascent_game.pitch_signature(p)),'{}'),coalesce(array_agg(distinct p->>'target'),'{}')
 into prior_signatures,prior_targets from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards) p where r.ticket=player and c.route_id<>seed;
 select coalesce(array_agg(distinct ascent_game.pitch_signature(p)),'{}') into issued_signatures from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) p where c.route_id<>seed;
 select coalesce(array_agg(distinct clue),'{}') into recent_clues from (select c.boards from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end where r.ticket=player and c.route_id<>seed order by r.day desc limit 6) recent cross join lateral jsonb_array_elements(recent.boards) p cross join lateral jsonb_array_elements_text(p->'clues') clue;
 select coalesce(jsonb_agg(p->'clues'),'[]') into prior_boards from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' or r.scope like 'superseded:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards) p where r.ticket=player and c.route_id<>seed;
 for i in 1..5 loop
  phrase_goal:=2+case when i=1 and mod(get_byte(decode(md5(seed),'hex'),0),2)=1 then 1 else 0 end;
  select b.* into selected from ascent_game.misdirection_boards b
  where b.verified and not ascent_game.is_displayed_clue(b.clues,b.target) and b.target<>all(used_targets)
  and ascent_game.pitch_signature(jsonb_build_object('clues',b.clues))<>all(prior_signatures)
  and not exists(select 1 from ascent_game.published_pitches p where p.signature=ascent_game.pitch_signature(jsonb_build_object('clues',b.clues)))
  order by (ascent_game.pitch_signature(jsonb_build_object('clues',b.clues))=any(issued_signatures)),
   (select coalesce(max((select count(*) from jsonb_array_elements_text(old_clues) c where c=any(b.clues))),0)>=5 from jsonb_array_elements(prior_boards) old_clues),
   (b.target=any(prior_targets)),
   (case when i<=2 then b.domains<>4 else b.domains<>5 end),
   (b.distinct_partial_patterns<3),
   (select count(*) from unnest(b.clues) c where c=any(used_clues)),
   (case when i<=2 then b.bait_count<>3 else b.bait_count<>2 end),
   (b.phrase_count<>phrase_goal), (select count(*) from unnest(b.clues) c where c=any(recent_clues)),
   (case when i<=2 then b.partial_paths<2 else b.near_perfect_paths>2 end),
   md5(seed||i||b.target||array_to_string(b.clues,','))
  limit 1;
  if not found then return ascent_game.generate_varied_climb(seed,player);end if;
  select array_agg(c order by md5(seed||i||'position'||c)) into shuffled from unnest(selected.clues) c;
  pitches:=pitches||jsonb_build_array(jsonb_build_object('target',selected.target,'clues',shuffled));
  used_targets:=array_append(used_targets,selected.target);used_clues:=used_clues||selected.clues;
 end loop;
 return pitches;
end;$function$
;
CREATE OR REPLACE FUNCTION ascent_game.generate_varied_climb(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare prior_clues text[]; prior_signatures text[]; issued_signatures text[]; used_clues text[]:='{}'; used_targets text[]:='{}'; used_families text[]:='{}'; used_signatures text[]:='{}'; pitches jsonb:='[]'; candidate record; selected record; valid_candidate boolean; required_phrases int; i int; shuffled text[];
begin
 select coalesce(array_agg(distinct clue),'{}') into prior_clues
 from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end
 cross join lateral jsonb_array_elements(c.boards) p cross join lateral jsonb_array_elements_text(p->'clues') clue where r.ticket=player and c.route_id<>seed;
 select coalesce(array_agg(distinct ascent_game.pitch_signature(p)),'{}') into prior_signatures
 from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards) p where r.ticket=player and c.route_id<>seed;
 select coalesce(array_agg(distinct ascent_game.pitch_signature(p)),'{}') into issued_signatures from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) p where c.route_id<>seed;
 for i in 0..4 loop
  required_phrases:=2+case when i=mod(get_byte(decode(md5(seed),'hex'),1),5) and mod(get_byte(decode(md5(seed),'hex'),0),2)=1 then 1 else 0 end;
  valid_candidate:=false;
  for candidate in
   with personal as (
    select p->>'target' target,count(*) n from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards) p where r.ticket=player and c.route_id<>seed group by 1
   ), clue_usage as (
    select clue,count(*) n from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards) p cross join lateral jsonb_array_elements_text(p->'clues') clue where r.ticket=player and c.route_id<>seed group by 1
   ), overall as (
    select p->>'target' target,count(*) n from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) p where c.lex_version=7 group by 1
   ), history as (
    select ascent_game.pitch_signature(p) sig,max(r.day) last_seen from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when r.scope like 'practice:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end cross join lateral jsonb_array_elements(c.boards) p where r.ticket=player and c.route_id<>seed group by 1
   )
   select b.target,b.clues,b.tier_witnesses,b.tier_counts,b.difficulty_grade,b.challenge_score,ascent_game.pitch_signature(jsonb_build_object('clues',b.clues)) sig
   from ascent_game.rich_tier_boards_v7 b left join personal u on u.target=b.target left join overall g on g.target=b.target left join history h on h.sig=ascent_game.pitch_signature(jsonb_build_object('clues',b.clues))
   where b.semantic_verified and not ascent_game.is_displayed_clue(b.clues,b.target) and b.difficulty_grade>0 and b.target<>all(used_targets) and ascent_game.pitch_signature(jsonb_build_object('clues',b.clues))<>all(prior_signatures) and ascent_game.pitch_signature(jsonb_build_object('clues',b.clues))<>all(used_signatures)
    and not exists(select 1 from ascent_game.published_pitches p where p.signature=ascent_game.pitch_signature(jsonb_build_object('clues',b.clues)))
   order by (ascent_game.pitch_signature(jsonb_build_object('clues',b.clues))=any(issued_signatures)),(ascent_game.target_family(b.target)=any(used_families)),(select count(*) from unnest(b.clues) c where c=any(used_clues)),(select count(*) from ascent_game.circuits cc cross join lateral jsonb_array_elements(cc.boards) pp where cc.route_id<>seed and (select count(*) from jsonb_array_elements_text(pp->'clues') x where x=any(b.clues))>=5),(b.phrase_count<>required_phrases),coalesce(u.n,0),(case when i>=2 then b.quality<920 else false end),(case when i>=2 then b.difficulty_grade<>2 else false end),(select count(*) from unnest(b.clues) c where c=any(prior_clues)),(select coalesce(sum(cu.n),0) from unnest(b.clues) as cl(word) join clue_usage cu on cu.clue=cl.word),h.last_seen nulls first,coalesce(g.n,0),md5(seed||i||b.target||array_to_string(b.clues,','))
  loop
   if not exists(select 1 from jsonb_array_elements(candidate.tier_witnesses) with ordinality t(words,h) cross join lateral jsonb_array_elements_text(t.words) w(word) where (select count(*) from jsonb_object_keys(ascent_game.preview_registered_guess(candidate.clues,w.word)))<>t.h) then selected:=candidate;valid_candidate:=true;exit;end if;
  end loop;
  if not valid_candidate then raise exception 'No puzzle with sufficient answers at every tier is available';end if;
  select array_agg(c order by md5(seed||i||'position'||c)) into shuffled from unnest(selected.clues) c;
  pitches:=pitches||jsonb_build_array(jsonb_build_object('target',selected.target,'clues',shuffled,'difficulty',selected.difficulty_grade,'challenge',selected.challenge_score));
  used_clues:=used_clues||selected.clues;used_targets:=array_append(used_targets,selected.target);used_families:=array_append(used_families,ascent_game.target_family(selected.target));used_signatures:=array_append(used_signatures,selected.sig);
 end loop;
 return (select jsonb_agg(p - 'difficulty' - 'challenge' order by (p->>'difficulty')::int,(p->>'challenge')::numeric,position) from jsonb_array_elements(pitches) with ordinality u(p,position));
end;$function$
;
CREATE OR REPLACE FUNCTION public.ascent_top_answers(p_ticket uuid, p_day date, p_archive date DEFAULT NULL::date, p_seed uuid DEFAULT NULL::uuid, p_pitch integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
with board as (
 select c.lex_version,array(select jsonb_array_elements_text(c.boards->(p_pitch-1)->'clues')) clues
 from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when p_seed is null then 'daily:'||to_char(r.day,'YYYY-MM-DD') else 'practice:'||p_seed end
 where r.ticket=p_ticket and r.day=p_day and jsonb_array_length(r.history)=5
 and r.scope=case when p_seed is not null then 'practice:'||p_seed when p_archive=p_day then 'replay' else 'daily' end and p_pitch between 1 and 5
), raw as (
 select e.key word,count(distinct e.clue)::int hits,jsonb_object_agg(e.clue,e.value) links,b.clues,b.lex_version
 from board b cross join lateral (
 select l.clue,e.key,e.value from ascent_game.circuit_lexicon l cross join lateral jsonb_each_text(l.links) e where l.edition=b.lex_version and b.lex_version<>7 and l.clue=any(b.clues)
 union all select s.clue,s.word,s.reason||' ('||s.strength||'% match)' from ascent_game.association_scores_v7 s where b.lex_version=7 and s.clue=any(b.clues) and s.strength>=65
 union all select k.clue,k.word,k.source from ascent_game.knowledge_edges k where b.lex_version=7 and k.clue=any(b.clues)
 union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version='llama70b-r3' and k.accepted and k.created_at>now()-interval '30 days' and (select enabled from ascent_game.llm_config where singleton)
 ) e where e.key<>all(b.clues) group by e.key,b.clues,b.lex_version
), raw_ranked as (
 select *,row_number() over(partition by hits order by length(word),word collate "C") rn from raw
), witnesses as (
 select distinct w.word from board b join ascent_game.rich_tier_boards_v7 r on b.clues @> r.clues and r.clues @> b.clues and r.semantic_verified
 cross join lateral jsonb_array_elements(r.tier_witnesses) t(words) cross join lateral jsonb_array_elements_text(t.words) w(word)
), evaluated as materialized (
 select word,clues,case when lex_version=7 then ascent_game.preview_registered_guess(clues,word) else links end links
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
$function$
;