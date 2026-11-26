create schema tagalong_private;
revoke all on schema tagalong_private from public, anon, authenticated;

create table tagalong_private.word_pool (
  word text primary key check (word ~ '^[a-z]{3,5}$')
);
create table tagalong_private.dailies (
  day date primary key,
  word text unique not null references tagalong_private.word_pool(word)
);
create table tagalong_private.attempts (
  day date not null references tagalong_private.dailies(day),
  player uuid not null,
  started_at timestamptz not null default clock_timestamp(),
  primary key (day, player)
);
revoke all on all tables in schema tagalong_private from public, anon, authenticated;

-- Candidates are dictionary entries with 25+ longer dictionary matches,
-- including 10+ in the Google 10,000 English frequency list.
insert into tagalong_private.word_pool (word)
select unnest(string_to_array('able ace act add age ages air all amp and ant anti any app apt arc arch are arm art ash ate aye ball ban bar bat bin bit book bra but call cam can cap car cat cent char con cons cop cord count cove cover cut date den die disc doc each ear ease eat edit elect end enter era eve even ever fact far fee fig fin for form fun gen gene get grad graph ham hand harm has head heat her here high hip hold hon hop hot how ice ill ink inn inter ion its ken king lab lace land late lay led leg less let lid lie light line list lit live load lock log lot low mag main man mar mark mat mate med men met mic min mine mini miss mod mode net new nor not now off old once one opera opt order our out over own pan par part pass pat pen pens per pet phi pic pin ping plan play port pose post pot press pro pub put rage rain ram ran range rap rat rate ratio read rec red ref refer rent rep rest rev rid rim ring rip rob rod roll round row sea sec see sent serve set she shed ship sic side sign sin sing sit ski sol some son spa spec stat sub sum sure tab table tag tan tar tea tee temp ten tend tent term test the thin tie ties time tin ton too top tract try under use van vat view war ward ware web win wing wit work', ' '));

create function public.tagalong_round(player_key uuid, resume_only boolean)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  game_day date := (clock_timestamp() at time zone 'UTC' + interval '2 hours')::date;
  seed text;
  started timestamptz;
begin
  if player_key is null or resume_only is null then
    raise exception 'Round details required';
  end if;
  -- Preserve an in-progress round when the site crosses its daily reset.
  select a.day, a.started_at into game_day, started
  from tagalong_private.attempts a
  where a.player = player_key and
    (a.day = game_day or (a.day = game_day - 1 and a.started_at + interval '62 seconds' > clock_timestamp()))
  order by a.day desc limit 1;
  if started is null then
    if resume_only then return null; end if;
    game_day := (clock_timestamp() at time zone 'UTC' + interval '2 hours')::date;
    perform pg_advisory_xact_lock(83123, game_day - date '2020-01-01');
    if not exists (select from tagalong_private.dailies d where d.day = game_day) then
      select p.word into seed from tagalong_private.word_pool p
        where not exists (select from tagalong_private.dailies d where d.word = p.word)
        order by random() limit 1;
      if seed is null then raise exception 'No unused daily word available'; end if;
      insert into tagalong_private.dailies (day, word) values (game_day, seed);
    end if;
    insert into tagalong_private.attempts (day, player) values (game_day, player_key)
      on conflict do nothing;
    select a.started_at into strict started from tagalong_private.attempts a
      where a.day = game_day and a.player = player_key;
  end if;
  select d.word into strict seed from tagalong_private.dailies d where d.day = game_day;
  return jsonb_build_object('day', game_day, 'word', seed,
    'opens_at', started + interval '2 seconds',
    'ends_at', started + interval '62 seconds', 'server_now', clock_timestamp());
end;
$$;
revoke all on function public.tagalong_round(uuid, boolean) from public;
grant execute on function public.tagalong_round(uuid, boolean) to anon, authenticated;
