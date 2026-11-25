CREATE OR REPLACE FUNCTION public.ascent_llm_reserve(p_token text, p_ticket uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare today date:=(now() at time zone 'UTC')::date;n int;
begin
 if p_ticket is null or not coalesce((select secret=p_token from ascent_game.semantic_config where singleton),false) then return false;end if;
 begin
 insert into ascent_game.llm_player_usage(day,ticket,calls) values(today,p_ticket,1) on conflict(day,ticket) do update set calls=ascent_game.llm_player_usage.calls+1 where ascent_game.llm_player_usage.calls<12 returning calls into n;
 if n is null then return false;end if;
 n:=null;
 insert into ascent_game.llm_daily_usage(day,calls) values(today,1) on conflict(day) do update set calls=ascent_game.llm_daily_usage.calls+1 where ascent_game.llm_daily_usage.calls<80 returning calls into n;
 if n is null then raise exception using errcode='P0002',message='global reasoning limit';end if;
 return true;
 exception when sqlstate 'P0002' then return false;
 end;
end;$function$;

CREATE OR REPLACE FUNCTION public.ascent_prepare_generated_practice(p_seed uuid, p_ticket uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare avoid text[]; token text;
begin
 if p_seed is null or p_ticket is null then raise exception 'Invalid route';end if;
 if exists(select 1 from ascent_game.circuits where route_id='practice:'||p_seed) then return '{"exists":true}'::jsonb;end if;
 select secret into token from ascent_game.semantic_config where singleton;
 -- Reserve both generation and independent review within the existing caps.
 begin
  if not public.ascent_llm_reserve(token,p_ticket) then raise exception using errcode='P0002',message='generation quota';end if;
  if not public.ascent_llm_reserve(token,p_ticket) then raise exception using errcode='P0002',message='review quota';end if;
  -- Preserve at least the last 16 global and 4 player requests for live guess reasoning.
  if exists(select 1 from ascent_game.llm_daily_usage where day=(now() at time zone 'UTC')::date and calls>64) or exists(select 1 from ascent_game.llm_player_usage where day=(now() at time zone 'UTC')::date and ticket=p_ticket and calls>8) then raise exception using errcode='P0002',message='generation reserve';end if;
 exception when sqlstate 'P0002' then return '{"quota":true}'::jsonb;
 end;
 select coalesce(array_agg(t),'{}') into avoid from (select distinct b->>'target' t from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards) b where c.route_id like 'daily:%' or exists(select 1 from ascent_game.runs r where r.ticket=p_ticket and r.scope=c.route_id) limit 250) a;
 return jsonb_build_object('avoid',avoid);
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_complete(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '^(not|unrelated|none|except|without)($| )' or guess ~ '(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 if not coalesce(enabled_flag,false) then if (select count(*) from jsonb_object_keys(result))<cardinality(clues) then perform set_config('ascent.match_incomplete','true',true);end if;return result;end if;
 missing:=array(select x from unnest(clues) x where not result ? x
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=x and r.word=$2) or (r.word=x and r.clue=$2))
 and not exists(select 1 from ascent_game.llm_pair_cache k where ((k.guess=$2 and k.clue=x) or (k.guess=x and k.clue=$2)) and k.version='gptoss120b-r6' and not k.accepted and k.created_at>now()-interval '4 hours'));
 -- Known, cached and vector-backed matches are ready to score locally.
 if cardinality(missing)=0 then return result;end if;
 -- Obvious keyboard noise cannot form a conventional relationship.
 if guess ~ '([a-z])\1\1\1' then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'gptoss120b-r6' or jsonb_typeof(reply->'matches') is distinct from 'object' then
   -- Never stack a second model request on a slow or timed-out request.
   perform set_config('ascent.match_incomplete','true',true);return result;
 end if;
 if exists(select 1 from jsonb_each(reply->'matches') e where e.key<>all(missing) or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}') not between 4 and 150) then perform set_config('ascent.match_incomplete','true',true);return result;end if;
 foreach c in array missing loop
  explanation:=reply->'matches'->>c;
  insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason) values(guess,c,'gptoss120b-r6',explanation is not null,coalesce(explanation,'')) on conflict on constraint llm_pair_cache_pkey do update set accepted=excluded.accepted,reason=excluded.reason,created_at=now();
  if explanation is not null then result:=result||jsonb_build_object(c,explanation||' — AI relationship');end if;
 end loop;
 return result;
exception when others then perform set_config('ascent.match_incomplete','true',true);return result;
end;$function$;
