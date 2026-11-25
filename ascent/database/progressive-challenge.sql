-- Applied to production after semantic-matching.sql and its embedding backfill.
-- Difficulty estimates are heuristic, not observed human solve rates.
-- 20261125010056
alter table ascent_game.rich_tier_boards_v7 add column if not exists difficulty_grade smallint not null default 1 check(difficulty_grade between 0 and 2);
alter table ascent_game.rich_tier_boards_v7 add column if not exists challenge_score numeric(7,4) not null default 0.15;

-- Embedding-based estimates, not measured human solve probabilities.
-- 0: obvious; 1: moderate; 2: more challenging.
with metrics as (
 select b.target,b.clues,
 (select avg(1-(c.embedding operator(extensions.<=>) t.embedding)) from unnest(b.clues) w join ascent_game.semantic_word_vectors c on c.word=w join ascent_game.semantic_word_vectors t on t.word=b.target) target_sim,
 (select max(1-(c.embedding operator(extensions.<=>) t.embedding)) from unnest(b.clues) w join ascent_game.semantic_word_vectors c on c.word=w join ascent_game.semantic_word_vectors t on t.word=b.target) giveaway,
 (select avg(1-(a.embedding operator(extensions.<=>) c.embedding)) from unnest(b.clues) with ordinality u(w,i) join ascent_game.semantic_word_vectors a on a.word=u.w cross join unnest(b.clues) with ordinality v(w,j) join ascent_game.semantic_word_vectors c on c.word=v.w where u.i<v.j) cohesion
 from ascent_game.rich_tier_boards_v7 b
), rated as (
 select target,clues,
 case when giveaway>=.9 or target_sim>=.837 or cohesion>=.824 then 0 when target_sim<=.818 and giveaway<=.865 and cohesion<=.805 then 2 else 1 end grade,
 coalesce(1-(.55*target_sim+.25*giveaway+.20*cohesion),.15) challenge
 from metrics
)
update ascent_game.rich_tier_boards_v7 b set difficulty_grade=r.grade,challenge_score=r.challenge from rated r where r.target=b.target and r.clues=b.clues;

do $patch$
declare d text;n text;
begin
 select pg_get_functiondef('ascent_game.generate_varied_climb(text,uuid)'::regprocedure) into d;
 n:=replace(d,'select b.target,b.clues,b.tier_witnesses,b.tier_counts,ascent_game.pitch_signature','select b.target,b.clues,b.tier_witnesses,b.tier_counts,b.difficulty_grade,b.challenge_score,ascent_game.pitch_signature');
 n:=replace(n,'where b.target<>all(used_targets)','where b.difficulty_grade>0 and b.target<>all(used_targets)');
 n:=replace(n,'(b.phrase_count<>required_phrases),(select count(*) from unnest(b.clues) c where c=any(prior_clues)),coalesce(u.n,0)', '(b.phrase_count<>required_phrases),(case when i>=2 then b.difficulty_grade<>2 else false end),(select count(*) from unnest(b.clues) c where c=any(prior_clues)),coalesce(u.n,0)');
 n:=replace(n,'pitches:=pitches||jsonb_build_array(jsonb_build_object(''target'',selected.target,''clues'',shuffled));','pitches:=pitches||jsonb_build_array(jsonb_build_object(''target'',selected.target,''clues'',shuffled,''difficulty'',selected.difficulty_grade,''challenge'',selected.challenge_score));');
 n:=replace(n,'return (select jsonb_agg(p order by partial_paths desc,position) from (select p,u.position,(select count(*) from (select s.word from ascent_game.association_scores_v7 s where s.clue in(select jsonb_array_elements_text(p->''clues'')) and s.word not in(select jsonb_array_elements_text(p->''clues'')) and s.strength>=65 group by s.word having count(*) between 3 and 5) q) partial_paths from jsonb_array_elements(pitches) with ordinality u(p,position)) ranked);','return (select jsonb_agg(p - ''difficulty'' - ''challenge'' order by (p->>''difficulty'')::int,(p->>''challenge'')::numeric,position) from jsonb_array_elements(pitches) with ordinality u(p,position));');
 if n=d or n not like '%b.difficulty_grade>0%' or n not like '%case when i>=2 then b.difficulty_grade<>2%' or n not like '%p - ''difficulty'' - ''challenge''%' then raise exception 'Difficulty patch mismatch';end if;
 execute n;
end;$patch$;