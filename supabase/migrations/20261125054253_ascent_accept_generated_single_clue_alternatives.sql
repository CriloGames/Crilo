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
  if jsonb_array_length(answer_list)<2 or best<2 or (stage>=4 and best<4) then raise exception 'Generated pitch lacks a convincing alternate answer %',stage;end if;
  results:=results||jsonb_build_array(candidate||jsonb_build_object('contexts',stage,'answers',answer_list));
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;

 insert into ascent_game.circuits(route_id,boards,lex_version) values('practice:'||p_seed,results,7);
 return '{"ok":true}'::jsonb;
end;$function$;
