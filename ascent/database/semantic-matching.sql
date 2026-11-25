-- Ascent semantic matching. Applied to production.
-- Do not execute blindly on production: this file documents the deployment.
-- Bootstrap after expanded-vocabulary.sql. The private worker is in
-- ascent/database/ascent-semantic/index.ts. It must be deployed to this
-- project's ascent-semantic Edge Function before backfilling.
-- The initial bootstrap deployed worker version 2, then populated vectors,
-- then enabled quota checking with worker version 3.
-- For a fresh restoration, run Phase 1, deploy the current worker, then run
-- Phase 2. Populate vectors using the private semantic_seed_words helper
-- before Phase 3. Never expose that helper or the private authorization token.

-- Phase 1: infrastructure
-- 20261125004305 ascent_semantic_private_transport
create extension if not exists http with schema extensions;
create table ascent_game.semantic_config(singleton boolean primary key default true check(singleton), secret text not null, enabled boolean not null default false);
alter table ascent_game.semantic_config enable row level security;
revoke all on ascent_game.semantic_config from public,anon,authenticated;
insert into ascent_game.semantic_config(singleton,secret) values(true,gen_random_uuid()::text||gen_random_uuid()::text);
create function public.ascent_semantic_authorize(p_token text) returns boolean language sql stable security definer set search_path='' as $fn$ select coalesce((select secret=p_token from ascent_game.semantic_config where singleton),false) $fn$;
revoke all on function public.ascent_semantic_authorize(text) from public,anon,authenticated;
grant execute on function public.ascent_semantic_authorize(text) to service_role;
-- Private network endpoint, no user-provided URL or credentials.
create function ascent_game.semantic_request(payload jsonb) returns jsonb language plpgsql volatile set search_path='' as $fn$
declare response extensions.http_response; token text;
begin
 select secret into token from ascent_game.semantic_config where singleton;
 perform set_config('http.curlopt_timeout_msec','4500',true);
 perform set_config('http.curlopt_connecttimeout_msec','1200',true);
 select * into response from extensions.http(('POST','https://mqozqigwkobnhijvvboy.supabase.co/functions/v1/ascent-semantic',array[extensions.http_header('x-ascent-token',token)],'application/json',payload::text)::extensions.http_request);
 if response.status=200 then return response.content::jsonb;end if;
 return jsonb_build_object('error','model endpoint unavailable','status',response.status);
 exception when others then return jsonb_build_object('error','model request failed','state',sqlstate);
end;$fn$;
revoke all on function ascent_game.semantic_request(jsonb) from public,anon,authenticated;

-- 20261125004607 ascent_semantic_vector_cache
create extension if not exists vector with schema extensions;
create table ascent_game.semantic_word_vectors(word text primary key,embedding extensions.vector(384) not null,model text not null default 'gte-small-v1');
create table ascent_game.semantic_guess_cache(key text primary key,embedding extensions.vector(384) not null,created_at timestamptz not null default now());
create table ascent_game.semantic_usage(month date primary key,calls integer not null default 0 check(calls between 0 and 20000));
create table ascent_game.semantic_player_usage(day date not null,ticket uuid not null,calls integer not null default 0 check(calls between 0 and 30),primary key(day,ticket));
alter table ascent_game.semantic_word_vectors enable row level security;
alter table ascent_game.semantic_guess_cache enable row level security;
alter table ascent_game.semantic_usage enable row level security;
alter table ascent_game.semantic_player_usage enable row level security;
revoke all on ascent_game.semantic_word_vectors,ascent_game.semantic_guess_cache,ascent_game.semantic_usage,ascent_game.semantic_player_usage from public,anon,authenticated;
create function ascent_game.semantic_seed_words(terms text[]) returns integer language plpgsql volatile set search_path='' as $fn$
declare result jsonb; n int;
begin
 if cardinality(terms) not between 1 and 4 then return 0;end if;
 if exists(select 1 from unnest(terms) w where not exists(select 1 from ascent_game.association_scores_v7 s where s.word=w or s.clue=w)) then return 0;end if;
 result:=ascent_game.semantic_request(jsonb_build_object('mode','vectors','terms',terms));
 if jsonb_typeof(result->'vectors') is distinct from 'array' then return 0;end if;
 insert into ascent_game.semantic_word_vectors(word,embedding) select a->>'word',(a->'vector')::text::extensions.vector(384) from jsonb_array_elements(result->'vectors') a where a->>'word'=any(terms) and jsonb_array_length(a->'vector')=384 on conflict(word) do nothing;
 get diagnostics n=row_count;return n;
 exception when others then return 0;
