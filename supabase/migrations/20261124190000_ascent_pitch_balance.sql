create function ascent_game.generate_baseline(seed text) returns jsonb language plpgsql stable set search_path='' as $$
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

create or replace function ascent_game.generate_v1(seed text) returns jsonb language plpgsql stable set search_path='' as $$
declare
 candidate record; attempt int; holds text[]; pitches jsonb:='[]'; bank int; perfect int; strong int; familiar int; candidate_signature text; signatures text[]:='{}';
begin
 for candidate in select word,clues from ascent_game.generation_targets order by md5(seed||'/'||word),word loop
  for attempt in 0..63 loop
   holds:=array(select c from unnest(candidate.clues) c order by md5(seed||'/'||candidate.word||'/'||attempt||'/'||c),c limit 6);
   candidate_signature:=array_to_string(array(select c from unnest(holds) c order by c),',');
   if candidate_signature=any(signatures) or (seed like 'daily:%' and exists (
    select 1 from ascent_game.published_pitches p where p.signature=candidate_signature
   )) then continue;end if;
   if exists (select 1 from jsonb_array_elements(pitches) p where (select count(*) from jsonb_array_elements_text(p->'clues') c where c=any(holds))>3) then continue;end if;
   select count(*) into familiar from ascent_game.circuit_lexicon l where l.edition=1 and l.clue=any(holds) and l.links ? candidate.word;
   if familiar<3 then continue;end if;
   select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 4 and 5)
   into bank,perfect,strong from (
    select w,count(*) hits from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) w
    where l.edition=2 and l.clue=any(holds) and w<>all(holds) group by w
   ) matches;
   if bank>=100 and perfect between 1 and 2 and strong>=2 then
    pitches:=pitches||jsonb_build_array(jsonb_build_object('target',candidate.word,'clues',holds));
    signatures:=array_append(signatures,candidate_signature);
    exit;
   end if;
  end loop;
  if jsonb_array_length(pitches)=5 then
   return (select jsonb_agg(p order by (select count(*) from ascent_game.circuit_lexicon l
     where l.edition=1 and l.clue in (select jsonb_array_elements_text(p->'clues')) and l.links ? (p->>'target')) desc,i)
     from jsonb_array_elements(pitches) with ordinality e(p,i));
  end if;
 end loop;
 return ascent_game.generate_baseline(seed);
end; $$;

create or replace function public.ascent_circuit(p_ticket uuid,p_action text default 'read',p_day date default null,p_round integer default null,p_guess text default null,p_archive date default null,p_seed uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 received timestamptz:=statement_timestamp();
 d date:=(received at time zone 'America/Los_Angeles')::date;
 local_today date:=d;
 run_scope text:='daily';
 route_key text;
 pitches jsonb;
 dictionary_version int:=2;
 h jsonb; total_points integer; until_at timestamptz; ix integer;
 b ascent_game.boards%rowtype; answer text; canonical text; candidates text[]; links jsonb:='{}'; solution jsonb;
 hits integer; pairs integer; points integer; expired boolean; rejected boolean:=false; crowd jsonb;
begin
 if p_archive is not null and (p_seed is not null or p_archive<date '2026-11-24' or p_archive>=local_today) then
  raise exception 'Only past published climbs can be replayed'; end if;
 if p_archive is not null then d:=p_archive;run_scope:='replay';end if;
 if p_seed is not null then d:=date '2026-11-24';run_scope:='practice:'||p_seed;end if;
 route_key:=case when p_seed is null then 'daily:'||to_char(d,'YYYY-MM-DD') else run_scope end;
 if p_ticket is null or p_action is null or p_action not in ('read','start','guess') then raise exception 'Invalid request'; end if;
 if p_action='start' and p_day=d and p_round=1 then
  insert into ascent_game.runs(day,ticket,scope) values(d,p_ticket,run_scope) on conflict do nothing;
 end if;
 select history,total,deadline into h,total_points,until_at from ascent_game.runs where day=d and ticket=p_ticket and scope=run_scope for update;
 h:=coalesce(h,'[]'); total_points:=coalesce(total_points,0); ix:=jsonb_array_length(h)+1;
 if ix<=5 then
  if until_at is not null or (p_action='start' and p_day=d and p_round=ix) then
   select c.boards,c.lex_version into pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key;
   if pitches is null then
    pitches:=ascent_game.generate_v1(route_key);dictionary_version:=2;
    insert into ascent_game.circuits(route_id,boards,lex_version) values(route_key,pitches,dictionary_version) on conflict do nothing;
    select c.boards,c.lex_version into strict pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key;
   end if;
   b.target:=pitches->(ix-1)->>'target';
   b.clues:=array(select jsonb_array_elements_text(pitches->(ix-1)->'clues'));
  end if;
  if p_action='start' and p_day=d and p_round=ix and until_at is null then
   until_at:=clock_timestamp()+interval '20 seconds';
   update ascent_game.runs set deadline=until_at where day=d and ticket=p_ticket and scope=run_scope;
  end if;
  expired:=until_at is not null and received>=until_at;
  if expired or (until_at is not null and p_action='guess' and p_day=d and p_round=ix) then
   answer:=lower(btrim(coalesce(p_guess,'')));
   if not expired and answer ~ '^[a-z]{1,36}$' and answer<>all(b.clues) then
    -- Prefer the exact word. Accept common plural endings when their singular connects.
    candidates:=array[answer];
    if length(answer)>3 and right(answer,3)='ies' then candidates:=array_append(candidates,left(answer,-3)||'y'); end if;
    if answer ~ '(ch|sh|s|x|z)es$' then candidates:=array_append(candidates,left(answer,-2)); end if;
    if length(answer)>2 and right(answer,1)='s' and right(answer,2)<>'ss' then candidates:=array_append(candidates,left(answer,-1)); end if;
    foreach canonical in array candidates loop
      if canonical=any(b.clues) then continue; end if;
      select coalesce(jsonb_object_agg(l.clue,l.links->canonical),'{}') into links
      from ascent_game.circuit_lexicon l where l.edition=dictionary_version and l.clue=any(b.clues) and l.links ? canonical;
      exit when links<>'{}'::jsonb;
    end loop;
   end if;
   if expired or links<>'{}'::jsonb then
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;
    select jsonb_object_agg(l.clue,l.links->b.target) into solution from ascent_game.circuit_lexicon l where l.edition=dictionary_version and l.clue=any(b.clues);
    h:=h||jsonb_build_array(jsonb_build_object('guess',case when expired then '' else answer end,'timedOut',expired,'clues',b.clues,'links',links,'points',points,'target',b.target,'solution',solution));
    total_points:=total_points+points;
    update ascent_game.runs set history=h,total=total_points,deadline=null where day=d and ticket=p_ticket and scope=run_scope;
    until_at:=null;ix:=ix+1;
   else rejected:=true; end if;
  end if;
 end if;
 if ix=6 then
  if p_seed is not null then
   return jsonb_build_object('day',d,'history',h,'results',jsonb_build_object('score',total_points,'average',null,'players',0));
  end if;
  select jsonb_build_object('average',round(avg(total)),'players',count(*)) into crowd from ascent_game.runs
  where day=d and scope='daily' and (jsonb_array_length(history)=5 or (jsonb_array_length(history)=4 and deadline<=received));
  return jsonb_build_object('day',d,'history',h,'results',crowd||jsonb_build_object('score',total_points));
 end if;
 return jsonb_build_object('day',d,'history',h,'deadline',until_at,'serverTime',clock_timestamp(),'clues',case when until_at is not null then b.clues end,'rejected',rejected);
end;
$$;
