-- Applied to production after everyday-association-coverage.sql.
-- Requires private Edge Function ascent-reasoning/index.ts and user-set
-- CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets. Never commit values.
-- Use Workers Free (10,000 neurons/day); 80 requests/day, 12/ticket/day.
-- New model verdicts are cached for 30 days (accept) or 1 day (reject).
-- Verify connection and regression suite before setting enabled=true.

-- 20261125020115 ascent_cloudflare_private_reasoning_transport
create table ascent_game.llm_config(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into ascent_game.llm_config values(true,false);
create table ascent_game.llm_daily_usage(day date primary key,calls int not null check(calls between 0 and 80));
create table ascent_game.llm_player_usage(day date not null,ticket uuid not null,calls int not null check(calls between 0 and 12),primary key(day,ticket));
create table ascent_game.llm_pair_cache(guess text not null,clue text not null,version text not null,accepted boolean not null,reason text not null,created_at timestamptz not null default now(),primary key(guess,clue,version));
alter table ascent_game.llm_config enable row level security;
alter table ascent_game.llm_daily_usage enable row level security;
alter table ascent_game.llm_player_usage enable row level security;
alter table ascent_game.llm_pair_cache enable row level security;
revoke all on ascent_game.llm_config,ascent_game.llm_daily_usage,ascent_game.llm_player_usage,ascent_game.llm_pair_cache from public,anon,authenticated;
create function public.ascent_llm_reserve(p_token text,p_ticket uuid) returns boolean language plpgsql security definer set search_path='' as $fn$
declare today date:=(now() at time zone 'UTC')::date;n int;
begin
 if p_ticket is null or not coalesce((select secret=p_token from ascent_game.semantic_config where singleton),false) then return false;end if;
 insert into ascent_game.llm_player_usage(day,ticket,calls) values(today,p_ticket,1) on conflict(day,ticket) do update set calls=ascent_game.llm_player_usage.calls+1 where ascent_game.llm_player_usage.calls<12 returning calls into n;
 if n is null then return false;end if;
 n:=null;
 insert into ascent_game.llm_daily_usage(day,calls) values(today,1) on conflict(day) do update set calls=ascent_game.llm_daily_usage.calls+1 where ascent_game.llm_daily_usage.calls<80 returning calls into n;
 return n is not null;
end;$fn$;
revoke all on function public.ascent_llm_reserve(text,uuid) from public,anon,authenticated;
grant execute on function public.ascent_llm_reserve(text,uuid) to service_role;
create function ascent_game.llm_request(payload jsonb) returns jsonb language plpgsql volatile set search_path='' as $fn$
declare resp extensions.http_response;token text;
begin
 select secret into token from ascent_game.semantic_config where singleton;
 perform set_config('http.curlopt_timeout_msec','7000',true);
 perform set_config('http.curlopt_connecttimeout_msec','1200',true);
 select * into resp from extensions.http(('POST','https://mqozqigwkobnhijvvboy.supabase.co/functions/v1/ascent-reasoning',array[extensions.http_header('x-ascent-token',token)],'application/json',payload::text)::extensions.http_request);
 if resp.status=200 then return resp.content::jsonb;end if;
 return jsonb_build_object('error','reasoning unavailable','status',resp.status);
 exception when others then return jsonb_build_object('error','reasoning request failed','state',sqlstate);
end;$fn$;
revoke all on function ascent_game.llm_request(jsonb) from public,anon,authenticated;

-- 20261125020242 ascent_cloudflare_cached_reasoning_pipeline
create function ascent_game.llm_cached_matches(clues text[],guess text,known jsonb) returns jsonb language sql stable set search_path='' as $fn$
select known||coalesce((select jsonb_object_agg(c.clue,c.reason||' — AI relationship') from ascent_game.llm_pair_cache c where c.version='llama70b-r1' and c.guess=$2 and c.clue=any($1) and c.accepted and not $3 ? c.clue and c.created_at>now()-interval '30 days' and (select enabled from ascent_game.llm_config where singleton)), '{}'::jsonb)
$fn$;
revoke all on function ascent_game.llm_cached_matches(text[],text,jsonb) from public,anon,authenticated;
create function ascent_game.llm_complete(clues text[],guess text,ticket uuid,known jsonb) returns jsonb language plpgsql volatile set search_path='' as $fn$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if not coalesce(enabled_flag,false) then return known||ascent_game.semantic_fallback(array(select x from unnest(clues) x where not known ? x),guess,ticket);end if;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '(^| )(not|unrelated|none|except|without|or|and|ignore|instructions|prompt|system|override|accept|award|points|score)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 missing:=array(select x from unnest(clues) x where not result ? x and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=x and k.version='llama70b-r1' and not k.accepted and k.created_at>now()-interval '1 day'));
 if cardinality(missing)=0 then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'llama70b-r1' or jsonb_typeof(reply->'matches') is distinct from 'object' then
   -- Avoid a second network round trip on timeout; keep established matches.
   if v is not null then return result;end if;
   return result||ascent_game.semantic_fallback(array(select x from unnest(clues) x where not result ? x),guess,ticket);
 end if;
 if exists(select 1 from jsonb_each(reply->'matches') e where e.key<>all(missing) or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}') not between 4 and 150) then return result;end if;
 foreach c in array missing loop
  explanation:=reply->'matches'->>c;
  insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason) values(guess,c,'llama70b-r1',explanation is not null,coalesce(explanation,'')) on conflict(guess,clue,version) do update set accepted=excluded.accepted,reason=excluded.reason,created_at=now();
  if explanation is not null then result:=result||jsonb_build_object(c,explanation||' — AI relationship');end if;
 end loop;
 return result;