end;$fn$;
revoke all on function ascent_game.semantic_seed_words(text[]) from public,anon,authenticated;

-- 20261125005213 ascent_semantic_matcher_and_quota
create function public.ascent_semantic_reserve(p_token text,p_ticket uuid default null) returns boolean language plpgsql volatile security definer set search_path='' as $fn$
declare month_start date:=date_trunc('month',now() at time zone 'UTC')::date; today date:=(now() at time zone 'UTC')::date; n int;
begin
 if not coalesce((select secret=p_token from ascent_game.semantic_config where singleton),false) then return false;end if;
 -- Reserve in a separate HTTP transaction before inference, so unsuccessful calls also count.
 if p_ticket is not null then
  insert into ascent_game.semantic_player_usage(day,ticket,calls) values(today,p_ticket,1) on conflict(day,ticket) do update set calls=ascent_game.semantic_player_usage.calls+1 where ascent_game.semantic_player_usage.calls<30 returning calls into n;
  if n is null then return false;end if;
 end if;
 n:=null;
 insert into ascent_game.semantic_usage(month,calls) values(month_start,1) on conflict(month) do update set calls=ascent_game.semantic_usage.calls+1 where ascent_game.semantic_usage.calls<20000 returning calls into n;
 return n is not null;
end;$fn$;
revoke all on function public.ascent_semantic_reserve(text,uuid) from public,anon,authenticated;
grant execute on function public.ascent_semantic_reserve(text,uuid) to service_role;

