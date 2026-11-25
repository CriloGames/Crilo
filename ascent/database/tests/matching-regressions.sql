-- Run after the Ascent migrations. No network, score changes or user rows.
do $test$
declare bad text;
begin
 with cases(clues,guess,expected) as (values
 (array['dirt','violin','clock'],'seed',array['dirt']),
 (array['seed','violin','clock'],'dirt',array['seed']),
 (array['seeds','violin','clock'],'dirt',array['seeds']),
 (array['dirt','soil','garden soil','flower bed','clock','violin'],'seeds',array['dirt','soil','garden soil','flower bed']),
 (array['dirt','seed','soil'],'seed',array[]::text[]),
 (array['wrench set','door lock','lightning'],'power',array['lightning']),
 (array['guitar','banjo','violin','clock'],'string',array['guitar','banjo','violin']),
 (array['dirt','seed','violin'],'zzzz',array[]::text[]),
 (array['soil','seed','flower pot'],'calculator',array[]::text[]),
 (array['saxophone','otter','harpsichord'],'sax',array['saxophone']),
 (array['guitar','clock'],'guitar',array[]::text[])
 ), results as (select guess,clues,expected,ascent_game.preview_registered_guess(clues,guess) links from cases)
 select string_agg(guess||' against '||array_to_string(clues,','),'; ') into bad from results where array(select jsonb_object_keys(links) order by 1)<>array(select unnest(expected) order by 1);
 if bad is not null then raise exception 'Ascent regression: %',bad;end if;
end;$test$;
