-- Deploy ascent-reasoning/index.ts r2 before applying this migration.
-- Older AI cache verdicts remain stored but are no longer scored.
create table ascent_game.rejected_associations(clue text not null,word text not null,reason text not null,primary key(clue,word));
alter table ascent_game.rejected_associations enable row level security;
revoke all on ascent_game.rejected_associations from public,anon,authenticated;
insert into ascent_game.rejected_associations values ('wrench set','power','A standard wrench set is a hand tool.'),('screw','power','A screw is a fastener, not a power source.'),('queue','writing','Writing while waiting is incidental.'),('banjo','orchestra','A banjo is not a standard orchestral instrument.');
create function ascent_game.filter_rejected_associations(guess text,links jsonb) returns jsonb language sql stable set search_path='' as $fn$
select coalesce(jsonb_object_agg(e.key,e.value),'{}') from jsonb_each(links) e where not exists(select 1 from ascent_game.rejected_associations r where r.clue=e.key and r.word=guess)
$fn$;
revoke all on function ascent_game.filter_rejected_associations(text,jsonb) from public,anon,authenticated;
do $patch$ declare d text;n text;f text;begin
foreach f in array array['ascent_game.llm_complete(text[],text,uuid,jsonb)','ascent_game.llm_cached_matches(text[],text,jsonb)','public.ascent_top_answers(uuid,date,date,uuid,integer)'] loop
 select pg_get_functiondef(f::regprocedure) into d;
 n:=replace(d,'llama70b-r1','llama70b-r2');
 if n=d then raise exception 'Cache version patch mismatch: %',f;end if;execute n;
end loop;
select pg_get_functiondef('ascent_game.semantic_complete_guess(text[],text,uuid,jsonb)'::regprocedure) into d;
n:=replace(d,'if corrected<>normalized and result<>''{}''::jsonb then','result:=ascent_game.filter_rejected_associations(corrected,result);
 if corrected<>normalized and result<>''{}''::jsonb then');
n:=replace(n,'then return known;end if;
 corrected:=normalized;','then return ascent_game.filter_rejected_associations(normalized,known);end if;
 corrected:=normalized;');
if n=d then raise exception 'Rejected association filter patch mismatch';end if;execute n;
select pg_get_functiondef('ascent_game.preview_registered_guess(text[],text)'::regprocedure) into d;
n:=replace(d,'select ascent_game.llm_cached_matches(clues,guess,','select ascent_game.filter_rejected_associations(guess,ascent_game.llm_cached_matches(clues,guess,');
n:=replace(n,'''{}''::jsonb)) from base','''{}''::jsonb))) from base');
if n=d then raise exception 'Preview filter patch mismatch';end if;execute n;
end;$patch$;
insert into ascent_game.association_scores_v7(clue,word,strength,reason) values ('lightning','power',90,'Lightning releases electrical energy at enormous power.'),('battery','power',95,'A battery supplies electrical power.'),('electric motor','power',95,'An electric motor converts electrical power into motion.') on conflict do nothing;
insert into ascent_game.match_regression_cases(clue,guess,expected) values ('wrench set','power',false),('screw','power',false),('lightning','power',true),('battery','power',true),('electric motor','power',true),('queue','writing',false),('banjo','orchestra',false) on conflict do nothing;
-- Prefer competing subsets of clues rather than counting synonyms as separate distractions.
alter table ascent_game.misdirection_boards add column distinct_partial_patterns int not null default 0;
with links as materialized(select clue,word from ascent_game.association_scores_v7 where strength>=78 union select clue,word from ascent_game.knowledge_edges where strength>=85),
patterns as (select b.target,b.clues,l.word,array_agg(l.clue order by l.clue) pattern from ascent_game.misdirection_boards b join links l on l.clue=any(b.clues) where b.verified and l.word<>all(b.clues) and l.word<>b.target group by b.target,b.clues,l.word having count(*) between 2 and 4),
stats as (select target,clues,count(distinct pattern)::int n from patterns group by target,clues)
update ascent_game.misdirection_boards b set distinct_partial_patterns=s.n from stats s where b.target=s.target and b.clues=s.clues;
do $patch$ declare d text;n text;begin
select pg_get_functiondef('ascent_game.generate_misdirection_climb(text,uuid)'::regprocedure) into d;
n:=replace(d,'(case when i<=2 then b.domains<>4 else b.domains<>5 end),','(case when i<=2 then b.domains<>4 else b.domains<>5 end),
   (b.distinct_partial_patterns<3),');
n:=replace(n,'(case when i<=2 then -b.partial_paths else b.near_perfect_paths end),','(case when i<=2 then -b.partial_paths else b.near_perfect_paths end), -least(b.distinct_partial_patterns,8),');
if n=d then raise exception 'Misdirection pattern patch mismatch';end if;execute n;end;$patch$;