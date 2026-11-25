create or replace function ascent_game.generate_quick_practice_climb(seed text,player uuid) returns jsonb language plpgsql stable set search_path='' as $fn$
declare result jsonb; attempt int;
begin
 for attempt in 0..3 loop
  result:=ascent_game.generate_full_tier_candidate(seed||case when attempt=0 then '' else ':'||attempt end,case when seed like 'daily:%' then null::uuid else player end);
  if jsonb_array_length(result)=5 then return result;end if;
 end loop;
 raise exception 'No complete-tier climb found; try a new seed';
end;$fn$;

create or replace function ascent_game.generate_misdirection_climb(seed text,player uuid) returns jsonb language sql stable set search_path='' as $fn$ select ascent_game.generate_quick_practice_climb(seed,player) $fn$;

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
  if reply->>'review' is distinct from 'ascent-standard-review-v1' then raise exception 'Independent connection review required';end if;
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
  candidate:=candidate||jsonb_build_object('contexts',stage,'answers',answer_list,'review','ascent-standard-review-v1');
  if (select count(*) from jsonb_object_keys(ascent_game.generated_links(candidate,target)))<>6 then raise exception 'Generated target cannot be scored on every clue %',stage;end if;
  if ascent_game.pitch_catalog_tiers(candidate,7)<>array[1,2,3,4,5,6] then raise exception 'Generated pitch missing a verified scoring tier %',stage;end if;
  results:=results||jsonb_build_array(candidate);
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;

 insert into ascent_game.circuits(route_id,boards,lex_version) values('practice:'||p_seed,results,7);
 insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason)
 select guess,clue,'ascent-reviewed-v1',true,reason from ascent_game.reviewed_route_pairs(results)
 on conflict on constraint llm_pair_cache_pkey do update set accepted=true,reason=excluded.reason,created_at=now();
 return '{"ok":true}'::jsonb;
end;$function$;

CREATE OR REPLACE FUNCTION public.ascent_generate_local_practice(p_seed uuid, p_ticket uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
declare route_key text; pitches jsonb; pitch jsonb; clues text[]; target text; used_clues text[]:='{}'; used_targets text[]:='{}'; stage integer:=0;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 route_key:='practice:'||p_seed;
 -- The same seed must be idempotent even when two requests arrive together.
 perform pg_advisory_xact_lock(hashtextextended('ascent-fresh-store',0));
 if exists(select 1 from ascent_game.circuits c where c.route_id=route_key) then return jsonb_build_object('ok',true,'existing',true);end if;
 pitches:=ascent_game.generate_quick_practice_climb(route_key,p_ticket);
 if jsonb_typeof(pitches) is distinct from 'array' or jsonb_array_length(pitches)<>5 then raise exception 'Invalid fallback climb';end if;
 for pitch in select value from jsonb_array_elements(pitches) loop
  stage:=stage+1; target:=pitch->>'target';
  clues:=array(select jsonb_array_elements_text(pitch->'clues'));
  if target is null or cardinality(clues)<>6 or (select count(distinct c) from unnest(clues)c)<>6 or clues&&used_clues or target=any(used_targets) or ascent_game.is_displayed_clue(clues,target)
   or ascent_game.pitch_catalog_tiers(pitch,7)<>array[1,2,3,4,5,6]
   or coalesce((pitch->>'contexts')::integer,0)<>stage
   or exists(select 1 from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b where ascent_game.pitch_signature(b)=ascent_game.pitch_signature(pitch))
   or (select count(*) from jsonb_object_keys(ascent_game.preview_registered_guess(clues,target)))<>6
  then raise exception 'Fallback pitch failed validation %',stage;end if;
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;
 select jsonb_agg(b||jsonb_build_object('generation','local-fresh-v1') order by ord) into pitches from jsonb_array_elements(pitches) with ordinality t(b,ord);
 insert into ascent_game.circuits(route_id,boards,lex_version) values(route_key,pitches,7);
 return jsonb_build_object('ok',true,'generation','local');
end;$function$;
