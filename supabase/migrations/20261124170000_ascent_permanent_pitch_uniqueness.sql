create table ascent_game.published_pitches (signature text primary key);
alter table ascent_game.published_pitches enable row level security;

create function ascent_game.pitch_signature(pitch jsonb) returns text
language sql immutable set search_path='' as $$
 select string_agg(clue,',' order by clue) from jsonb_array_elements_text(pitch->'clues') clue
$$;

insert into ascent_game.published_pitches
select distinct ascent_game.pitch_signature(pitch)
from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) pitch
where c.route_id like 'daily:%';

create function ascent_game.record_published_pitches() returns trigger
language plpgsql set search_path='' as $$
begin
 insert into ascent_game.published_pitches
 select ascent_game.pitch_signature(pitch) from jsonb_array_elements(new.boards) pitch;
 return new;
end;
$$;

create trigger record_daily_pitches after insert on ascent_game.circuits
for each row when (new.route_id like 'daily:%')
execute function ascent_game.record_published_pitches();

create or replace function ascent_game.generate_v1(seed text) returns jsonb language plpgsql stable set search_path='' as $$
declare
 candidate record; attempt int; holds text[]; pitches jsonb:='[]'; bank int; perfect int; strong int; candidate_signature text; signatures text[]:='{}';
begin
 for candidate in select word,clues from ascent_game.generation_targets order by md5(seed||'/'||word),word loop
  for attempt in 0..63 loop
   holds:=array(select c from unnest(candidate.clues) c order by md5(seed||'/'||candidate.word||'/'||attempt||'/'||c),c limit 6);
   candidate_signature:=array_to_string(array(select c from unnest(holds) c order by c),',');
   if candidate_signature=any(signatures) or (seed like 'daily:%' and exists (
    select 1 from ascent_game.published_pitches p where p.signature=candidate_signature
   )) then continue;end if;
   select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 4 and 5)
   into bank,perfect,strong from (
    select w,count(*) hits from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) w
    where l.edition=2 and l.clue=any(holds) and w<>all(holds) group by w
   ) matches;
   if bank>=100 and perfect between 1 and 2 and strong>0 then
    pitches:=pitches||jsonb_build_array(jsonb_build_object('target',candidate.word,'clues',holds));
    signatures:=array_append(signatures,candidate_signature);
    exit;
   end if;
  end loop;
  if jsonb_array_length(pitches)=5 then return pitches;end if;
 end loop;
 raise exception 'Could not generate five qualifying pitches';
end; $$;