CREATE OR REPLACE FUNCTION ascent_game.llm_complete(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if not coalesce(enabled_flag,false) then perform set_config('ascent.match_incomplete','true',true);return known;end if;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '^(not|unrelated|none|except|without)($| )' or guess ~ '(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 missing:=array(select x from unnest(clues) x where not result ? x and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=x and k.version='gptoss120b-r5' and not k.accepted and k.created_at>now()-interval '4 hours'));
 -- Known, cached and vector-backed matches are ready to score locally.
 if cardinality(missing)=0 then return result;end if;
 -- Obvious keyboard noise cannot form a conventional relationship.
 if guess !~ '[aeiouy]' and length(guess)>=4 or guess ~ '([a-z])\1\1\1' then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'gptoss120b-r5' or jsonb_typeof(reply->'matches') is distinct from 'object' then
   -- Never stack a second model request on a slow or timed-out request.
   perform set_config('ascent.match_incomplete','true',true);return result;
 end if;
 if exists(select 1 from jsonb_each(reply->'matches') e where e.key<>all(missing) or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}') not between 4 and 150) then perform set_config('ascent.match_incomplete','true',true);return result;end if;
 foreach c in array missing loop
  explanation:=reply->'matches'->>c;
  insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason) values(guess,c,'gptoss120b-r5',explanation is not null,coalesce(explanation,'')) on conflict on constraint llm_pair_cache_pkey do update set accepted=excluded.accepted,reason=excluded.reason,created_at=now();
  if explanation is not null then result:=result||jsonb_build_object(c,explanation||' — AI relationship');end if;
 end loop;
 return result;
