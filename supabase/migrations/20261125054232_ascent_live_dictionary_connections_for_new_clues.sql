create or replace function ascent_game.guess_forms(raw text)
returns text[] language sql immutable set search_path to '' as $$
with base as (select regexp_replace(btrim(regexp_replace(regexp_replace(lower(regexp_replace(coalesce(raw,''),'[’'']','','g')),'[[:space:]‐‑–—-]+',' ','g'),'[.!?]+$','','g')),'^(a|an|the) +','','i') g),
forms as (select g from base union select left(g,-1) from base where length(g)>3 and g like '%s' and g not like '%ss' union select left(g,-3)||'y' from base where g like '%ies' and length(g)>4 union select left(g,-2) from base where g ~ '(ch|sh|s|x|z)es$')
select coalesce(array_agg(g order by g),'{}') from forms where g<>''
$$;
create or replace function ascent_game.live_dictionary_links(clues text[], guess text, known jsonb)
returns jsonb language sql stable set search_path to '' as $$
with g as materialized (select distinct m.synset from ascent_game.wordnet_members m where m.word=any(ascent_game.guess_forms(guess))),
c as materialized (select distinct clue,m.synset from unnest(clues) clue join ascent_game.wordnet_members m on m.word=clue where not known ? clue),
paths as (
 select c.clue,'Same dictionary meaning as '||c.clue reason,100 priority from c join g using(synset)
 union all select c.clue,case r.rel when 'hypernym' then clue||' is a specific type of '||guess when 'mero_part' then guess||' is a component of '||clue when 'mero_substance' then guess||' is a material in '||clue when 'mero_member' then guess||' is a member of '||clue when 'similar' then 'Closely related dictionary meaning' when 'entails' then clue||' entails '||guess when 'causes' then clue||' can cause '||guess end,90
 from c join ascent_game.wordnet_relations r on r.src=c.synset join g on g.synset=r.dst
 where r.rel in ('hypernym','mero_part','mero_substance','mero_member','similar','entails','causes') and (r.rel<>'hypernym' or (select count(*) from ascent_game.wordnet_relations x where x.dst=r.dst and x.rel='hypernym')<=35)
 union all select c.clue,case r.rel when 'hypernym' then guess||' is a specific type of '||clue when 'mero_part' then clue||' is a component of '||guess when 'mero_substance' then clue||' is a material in '||guess when 'mero_member' then clue||' is a member of '||guess when 'similar' then 'Closely related dictionary meaning' when 'entails' then guess||' entails '||clue when 'causes' then guess||' can cause '||clue end,90
 from g join ascent_game.wordnet_relations r on r.src=g.synset join c on c.synset=r.dst
 where r.rel in ('hypernym','mero_part','mero_substance','mero_member','similar','entails','causes') and (r.rel<>'hypernym' or (select count(*) from ascent_game.wordnet_relations x where x.dst=r.dst and x.rel='hypernym')<=35)
), chosen as (select distinct on(clue) clue,reason from paths where reason is not null and not exists(select 1 from ascent_game.rejected_associations x where x.clue=paths.clue and x.word=any(ascent_game.guess_forms(guess))) order by clue,priority desc,reason)
select case when guess !~ '^[a-z0-9]+( [a-z0-9]+){0,7}$' or guess ~ '(^| )(not|unrelated|none|except|without|or)( |$)' or guess in ('thing','object','entity','stuff','part','type','kind','group','person','something','anything','everything','activity','action','event','matter','process') or ascent_game.is_displayed_clue(clues,guess) then known else known||coalesce((select jsonb_object_agg(clue,reason||' — Open English WordNet') from chosen),'{}') end
$$;
create or replace function ascent_game.generated_links(board jsonb,guess text)
returns jsonb language sql stable set search_path to '' as $$
with forms as (select ascent_game.guess_forms(guess) g),
answers as (select a, a->>'word' answer_word, ord from jsonb_array_elements(coalesce(board->'answers','[]'::jsonb)) with ordinality x(a,ord)),
ranked as (
 select a,answer_word,ord,case when answer_word=lower(btrim(guess)) then 0 when ascent_game.guess_forms(answer_word)&&g then 1
 when exists(select 1 from ascent_game.wordnet_members m join ascent_game.wordnet_members n using(synset) where m.word=any(g) and n.word=answers.answer_word and (select count(*) from ascent_game.wordnet_members z where z.word=m.word)=1 and (select count(*) from ascent_game.wordnet_members z where z.word=n.word)=1) then 2 end rank
 from answers cross join forms
), picked as (select * from ranked where rank is not null order by rank,ord limit 1)
select case when ascent_game.is_displayed_clue(array(select jsonb_array_elements_text(board->'clues')),guess) then '{}'::jsonb else coalesce((select jsonb_object_agg(c.clue,case when rank=2 then 'Equivalent answer “'||answer_word||'” — '||r.reason else r.reason end)
 from picked cross join lateral jsonb_array_elements_text(board->'clues') with ordinality c(clue,i)
 cross join lateral jsonb_array_elements_text(a->'reasons') with ordinality r(reason,i)
 where c.i=r.i and r.reason is not null and not exists(select 1 from ascent_game.rejected_associations x where x.clue=c.clue and x.word=any(ascent_game.guess_forms(guess)||array[answer_word]))),'{}'::jsonb) end