create function ascent_game.semantic_fallback(clues text[],guess text,ticket uuid) returns jsonb language plpgsql volatile set search_path='' as $fn$
declare g extensions.vector(384); response jsonb; k text; clean_guess text; result jsonb:='{}'; best_word text; best_score double precision; direct_links jsonb; enabled_flag boolean;
begin
 select enabled into enabled_flag from ascent_game.semantic_config where singleton;
 if not coalesce(enabled_flag,false) or ticket is null then return result;end if;
 clean_guess:=lower(btrim(regexp_replace(regexp_replace(coalesce(guess,''),'[’'']','','g'),'[[:space:]‐‑–—-]+',' ','g')));
 clean_guess:=btrim(regexp_replace(clean_guess,'[.!?]+$','','g'));
 if length(clean_guess)>100 or clean_guess !~ '^[a-z0-9]+( [a-z0-9]+){0,7}$' or clean_guess=any(clues) or clean_guess ~ '(^| )(not|unrelated|none|except|without|or|and)( |$)' then return result;end if;
 -- Use the known vector or a hash-keyed short-lived guess cache.
 k:=md5('gte-small-v1:'||clean_guess);
 select embedding into g from ascent_game.semantic_word_vectors where word=clean_guess;
 if g is null then select embedding into g from ascent_game.semantic_guess_cache where key=k and created_at>now()-interval '14 days';end if;
 if g is null then
  -- One inference only. The worker authorizes and reserves quota before running the model.
  response:=ascent_game.semantic_request(jsonb_build_object('mode','vectors','terms',array[clean_guess],'ticket',ticket));
  if jsonb_typeof(response->'vectors') is distinct from 'array' or response->'vectors'->0->>'word' is distinct from clean_guess or jsonb_array_length(response->'vectors'->0->'vector') is distinct from 384 then return result;end if;
  g:=(response->'vectors'->0->'vector')::text::extensions.vector(384);
  if extensions.vector_norm(g)<0.95 or extensions.vector_norm(g)>1.05 then return result;end if;
  insert into ascent_game.semantic_guess_cache(key,embedding) values(k,g) on conflict(key) do update set embedding=excluded.embedding,created_at=now();
  -- Bounded cache; keep common curated vectors separate.
  if (select count(*) from ascent_game.semantic_guess_cache)>12000 then
   delete from ascent_game.semantic_guess_cache where key in(select key from ascent_game.semantic_guess_cache order by created_at limit 1000);
  end if;
 end if;
 -- A close alternative to a SINGLE established answer, not arbitrary combinations of ideas.
 select v.word,1-(v.embedding operator(extensions.<=>) g) into best_word,best_score
 from ascent_game.semantic_word_vectors v
 where v.word<>all(clues) and exists(select 1 from ascent_game.association_scores_v7 s where s.word=v.word and s.clue=any(clues) and s.strength>=78)
 order by v.embedding operator(extensions.<=>) g,v.word limit 1;
 if best_score>=0.915 then
  select coalesce(jsonb_object_agg(s.clue,'Semantic match via “'||best_word||'” — '||s.reason||' ('||round(best_score*100)::int||'% similarity)'),'{}') into result
  from ascent_game.association_scores_v7 s where s.word=best_word and s.clue=any(clues) and s.strength>=78;
  if result<>'{}'::jsonb then return result;end if;
 end if;
 -- Direct connections require both a high clue similarity and corroboration from a known answer.
 select coalesce(jsonb_object_agg(v.word,'Semantic connection ('||round((1-(v.embedding operator(extensions.<=>) g))*100)::int||'% similarity)'),'{}') into direct_links
 from ascent_game.semantic_word_vectors v where v.word=any(clues)
 and 1-(v.embedding operator(extensions.<=>) g)>=0.91
 and exists(select 1 from ascent_game.association_scores_v7 s join ascent_game.semantic_word_vectors a on a.word=s.word where s.clue=v.word and s.strength>=78 and 1-(a.embedding operator(extensions.<=>) g)>=0.865);
 return direct_links;
exception when others then return '{}'::jsonb;
end;$fn$;
revoke all on function ascent_game.semantic_fallback(text[],text,uuid) from public,anon,authenticated;

-- Phase 2: initial backfill (private administrator; run manageable batches)
-- Select missing active clue and anchor terms:
-- with active as (select distinct unnest(clues) clue from ascent_game.rich_tier_boards_v7),
-- terms as (select distinct s.word from ascent_game.association_scores_v7 s join active a using(clue) where s.strength>=78 union select clue from active)
-- select word from terms where not exists(select 1 from ascent_game.semantic_word_vectors v where v.word=terms.word) order by word;
-- Pass at most 4 terms at a time to ascent_game.semantic_seed_words(text[]).
-- Production initially seeded 1,524 vectors. Enable only after verifying them.
update ascent_game.semantic_config set enabled=true where singleton;

