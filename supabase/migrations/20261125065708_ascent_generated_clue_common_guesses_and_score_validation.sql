create or replace function ascent_game.augment_generated_answers(p_clues text[],p_target text,p_answers jsonb,p_common jsonb)
returns jsonb language plpgsql stable set search_path to '' as $$
declare result jsonb:=p_answers; item jsonb; w text; why text; i int; pos int; slot int; reasons jsonb; a jsonb;
begin
 if jsonb_typeof(p_common) is distinct from 'array' or jsonb_array_length(p_common)<>6 then return result;end if;
 for i in 0..5 loop
  if jsonb_typeof(p_common->i) is distinct from 'array' then continue;end if;
  for item in select value from jsonb_array_elements(p_common->i) limit 3 loop
   if jsonb_typeof(item) is distinct from 'array' or jsonb_array_length(item)<>2 or jsonb_typeof(item->0) is distinct from 'string' or jsonb_typeof(item->1) is distinct from 'string' then continue;end if;
   w:=lower(btrim(item->>0));why:=btrim(item->>1);
   if w is null or length(w)>60 or w !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$' or w=p_target or ascent_game.is_displayed_clue(p_clues,w) or length(why) not between 8 and 150 or why ~* '^(related to|associated with|type of|kind of|used with|setting for)( |$)' or exists(select 1 from ascent_game.rejected_associations r where (r.clue=p_clues[i+1] and r.word=w) or (r.word=p_clues[i+1] and r.clue=w)) then continue;end if;
   select (ord-1)::int into pos from jsonb_array_elements(result) with ordinality t(a,ord) where t.a->>'word'=w limit 1;
   if pos is null then
    reasons:=jsonb_set('[null,null,null,null,null,null]'::jsonb,array[i::text],to_jsonb(why));
    result:=result||jsonb_build_array(jsonb_build_object('word',w,'reasons',reasons));
   elsif result->pos->'reasons'->i='null'::jsonb then
    result:=jsonb_set(result,array[pos::text,'reasons',i::text],to_jsonb(why));
   end if;
  end loop;
 end loop;
 return result;
