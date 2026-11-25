create or replace function public.ascent_generate_local_practice(p_seed uuid,p_ticket uuid)
returns jsonb language plpgsql security definer set search_path to '' set statement_timeout to '15s' as $$
declare route_key text; pitches jsonb; pitch jsonb; clues text[]; target text; used_clues text[]:='{}'; used_targets text[]:='{}'; stage integer:=0;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 route_key:='practice:'||p_seed;
 -- The same seed must be idempotent even when two requests arrive together.
 perform pg_advisory_xact_lock(hashtextextended('ascent-fresh-store',0));
 if exists(select 1 from ascent_game.circuits c where c.route_id=route_key) then return jsonb_build_object('ok',true,'existing',true);end if;
 pitches:=ascent_game.generate_misdirection_climb(route_key,p_ticket);
 if jsonb_typeof(pitches) is distinct from 'array' or jsonb_array_length(pitches)<>5 then raise exception 'Invalid fallback climb';end if;
 for pitch in select value from jsonb_array_elements(pitches) loop
  stage:=stage+1; target:=pitch->>'target';
  clues:=array(select jsonb_array_elements_text(pitch->'clues'));
  if target is null or cardinality(clues)<>6 or (select count(distinct c) from unnest(clues)c)<>6 or clues&&used_clues or target=any(used_targets) or ascent_game.is_displayed_clue(clues,target)
   or coalesce((pitch->>'contexts')::integer,0)<>stage
   or exists(select 1 from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)b where ascent_game.pitch_signature(b)=ascent_game.pitch_signature(pitch))
   or (select count(*) from jsonb_object_keys(ascent_game.preview_registered_guess(clues,target)))<>6
  then raise exception 'Fallback pitch failed validation %',stage;end if;
  used_clues:=used_clues||clues;used_targets:=array_append(used_targets,target);
 end loop;
 select jsonb_agg(b||jsonb_build_object('generation','local-fresh-v1') order by ord) into pitches from jsonb_array_elements(pitches) with ordinality t(b,ord);
 insert into ascent_game.circuits(route_id,boards,lex_version) values(route_key,pitches,7);
 return jsonb_build_object('ok',true,'generation','local');
end;$$;
revoke all on function public.ascent_generate_local_practice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ascent_generate_local_practice(uuid,uuid) to service_role;