$$;
revoke all on function ascent_game.guess_forms(text) from public,anon,authenticated;
revoke all on function ascent_game.live_dictionary_links(text[],text,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION ascent_game.semantic_complete_guess(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare normalized text; corrected text; missing text[]; more jsonb; result jsonb;
begin
 normalized:=lower(btrim(regexp_replace(regexp_replace(coalesce(guess,''),'[’'']','','g'),'[[:space:]‐‑–—-]+',' ','g')));
 normalized:=btrim(regexp_replace(normalized,'[.!?]+$','','g'));
 if ascent_game.is_displayed_clue(clues,normalized) then return '{}'::jsonb;end if;
 if normalized=any(clues) or (select count(*) from jsonb_object_keys(known))=cardinality(clues) then return ascent_game.filter_rejected_associations(normalized,known);end if;
 corrected:=normalized;
 known:=ascent_game.live_dictionary_links(clues,normalized,ascent_game.knowledge_matches(clues,normalized,known));
 if known='{}'::jsonb then
  corrected:=ascent_game.correct_spelling(normalized);
  if ascent_game.is_displayed_clue(clues,corrected) then return '{}'::jsonb;end if;
  if corrected<>normalized then known:=ascent_game.match_guess(7,clues,corrected);end if;
 end if;
 -- Reciprocal high-confidence registered relationships are direct evidence, not similarity guesses.
 known:=known||coalesce((select jsonb_object_agg(s.word,s.reason||' (reciprocal registered relationship)') from ascent_game.association_scores_v7 s where s.clue=corrected and s.word=any(clues) and not known ? s.word and s.strength>=85 and s.reason not like 'Semantic link via %' and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=s.word and r.word=corrected) or (r.clue=corrected and r.word=s.word))),'{}'::jsonb);
 known:=ascent_game.complete_equivalent_answers(clues,corrected,known);
 if corrected<>normalized then known:=ascent_game.live_dictionary_links(clues,corrected,ascent_game.knowledge_matches(clues,corrected,known));end if;
 missing:=array(select c from unnest(clues) c where not known ? c);
 if cardinality(missing)>0 then result:=ascent_game.llm_complete(clues,corrected,ticket,known);else result:=known;end if;
 result:=ascent_game.filter_rejected_associations(corrected,result);
 if corrected<>normalized and result<>'{}'::jsonb then
  select jsonb_object_agg(key,'Interpreted as “'||corrected||'” — '||value) into result from jsonb_each_text(result);
 end if;
 return result;
exception when others then return known;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.preview_registered_guess(clues text[], guess text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with base as (select ascent_game.live_dictionary_links(clues,guess,ascent_game.knowledge_matches(clues,guess,ascent_game.complete_equivalent_answers(clues,guess,ascent_game.match_guess(7,clues,guess)))) known), v as (select embedding from ascent_game.semantic_word_vectors where word=guess)
 select case when ascent_game.is_displayed_clue(clues,guess) then '{}'::jsonb else ascent_game.filter_rejected_associations(guess,ascent_game.llm_cached_matches(clues,guess,known||coalesce((select ascent_game.vector_clue_matches(array(select c from unnest(clues) c where not known ? c),guess,embedding) from v where (select enabled from ascent_game.semantic_config where singleton)), '{}'::jsonb))) end from base
$function$;
