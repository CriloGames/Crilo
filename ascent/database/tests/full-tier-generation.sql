-- Read-only generator smoke test; no real runs or circuits are created.
do $test$
declare s text; b jsonb;
begin
 foreach s in array array['practice:coverage-recheck-20261125-1','practice:coverage-recheck-20261125-2','practice:coverage-recheck-20261125-3'] loop
  b:=ascent_game.generate_quick_practice_climb(s,'ef9070be-77ea-4e70-900b-aecc364c9be9');
  if jsonb_array_length(b) is distinct from 5 or exists(select 1 from jsonb_array_elements(b)p where ascent_game.pitch_catalog_tiers(p,7)<>array[1,2,3,4,5,6]) then raise exception 'Incomplete tier coverage for %',s;end if;
  if (select count(distinct c) from jsonb_array_elements(b)p cross join lateral jsonb_array_elements_text(p->'clues')c)<>30 then raise exception 'Repeated clues for %',s;end if;
 end loop;
end;$test$;