end;$$;
revoke all on function ascent_game.augment_generated_answers(text[],text,jsonb,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ascent_store_generated_practice(p_seed uuid, p_ticket uuid, p_reply jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare avoid text[]; reply jsonb:=p_reply; pitch jsonb; alt jsonb; target text; clues text[]; used_clues text[]:='{}'; used_targets text[]:='{}'; words text[]; answer_list jsonb; results jsonb:='[]'; stage int:=0; n int; best int; candidate jsonb;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 perform pg_advisory_xact_lock(hashtextextended('ascent-fresh-store',0));
 if exists(select 1 from ascent_game.circuits where route_id='practice:'||p_seed) then return '{"ok":true}'::jsonb;end if;
 select coalesce(array_agg(t),'{}') into avoid from (select distinct b->>'target' t from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) b where c.route_id like 'daily:%' or exists(select 1 from ascent_game.runs r where r.ticket=p_ticket and r.scope=c.route_id) limit 250) a;
  if jsonb_typeof(reply->'pitches') is distinct from 'array' or jsonb_array_length(reply->'pitches')<>5 then raise exception 'Invalid generated climb';end if;
 for pitch in select value from jsonb_array_elements(reply->'pitches') loop
  stage:=stage+1;target:=pitch->>'target';
  if target is null or target !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$' or length(target)>60 or target=any(avoid||used_targets) or jsonb_typeof(pitch->'clues') is distinct from 'array' or jsonb_array_length(pitch->'clues')<>6 or jsonb_typeof(pitch->'reasons') is distinct from 'array' or jsonb_array_length(pitch->'reasons')<>6 then raise exception 'Invalid generated pitch %',stage;end if;
  clues:=array(select jsonb_array_elements_text(pitch->'clues'));
  if (select count(distinct c) from unnest(clues)c)<>6 or clues&&used_clues or ascent_game.is_displayed_clue(clues,target) or exists(select 1 from unnest(clues)c where c is null or length(c)>60 or c !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$') or exists(select 1 from jsonb_array_elements(pitch->'reasons') r where jsonb_typeof(r)<>'string' or length(r#>>'{}') not between 4 and 160) then raise exception 'Invalid generated clues %',stage;end if;
  candidate:=jsonb_build_object('target',target,'clues',clues);
  if exists(select 1 from ascent_game.published_pitches where signature=ascent_game.pitch_signature(candidate)) or exists(select 1 from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b where c.route_id like 'practice:%' and ascent_game.pitch_signature(b)=ascent_game.pitch_signature(candidate)) then raise exception 'Repeated generated pitch';end if;
  answer_list:=jsonb_build_array(jsonb_build_object('word',target,'reasons',pitch->'reasons')); words:=array[target];best:=0;
  if jsonb_typeof(pitch->'alternatives')='array' then
   for alt in select value from jsonb_array_elements(pitch->'alternatives') limit 5 loop
    if alt->>'word' is null or alt->>'word' !~ '^[a-z0-9]+( [a-z0-9]+){0,5}$' or length(alt->>'word')>60 or alt->>'word'=any(words) or ascent_game.is_displayed_clue(clues,alt->>'word') or jsonb_typeof(alt->'reasons') is distinct from 'array' or jsonb_array_length(alt->'reasons')<>6 then continue;end if;
    if exists(select 1 from jsonb_array_elements(alt->'reasons') r where jsonb_typeof(r) not in ('string','null') or (jsonb_typeof(r)='string' and length(r#>>'{}') not between 4 and 160)) then continue;end if;
    select count(*) into n from jsonb_array_elements(alt->'reasons') r where jsonb_typeof(r)='string';
    if n not between 1 and 5 then continue;end if;
    best:=greatest(best,n);words:=array_append(words,alt->>'word');answer_list:=answer_list||jsonb_build_array(alt);
   end loop;
  end if;
  -- Save independently generated common guesses for each clue, without a fixed word pool.
  answer_list:=ascent_game.augment_generated_answers(clues,target,answer_list,pitch->'common');
  -- Optional model decoys must never invalidate an otherwise playable fresh board.
  -- The generated target and its six explanations remain mandatory.
  select jsonb_agg(a order by (a->>'word'=target) desc,(select count(*) from jsonb_array_elements(a->'reasons') r where jsonb_typeof(r)='string') desc) into answer_list from jsonb_array_elements(answer_list) a;
  candidate:=candidate||jsonb_build_object('contexts',stage,'answers',answer_list);
  if (select count(*) from jsonb_object_keys(ascent_game.generated_links(candidate,target)))<>6 then raise exception 'Generated target cannot be scored on every clue %',stage;end if;
  results:=results||jsonb_build_array(candidate);
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;

 insert into ascent_game.circuits(route_id,boards,lex_version) values('practice:'||p_seed,results,7);
 return '{"ok":true}'::jsonb;
end;$function$;

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
 if normalized=any(clues) or (select count(*) from jsonb_object_keys(known))=cardinality(clues) then return ascent_game.filter_rejected_associations(normalized,known);end if;
 corrected:=normalized;
 known:=ascent_game.local_association_variants(clues,normalized,known);
 known:=ascent_game.live_dictionary_links(clues,normalized,ascent_game.knowledge_matches(clues,normalized,known));
 known:=ascent_game.direct_synonym_links(clues,normalized,known);
 if known='{}'::jsonb then
  corrected:=ascent_game.correct_spelling(normalized);
  if ascent_game.is_displayed_clue(clues,corrected) then corrected:=normalized;end if;
  if corrected<>normalized then known:=ascent_game.local_association_variants(clues,corrected,ascent_game.match_guess(7,clues,corrected));end if;
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