-- Phase 3: integrate and preserve balance
-- 20261125005251 ascent_enable_semantic_scoring
do $patch$ declare d text;n text;begin
 select pg_get_functiondef('public.ascent_circuit(uuid,text,date,integer,text,date,uuid)'::regprocedure) into d;
 n:=replace(d,'links:=ascent_game.match_guess(dictionary_version,b.clues,answer);','links:=ascent_game.match_guess(dictionary_version,b.clues,answer);
   if dictionary_version=7 and links=''{}''::jsonb then links:=ascent_game.semantic_fallback(b.clues,answer,p_ticket);end if;');
 if n=d or (length(n)-length(replace(n,'ascent_game.semantic_fallback(b.clues,answer,p_ticket)','')))/length('ascent_game.semantic_fallback(b.clues,answer,p_ticket)')<>2 then raise exception 'Semantic scoring patch mismatch';end if;
 execute n;
end;$patch$;
-- Reserve a conservative allowance for the initial embedding build this month.
insert into ascent_game.semantic_usage(month,calls) values(date_trunc('month',now() at time zone 'UTC')::date,400) on conflict(month) do update set calls=least(20000,ascent_game.semantic_usage.calls+400);


-- 20261125005413 ascent_model_confirmed_missing_connections
with active as (select distinct unnest(clues) clue from ascent_game.rich_tier_boards_v7), sim as materialized (
 select a.word anchor,g.word guess,1-(a.embedding operator(extensions.<=>) g.embedding) similarity
 from ascent_game.semantic_word_vectors a cross join ascent_game.semantic_word_vectors g
 where a.word<>g.word and a.word not like '% %' and g.word not like '% %' and 1-(a.embedding operator(extensions.<=>) g.embedding)>=0.925
), candidates as (
 select distinct on(s.clue,m.guess) s.clue,m.guess,m.anchor,m.similarity,s.reason
 from sim m join ascent_game.association_scores_v7 s on s.word=m.anchor and s.strength>=78
 join active c on c.clue=s.clue join ascent_game.semantic_word_vectors d on d.word=s.clue join ascent_game.semantic_word_vectors g on g.word=m.guess
 where m.guess<>s.clue and 1-(d.embedding operator(extensions.<=>) g.embedding)>=0.80
 and s.reason not like 'Semantic link via %'
 and not exists(select 1 from ascent_game.association_scores_v7 old where old.clue=s.clue and old.word=m.guess)
 and not exists(select 1 from ascent_game.answer_aliases_v7 z where z.alias=m.guess and z.canonical<>m.guess)
 and (s.clue,m.guess) not in (('badge','dress'),('clam','snail'),('jury box','defendant'),('door hinge','locking'),('denim jeans','dress'))
 order by s.clue,m.guess,m.similarity desc
)
insert into ascent_game.association_scores_v7(clue,word,strength,reason)
select clue,guess,round(similarity*100)::smallint,'Semantic link via “'||anchor||'” ('||round(similarity*100)::int||'% model similarity): '||reason from candidates on conflict do nothing;
-- Use semantic evidence for the remaining clues of an unlisted answer, while
-- retaining the exact curated scores of known canonical answers for tier balance.
create function ascent_game.semantic_complete_guess(clues text[],guess text,ticket uuid,known jsonb) returns jsonb language plpgsql volatile set search_path='' as $fn$
declare normalized text; missing text[]; more jsonb;
begin
 normalized:=lower(btrim(regexp_replace(regexp_replace(coalesce(guess,''),'[’'']','','g'),'[[:space:]‐‑–—-]+',' ','g')));
 normalized:=btrim(regexp_replace(normalized,'[.!?]+$','','g'));
 if normalized=any(clues) or (select count(*) from jsonb_object_keys(known))=cardinality(clues) then return known;end if;
 -- Canonical entries already include the model-confirmed additions above. Their
 -- exact scores remain deterministic and the answer review remains consistent.
 if known<>'{}'::jsonb and exists(select 1 from ascent_game.association_scores_v7 s where s.clue=any(clues) and s.word=normalized and s.strength>=65) then return known;end if;
 missing:=array(select c from unnest(clues) c where not known ? c);
 if cardinality(missing)=0 then return known;end if;
 more:=ascent_game.semantic_fallback(missing,normalized,ticket);
 return known||coalesce(more,'{}'::jsonb);
exception when others then return known;
end;$fn$;
revoke all on function ascent_game.semantic_complete_guess(text[],text,uuid,jsonb) from public,anon,authenticated;
do $patch$ declare d text;n text;begin
 select pg_get_functiondef('public.ascent_circuit(uuid,text,date,integer,text,date,uuid)'::regprocedure) into d;
 n:=replace(d,'if dictionary_version=7 and links=''{}''::jsonb then links:=ascent_game.semantic_fallback(b.clues,answer,p_ticket);end if;','if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;');
 if n=d then raise exception 'Semantic merge integration mismatch';end if;
 execute n;
end;$patch$;

-- 20261125005446 ascent_preserve_tier_balance_and_tighten_semantics
-- Preserve the curated tier witnesses whenever a newly inferred pair would move them to another tier.
-- Only remove the model-generated additions from this deployment, never curated associations.
delete from ascent_game.association_scores_v7 s
where s.reason like 'Semantic link via %'
and exists(select 1 from ascent_game.rich_tier_boards_v7 b cross join lateral jsonb_array_elements(b.tier_witnesses) t(words) cross join lateral jsonb_array_elements_text(t.words) w(word)
where s.clue=any(b.clues) and (s.word=w.word or s.word=left(w.word,-1) and right(w.word,1)='s' or s.word=left(w.word,-2) and w.word~'(ch|sh|s|x|z)es$' or s.word=left(w.word,-3)||'y' and right(w.word,3)='ies')
and not (s.clue='needle' and s.word='clothing')
and (s.clue,s.word) not in (select 'needle','clothing'));
-- Tighten the live nearest-anchor search to avoid a generic one-word anchor
-- accidentally accepting a multi-word answer with an unrelated modifier.
do $patch$ declare d text;n text;begin
 select pg_get_functiondef('ascent_game.semantic_fallback(text[],text,uuid)'::regprocedure) into d;
 n:=replace(d,'where v.word<>all(clues) and exists','where v.word<>all(clues) and cardinality(string_to_array(v.word,'' ''))=cardinality(string_to_array(clean_guess,'' '')) and exists');
 n:=replace(n,'and s.strength>=78)','and s.strength>=78 and s.reason not like ''Semantic link via %'')');
 n:=replace(n,'and s.strength>=78;','and s.strength>=78 and s.reason not like ''Semantic link via %'' and exists(select 1 from ascent_game.semantic_word_vectors cv where cv.word=s.clue and 1-(cv.embedding operator(extensions.<=>) g)>=0.79);');
 if n=d then raise exception 'Semantic confidence patch mismatch';end if;execute n;
end;$patch$;

-- Repair tier witnesses for boards whose model-confirmed associations changed.
with invalid as materialized (
 select b.target,b.clues from ascent_game.rich_tier_boards_v7 b
 where exists(select 1 from jsonb_array_elements(b.tier_witnesses) with ordinality t(words,h) cross join lateral jsonb_array_elements_text(t.words) w(word) where (select count(*) from jsonb_object_keys(ascent_game.match_guess(7,b.clues,w.word)))<>t.h)
), words as materialized (
 select b.target,b.clues,s.word,count(*)::int raw_hits
 from invalid b join ascent_game.association_scores_v7 s on s.clue=any(b.clues) and s.strength>=65
 where s.word<>all(b.clues) and s.word !~ 's$' and s.word ~ '^[a-z]+( [a-z]+){0,5}$'
 group by b.target,b.clues,s.word
), ranked as (
 select *,row_number() over(partition by target,clues,raw_hits order by (word=target) desc,length(word),word) rn from words
), verified as materialized (
 select target,clues,word,(select count(*)::int from jsonb_object_keys(ascent_game.match_guess(7,clues,word))) h
 from ranked where rn<=case raw_hits when 1 then 20 when 2 then 14 when 3 then 12 when 4 then 14 when 5 then 10 else 5 end
), tiers as (
 select target,clues,h,array_agg(word order by (word=target) desc,length(word),word) words,count(*) n from verified where h between 1 and 6 group by target,clues,h
), ready as (
 select target,clues,jsonb_agg(to_jsonb(words[1:case h when 1 then 10 when 2 then 5 when 3 then 4 when 4 then 5 when 5 then 3 else 1 end]) order by h) witnesses,array_agg(n::int order by h) counts
 from tiers group by target,clues having count(*)=6 and bool_and(n>=case h when 1 then 10 when 2 then 5 when 3 then 4 when 4 then 5 when 5 then 3 else 1 end) and bool_and(h<>6 or words[1]=target)
)
update ascent_game.rich_tier_boards_v7 b set tier_witnesses=r.witnesses,tier_counts=r.counts from ready r where b.target=r.target and b.clues=r.clues;

-- Emergency kill switch (not executed):
-- update ascent_game.semantic_config set enabled=false where singleton;
