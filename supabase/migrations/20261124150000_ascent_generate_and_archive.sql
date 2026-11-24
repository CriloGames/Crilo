-- Keep pre-existing attempts official and isolate all replay/practice results.
alter table ascent_game.runs add column scope text not null default 'daily';
alter table ascent_game.runs drop constraint runs_pkey, add primary key(day,ticket,scope);

create table ascent_game.circuits(route_id text primary key,boards jsonb not null check(jsonb_array_length(boards)=5),lex_version integer not null);
alter table ascent_game.circuits enable row level security;
create table ascent_game.circuit_lexicon(edition integer not null,clue text not null,links jsonb not null,primary key(edition,clue));
alter table ascent_game.circuit_lexicon enable row level security;
insert into ascent_game.circuit_lexicon select 1,clue,links from ascent_game.lexicon;

-- The relationship works in either direction. In the generator, a sufficiently
-- connected answer word can itself become a clue. Freeze each vocabulary edition.
with edges as (
 select clue, key as word,value as phrase from ascent_game.lexicon l cross join lateral jsonb_each_text(l.links)
), directions as (
 select clue,word,phrase,0 priority from edges union all select word,clue,phrase,1 from edges
), unique_edges as (
 select distinct on(clue,word) clue,word,phrase from directions where clue<>word and clue ~ '^[a-z]{2,}$' order by clue,word,priority
)
insert into ascent_game.circuit_lexicon select 2,clue,jsonb_object_agg(word,phrase) from unique_edges group by clue having count(*)>=22;

create materialized view ascent_game.generation_targets as
select word,array_agg(clue order by clue) clues from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) word
where l.edition=2 and word ~ '^[a-z]{3,}$' group by word having count(*)>=7;

-- Preserve the exact official routes that could already have been played.
insert into ascent_game.circuits
select 'daily:'||to_char(d,'YYYY-MM-DD'),
 (select jsonb_agg(jsonb_build_object('clues',b.clues,'target',b.target) order by u.i)
  from unnest(ascent_game.route(d::date)) with ordinality u(id,i) join ascent_game.boards b using(id)),1
from generate_series(date '2026-11-24'::timestamp,((now() at time zone 'America/Los_Angeles')::date)::timestamp,interval '1 day') d;

create function ascent_game.generate_v1(seed text) returns jsonb language plpgsql stable set search_path='' as $$
declare
 candidate record; attempt int; holds text[]; pitches jsonb:='[]'; bank int; perfect int; strong int; signature text; signatures text[]:='{}';
begin
 for candidate in select word,clues from ascent_game.generation_targets order by md5(seed||'/'||word),word loop
  for attempt in 0..4 loop
   holds:=array(select c from unnest(candidate.clues) c order by md5(seed||'/'||candidate.word||'/'||attempt||'/'||c),c limit 6);
   signature:=array_to_string(array(select c from unnest(holds) c order by c),',');
   if signature=any(signatures) then continue;end if;
   select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 4 and 5)
   into bank,perfect,strong from (
    select w,count(*) hits from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) w
    where l.edition=2 and l.clue=any(holds) and w<>all(holds) group by w
   ) matches;
   if bank>=100 and perfect between 1 and 2 and strong>0 then
    pitches:=pitches||jsonb_build_array(jsonb_build_object('target',candidate.word,'clues',holds));
    signatures:=array_append(signatures,signature);
    exit;
   end if;
  end loop;
  if jsonb_array_length(pitches)=5 then return pitches;end if;
 end loop;
 raise exception 'Could not generate five qualifying pitches';
end; $$;

create function public.ascent_circuit(p_ticket uuid,p_action text default 'read',p_day date default null,p_round integer default null,p_guess text default null,p_archive date default null,p_seed uuid default null)
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
   until_at:=clock_timestamp()+interval '15 seconds';
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

revoke all on function public.ascent_circuit(uuid,text,date,int,text,date,uuid) from public;
grant execute on function public.ascent_circuit(uuid,text,date,int,text,date,uuid) to anon,authenticated;

-- Retain the daily entry point used by existing clients.
create or replace function public.ascent_pitch(p_ticket uuid,p_action text default 'read',p_day date default null,p_round integer default null,p_guess text default null)
returns jsonb language sql security definer set search_path='' as $$
select public.ascent_circuit(p_ticket,p_action,p_day,p_round,p_guess,null,null)
$$;

create function public.ascent_archive(p_before date default null) returns jsonb language sql stable set search_path='' as $$
with dates as (
 select (now() at time zone 'America/Los_Angeles')::date as today, date '2026-11-24' as launch
), bounds as (
 select *,least(coalesce(p_before,today),today)-1 as latest from dates
)
select jsonb_build_object('today',today,'launch',launch,'days',
 array(select latest-i from generate_series(0,27) i where latest-i>=launch order by i),
 'older',case when latest-27>launch then latest-27 end) from bounds;
$$;
revoke all on function public.ascent_archive(date) from public;
grant execute on function public.ascent_archive(date) to anon,authenticated;
notify pgrst,'reload schema';