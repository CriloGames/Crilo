-- Already applied to production; apply after phrase-answers-and-connections.sql.
-- 20261125000604 ascent_diverse_themes_and_progressive_difficulty
create or replace function ascent_game.target_family(term text) returns text language sql immutable set search_path='' as $fn$
select case
 when term in ('music','musician','performance','sound','concert','orchestra','instrument','pitch') then 'music and sound'
 when term in ('computer','keyboard','hardware','screen','mouse','software') then 'computing'
 when term in ('electricity','power','charge','current','energy') then 'electricity'
 when term in ('road','car','vehicle','transport','railway','train','track','drive') then 'land travel'
 when term in ('boat','sea','water','wave','port','river','seal','ocean','ship','swimming') then 'water'
 when term in ('sport','ball','team','game','baseball','tennis','race','strike','golf','athlete') then 'sports'
 when term in ('money','bank','finance','investment','payment','capital') then 'finance'
 when term in ('food','fruit','drink','cooking','breakfast','orange','jam') then 'food and drink'
 when term in ('fire','heat','light','ice','weather','storm','cold') then 'weather and energy'
 when term in ('medicine','health','doctor','dentist') then 'health'
 when term in ('tools','construction','metal','bolt') then 'materials and tools'
 when term in ('animal','pet','bird') then 'animals'
 else term end
$fn$;
revoke all on function ascent_game.target_family(text) from public,anon,authenticated;
do $patch$
declare d text; n text;
begin
select pg_get_functiondef('ascent_game.generate_varied_climb(text,uuid)'::regprocedure) into d;
n:=replace(d,'used_targets text[]:=''{}'';','used_targets text[]:=''{}''; used_families text[]:=''{}'';');
n:=replace(n,'order by coalesce(u.n,0), (select count(*) from unnest(b.clues) c where c=any(prior_clues)),coalesce(g.n,0),md5','order by (ascent_game.target_family(b.target)=any(used_families)),coalesce(u.n,0), (select count(*) from unnest(b.clues) c where c=any(prior_clues)),coalesce(g.n,0),md5');
n:=replace(n,'order by (select count(*) from unnest(b.clues) c where c=any(used_clues)),','order by (select count(*) from unnest(b.clues) c where c=any(used_clues)),(ascent_game.target_family(b.target)=any(used_families)),');
n:=replace(n,'used_targets:=array_append(used_targets,selected.target);','used_targets:=array_append(used_targets,selected.target);used_families:=array_append(used_families,ascent_game.target_family(selected.target));');
n:=replace(n,' return pitches;',' return (select jsonb_agg(p order by partial_paths desc,target_strength desc,i) from (
 select p,i,(select count(*) from (select s.word from ascent_game.association_scores_v7 s where s.clue in(select jsonb_array_elements_text(p->''clues'')) and s.word not in(select jsonb_array_elements_text(p->''clues'')) and s.strength>=65 group by s.word having count(*) between 3 and 5) q) partial_paths,
 (select avg(s.strength) from ascent_game.association_scores_v7 s where s.clue in(select jsonb_array_elements_text(p->''clues'')) and s.word=p->>''target'') target_strength
 from jsonb_array_elements(pitches) with ordinality u(p,i)) ranked);');
if n=d or n not like '%used_families:=array_append%' or n not like '%partial_paths desc%' then raise exception 'Generator patch mismatch';end if;
execute n;
end;$patch$;

-- 20261125000614 ascent_qualify_progression_order
do $patch$ declare d text; n text; begin select pg_get_functiondef('ascent_game.generate_varied_climb(text,uuid)'::regprocedure) into d; n:=replace(d,'target_strength desc,i) from (','target_strength desc,ranked.position) from ('); n:=replace(n,'select p,i,(select count(*)','select p,u.position,(select count(*)'); n:=replace(n,'with ordinality u(p,i)) ranked','with ordinality u(p,position)) ranked'); if n=d or n not like '%ranked.position%' then raise exception 'Patch mismatch';end if;execute n;end;$patch$;