exception when others then return result;
end;$fn$;
revoke all on function ascent_game.llm_complete(text[],text,uuid,jsonb) from public,anon,authenticated;
do $patch$ declare d text;n text;begin
select pg_get_functiondef('ascent_game.semantic_complete_guess(text[],text,uuid,jsonb)'::regprocedure) into d;
n:=replace(d,'if cardinality(missing)>0 then more:=ascent_game.semantic_fallback(missing,corrected,ticket);end if;
 result:=known||coalesce(more,''{}''::jsonb);','if cardinality(missing)>0 then result:=ascent_game.llm_complete(clues,corrected,ticket,known);else result:=known;end if;');
if n=d then raise exception 'Reasoning integration patch mismatch';end if;execute n;
end;$patch$;
-- Cached positive verdicts also appear in previews and post-game answer lists.
do $patch$ declare d text;n text;begin
select pg_get_functiondef('ascent_game.preview_registered_guess(text[],text)'::regprocedure) into d;
n:=replace(d,'select known||coalesce(','select ascent_game.llm_cached_matches(clues,guess,known||coalesce(');
n:=replace(n,'''{}''::jsonb) from base','''{}''::jsonb)) from base');
if n=d then raise exception 'Cached preview patch mismatch';end if;execute n;
select pg_get_functiondef('public.ascent_top_answers(uuid,date,date,uuid,integer)'::regprocedure) into d;
n:=replace(d,' ) e where e.key<>all(b.clues)',' union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version=''llama70b-r1'' and k.accepted and k.created_at>now()-interval ''30 days'' and (select enabled from ascent_game.llm_config where singleton)
 ) e where e.key<>all(b.clues)');
if n=d then raise exception 'Reasoning review patch mismatch';end if;execute n;
end;$patch$;
create index llm_pair_cache_clue_idx on ascent_game.llm_pair_cache(clue,version,accepted,created_at);


-- 20261125020259 ascent_fix_reasoning_cache_upsert
do $patch$ declare d text;n text;begin
 select pg_get_functiondef('ascent_game.llm_complete(text[],text,uuid,jsonb)'::regprocedure) into d;
 n:=replace(d,'on conflict(guess,clue,version) do update','on conflict on constraint llm_pair_cache_pkey do update');
 if n=d then raise exception 'Cache conflict patch mismatch';end if;execute n;
end;$patch$;

-- 20261125020318 ascent_reasoning_phrase_and_timeout_safeguards
do $patch$ declare d text;n text;begin
select pg_get_functiondef('ascent_game.llm_complete(text[],text,uuid,jsonb)'::regprocedure) into d;
n:=replace(d,'guess ~ ''(^| )(not|unrelated|none|except|without|or|and|ignore|instructions|prompt|system|override|accept|award|points|score)( |$)''','guess ~ ''^(not|unrelated|none|except|without)($| )'' or guess ~ ''(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)''');
n:=replace(n,'if v is not null then return result;end if;','if v is not null or reply ? ''state'' or reply->>''error''=''reasoning_timeout_or_unavailable'' then return result;end if;');
if n=d then raise exception 'Reasoning safeguard patch mismatch';end if;execute n;
end;$patch$;

-- Enable only after testing credentials and inference:
-- update ascent_game.llm_config set enabled=true where singleton;
-- Emergency fallback: set enabled=false.