exception when others then perform set_config('ascent.match_incomplete','true',true);return result;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_request(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare resp extensions.http_response;token text;
begin
 select secret into token from ascent_game.semantic_config where singleton;
 perform set_config('http.curlopt_timeout_msec','4500',true);
 perform set_config('http.curlopt_connecttimeout_msec','900',true);
 select * into resp from extensions.http(('POST','https://mqozqigwkobnhijvvboy.supabase.co/functions/v1/ascent-reasoning',array[extensions.http_header('x-ascent-token',token)],'application/json',payload::text)::extensions.http_request);
 if resp.status=200 then return resp.content::jsonb;end if;
 return jsonb_build_object('error','reasoning unavailable','status',resp.status);
 exception when others then return jsonb_build_object('error','reasoning request failed','state',sqlstate);
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_cached_matches(clues text[], guess text, known jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with candidates as (
 select c.clue,c.reason,c.created_at,c.version,0 direction from ascent_game.llm_pair_cache c where c.guess=$2 and c.clue=any($1) and c.version in ('llama70b-r3','llama70b-r4','gptoss120b-r5') and c.accepted
 union all
 select c.guess,c.reason,c.created_at,c.version,1 direction from ascent_game.llm_pair_cache c where c.clue=$2 and c.guess=any($1) and c.version in ('llama70b-r4','gptoss120b-r5') and c.accepted
), chosen as (
 select distinct on(c.clue) c.clue,c.reason from candidates c where not $3 ? c.clue and c.created_at>now()-interval '30 days'
 and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=c.clue and k.version='gptoss120b-r5' and not k.accepted and k.created_at>=c.created_at and k.created_at>now()-interval '4 hours')
 and not exists(select 1 from ascent_game.rejected_associations r where (r.clue=c.clue and r.word=$2) or (r.clue=$2 and r.word=c.clue))
 order by c.clue,(c.version='gptoss120b-r5') desc,c.version desc,c.direction,c.created_at desc
)
select $3||coalesce((select jsonb_object_agg(clue,reason||' — AI relationship') from chosen where (select enabled from ascent_game.llm_config where singleton)),'{}'::jsonb)
$function$;

CREATE OR REPLACE FUNCTION public.ascent_top_answers(p_ticket uuid, p_day date, p_archive date DEFAULT NULL::date, p_seed uuid DEFAULT NULL::uuid, p_pitch integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
with board as (
 select c.lex_version,c.boards->(p_pitch-1) generated,array(select jsonb_array_elements_text(c.boards->(p_pitch-1)->'clues')) clues
 from ascent_game.runs r join ascent_game.circuits c on c.route_id=case when p_seed is null then 'daily:'||to_char(r.day,'YYYY-MM-DD') else 'practice:'||p_seed end
 where r.ticket=p_ticket and r.day=p_day and jsonb_array_length(r.history)=5
 and r.scope=case when p_seed is not null then 'practice:'||p_seed when p_archive=p_day then 'replay' else 'daily' end and p_pitch between 1 and 5
), raw as (
 select e.key word,count(distinct e.clue)::int hits,jsonb_object_agg(e.clue,e.value) links,b.clues,b.lex_version,b.generated
 from board b cross join lateral (
 select l.clue,e.key,e.value from ascent_game.circuit_lexicon l cross join lateral jsonb_each_text(l.links) e where l.edition=b.lex_version and b.lex_version<>7 and l.clue=any(b.clues)
 union all select s.clue,s.word,s.reason||' ('||s.strength||'% match)' from ascent_game.association_scores_v7 s where b.lex_version=7 and s.clue=any(b.clues) and s.strength>=65
 union all select k.clue,k.word,k.source from ascent_game.knowledge_edges k where b.lex_version=7 and k.clue=any(b.clues)
 union all select cc.clue,aa->>'word',rr.reason from jsonb_array_elements(coalesce(b.generated->'answers','[]'::jsonb)) aa cross join lateral jsonb_array_elements_text(b.generated->'clues') with ordinality cc(clue,i) cross join lateral jsonb_array_elements_text(aa->'reasons') with ordinality rr(reason,i) where cc.i=rr.i and rr.reason is not null
 union all select k.clue,k.guess,k.reason from ascent_game.llm_pair_cache k where b.lex_version=7 and k.clue=any(b.clues) and k.version in ('llama70b-r3','llama70b-r4','gptoss120b-r5') and k.accepted and k.created_at>now()-interval '30 days' and (select enabled from ascent_game.llm_config where singleton)
 ) e where e.key<>all(b.clues) group by e.key,b.clues,b.lex_version,b.generated
), raw_ranked as (
 select *,row_number() over(partition by hits order by length(word),word collate "C") rn from raw
), witnesses as (
 select distinct w.word from board b join ascent_game.rich_tier_boards_v7 r on b.clues @> r.clues and r.clues @> b.clues and r.semantic_verified
 cross join lateral jsonb_array_elements(r.tier_witnesses) t(words) cross join lateral jsonb_array_elements_text(t.words) w(word)
), evaluated as materialized (
 select word,clues,case when lex_version=7 then ascent_game.preview_registered_guess(clues,word)||ascent_game.generated_links(generated,word) else links end links
 from raw_ranked where lex_version<>7 or rn<=30 or word in(select word from witnesses)
), matched as (
 select *, (select count(*)::int from jsonb_object_keys(links)) hits from evaluated
), ranked as (
 select word,hits,links,case when hits=6 then 200 else 10*(hits*(hits+1)/2+(select count(*) from generate_series(1,3) i where links ? clues[i] and links ? clues[i+3])) end points from matched where hits>0 and not ascent_game.is_displayed_clue(clues,word)
), tier_ranked as (
 select *,row_number() over(partition by hits order by points desc,word collate "C") tier_rank from ranked
), chosen as (
 select * from tier_ranked order by (tier_rank<=case hits when 1 then 10 when 2 then 5 when 3 then 4 when 4 then 5 when 5 then 3 else 1 end) desc,points desc,word collate "C" limit 100
)
select coalesce(jsonb_agg(jsonb_build_object('word',word,'hits',hits,'links',links,'points',points) order by points desc,word collate "C"),'[]') from chosen;
$function$;
