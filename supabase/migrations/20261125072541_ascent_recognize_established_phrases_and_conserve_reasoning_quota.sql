create or replace function ascent_game.established_phrase_links(clues text[],guess text,known jsonb)
returns jsonb language sql stable set search_path to '' as $$
with candidates as (
 select c.clue,p.phrase from unnest(clues)c(clue)
 cross join lateral (values(guess||' '||c.clue),(c.clue||' '||guess))p(phrase)
 where not known ? c.clue and length(p.phrase)<=100
 and exists(select 1 from ascent_game.wordnet_members m where m.word=p.phrase)
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=c.clue and r.word=guess) or (r.word=c.clue and r.clue=guess))
), best as (select distinct on(clue) clue,phrase from candidates order by clue,phrase)
select case when guess is null or guess !~ '^[a-z]+( [a-z]+){0,5}$'
 or guess ~ '(^| )(not|unrelated|none|except|without|or)( |$)'
 or guess in ('thing','object','entity','stuff','part','type','kind','group','person','something','anything','everything','activity','action','event','matter','process')
 or ascent_game.is_displayed_clue(clues,guess) then known
 else known||coalesce((select jsonb_object_agg(clue,'Together they form the established expression “'||phrase||'”.') from best),'{}'::jsonb) end
$$;
revoke all on function ascent_game.established_phrase_links(text[],text,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION ascent_game.semantic_complete_guess(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare normalized text; corrected text; missing text[]; more jsonb; result jsonb;
begin
 perform set_config('ascent.match_incomplete','false',true);
 normalized:=lower(btrim(regexp_replace(regexp_replace(coalesce(guess,''),'[’'']','','g'),'[[:space:]‐‑–—-]+',' ','g')));
 normalized:=btrim(regexp_replace(normalized,'[.!?]+$','','g'));
 if ascent_game.is_displayed_clue(clues,normalized) then return '{}'::jsonb;end if;
 known:=ascent_game.filter_rejected_associations(normalized,known);
 if normalized=any(clues) or (select count(*) from jsonb_object_keys(known))=cardinality(clues) then return known;end if;
 corrected:=normalized;
 known:=ascent_game.established_phrase_links(clues,normalized,ascent_game.direct_fact_links(clues,normalized,known));
 known:=ascent_game.local_association_variants(clues,normalized,known);
 known:=ascent_game.live_dictionary_links(clues,normalized,ascent_game.knowledge_matches(clues,normalized,known));
 known:=ascent_game.direct_synonym_links(clues,normalized,known);
 if known='{}'::jsonb then
  corrected:=ascent_game.correct_spelling(normalized);
  if ascent_game.is_displayed_clue(clues,corrected) then corrected:=normalized;end if;
  if corrected<>normalized then known:=ascent_game.established_phrase_links(clues,corrected,ascent_game.direct_fact_links(clues,corrected,ascent_game.local_association_variants(clues,corrected,ascent_game.match_guess(7,clues,corrected))));end if;
 end if;
 -- Reciprocal high-confidence registered relationships are direct evidence, not similarity guesses.
 known:=known||coalesce((select jsonb_object_agg(s.word,s.reason||' (reciprocal registered relationship)') from ascent_game.association_scores_v7 s where s.clue=corrected and s.word=any(clues) and not known ? s.word and s.strength>=85 and s.reason not like 'Semantic link via %' and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=s.word and r.word=corrected) or (r.clue=corrected and r.word=s.word))),'{}'::jsonb);
 known:=ascent_game.complete_equivalent_answers(clues,corrected,known);
 if corrected<>normalized then known:=ascent_game.direct_synonym_links(clues,corrected,ascent_game.live_dictionary_links(clues,corrected,ascent_game.knowledge_matches(clues,corrected,known)));end if;
 -- Do not silently substitute an unfamiliar but valid word unless the correction has local evidence.
 if corrected<>normalized and known='{}'::jsonb then corrected:=normalized;end if;
 missing:=array(select c from unnest(clues) c where not known ? c);
 if cardinality(missing)>0 then result:=ascent_game.llm_complete(clues,corrected,ticket,known);else result:=known;end if;
 result:=ascent_game.filter_rejected_associations(corrected,result);
 if corrected<>normalized and result<>'{}'::jsonb then
  select jsonb_object_agg(key,'Interpreted as “'||corrected||'” — '||value) into result from jsonb_each_text(result);
 end if;
 return result;
exception when others then perform set_config('ascent.match_incomplete','true',true);return known;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.preview_registered_guess(clues text[], guess text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with base as (select ascent_game.direct_synonym_links(clues,guess,ascent_game.live_dictionary_links(clues,guess,ascent_game.knowledge_matches(clues,guess,ascent_game.complete_equivalent_answers(clues,guess,ascent_game.local_association_variants(clues,guess,ascent_game.established_phrase_links(clues,guess,ascent_game.direct_fact_links(clues,guess,ascent_game.match_guess(7,clues,guess)))))))) known), v as (select embedding from ascent_game.semantic_word_vectors where word=guess)
 select case when ascent_game.is_displayed_clue(clues,guess) then '{}'::jsonb else ascent_game.filter_rejected_associations(guess,ascent_game.llm_cached_matches(clues,guess,known||coalesce((select ascent_game.vector_clue_matches(array(select c from unnest(clues) c where not known ? c),guess,embedding) from v where (select enabled from ascent_game.semantic_config where singleton)), '{}'::jsonb))) end from base
$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_complete(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '^(not|unrelated|none|except|without)($| )' or guess ~ '(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 if not coalesce(enabled_flag,false) then if (select count(*) from jsonb_object_keys(result))<cardinality(clues) then perform set_config('ascent.match_incomplete','true',true);end if;return result;end if;
 missing:=array(select x from unnest(clues) x where not result ? x
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=x and r.word=$2) or (r.word=x and r.clue=$2))
 and not exists(select 1 from ascent_game.llm_pair_cache k where ((k.guess=$2 and k.clue=x) or (k.guess=x and k.clue=$2)) and k.version='gptoss120b-r6' and not k.accepted and k.created_at>now()-interval '4 hours'));
 -- Known, cached and vector-backed matches are ready to score locally.
 if cardinality(missing)=0 then return result;end if;
 -- Obvious keyboard noise cannot form a conventional relationship.
 if guess !~ '[aeiouy]' and length(guess)>=4 or guess ~ '([a-z])\1\1\1' then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'gptoss120b-r6' or jsonb_typeof(reply->'matches') is distinct from 'object' then
   -- Never stack a second model request on a slow or timed-out request.
   perform set_config('ascent.match_incomplete','true',true);return result;
 end if;
 if exists(select 1 from jsonb_each(reply->'matches') e where e.key<>all(missing) or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}') not between 4 and 150) then perform set_config('ascent.match_incomplete','true',true);return result;end if;
 foreach c in array missing loop
  explanation:=reply->'matches'->>c;
  insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason) values(guess,c,'gptoss120b-r6',explanation is not null,coalesce(explanation,'')) on conflict on constraint llm_pair_cache_pkey do update set accepted=excluded.accepted,reason=excluded.reason,created_at=now();
  if explanation is not null then result:=result||jsonb_build_object(c,explanation||' — AI relationship');end if;
 end loop;
 return result;
exception when others then perform set_config('ascent.match_incomplete','true',true);return result;
end;$function$;
