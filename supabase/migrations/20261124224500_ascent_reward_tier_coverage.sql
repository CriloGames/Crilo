CREATE OR REPLACE FUNCTION ascent_game.generate_theme_climb(seed text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare theme record; holds text[]; pitches jsonb:='[]'; candidate_signature text; signatures text[]:='{}'; candidate int; bank_size int; perfect int; partials int; strong int; tiers int; best_tiers int; best_pitch jsonb; best_signature text; qualified int;
begin
 for theme in select * from ascent_game.theme_catalog_v4 order by md5(seed||target),target loop
  best_tiers:=-1; best_pitch:=null; qualified:=0;
  for candidate in 1..100 loop
   holds:=array(select c from unnest(theme.clues) c order by md5(seed||theme.target||candidate||c),c limit 6);
   candidate_signature:=ascent_game.pitch_signature(jsonb_build_object('clues',holds));
   if candidate_signature=any(signatures) or (seed like 'daily:%' and exists (
     select 1 from ascent_game.published_pitches p where p.signature=candidate_signature
   )) then continue;end if;
   if exists(select 1 from jsonb_array_elements(pitches) prev where (select count(*) from jsonb_array_elements_text(prev->'clues') clue where clue=any(holds))>1) then continue;end if;
   select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 3 and 5),count(*) filter(where hits in (4,5)),count(distinct hits)
   into bank_size,perfect,partials,strong,tiers from (
    select word,count(*) hits from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) word
    where l.edition=4 and l.clue=any(holds) and word<>all(holds) group by word
   ) matches;
   if bank_size<100 or perfect not between 1 and 2 or partials<6 or strong<2 then continue;end if;
   qualified:=qualified+1;
   if tiers>best_tiers then
    best_tiers:=tiers;
    best_pitch:=jsonb_build_object('target',theme.target,'clues',holds,'partial_paths',partials,'strong_paths',strong);
    best_signature:=candidate_signature;
   end if;
   exit when tiers=6 or qualified>=8;
  end loop;
  if best_pitch is not null then
   pitches:=pitches||jsonb_build_array(best_pitch);
   signatures:=array_append(signatures,best_signature);
  end if;
  if jsonb_array_length(pitches)=5 then
   return (select jsonb_agg(p-'partial_paths'-'strong_paths' order by (p->>'strong_paths')::int desc,(p->>'partial_paths')::int desc,i) from jsonb_array_elements(pitches) with ordinality e(p,i));
  end if;
 end loop;
 raise exception 'Could not find five unused semantic pitches';
end;$function$
;