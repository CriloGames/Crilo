create function ascent_game.clue_terms(label text) returns text[] language sql immutable set search_path='' as $terms$
 with tokens as (select regexp_split_to_table(trim(regexp_replace(lower(regexp_replace(label,'[’'']','','g')),'[^a-z0-9]+',' ','g')),' +') w),
 compounds as (select * from (values ('airmail','air mail'),('airplane','air plane'),('airport','air port'),('ballpark','ball park'),('barbell','bar bell'),('bartender','bar tender'),('baseball','base ball'),('blueprint','blue print'),('bookshop','book shop'),('bullseye','bulls eye'),('cardboard','card board'),('carpool','car pool'),('checkbook','check book'),('checkbox','check box'),('checkout','check out'),('courtroom','court room'),('courtyard','court yard'),('crowbar','crow bar'),('cupboard','cup board'),('curveball','curve ball'),('database','data base'),('deadline','dead line'),('doorknob','door knob'),('download','down load'),('dugout','dug out'),('dumbbell','dumb bell'),('earring','ear ring'),('eyeglasses','eye glasses'),('fastball','fast ball'),('fingertip','finger tip'),('firefighter','fire fighter'),('firefly','fire fly'),('fishmonger','fish monger'),('flashlight','flash light'),('flowerbed','flower bed'),('football','foot ball'),('footpath','foot path'),('footprints','foot prints'),('gallbladder','gall bladder'),('greenhouse','green house'),('groundwater','ground water'),('handprint','hand print'),('handshake','hand shake'),('handwriting','hand writing'),('hardback','hard back'),('hardcover','hard cover'),('honeycomb','honey comb'),('hourglass','hour glass'),('lawsuit','law suit'),('lifeguard','life guard'),('lighthouse','light house'),('mailbox','mail box'),('microcontroller','micro controller'),('motherboard','mother board'),('motorway','motor way'),('neckwear','neck wear'),('newspaper','news paper'),('nightlife','night life'),('nighttime','night time'),('outlaws','out laws'),('padlock','pad lock'),('paintbrush','paint brush'),('paperback','paper back'),('paperwork','paper work'),('password','pass word'),('payload','pay load'),('peanut','pea nut'),('playground','play ground'),('plywood','ply wood'),('postcard','post card'),('postman','post man'),('postmark','post mark'),('powerhouse','power house'),('redwood','red wood'),('sailboat','sail boat'),('scoreboard','score board'),('seabed','sea bed'),('seesaw','see saw'),('shareholder','share holder'),('shoelace','shoe lace'),('softball','soft ball'),('software','soft ware'),('spreadsheet','spread sheet'),('starfish','star fish'),('startup','start up'),('storeroom','store room'),('suitcase','suit case'),('sunrise','sun rise'),('sunset','sun set'),('surfboard','surf board'),('toothpaste','tooth paste'),('treetop','tree top'),('ultrasound','ultra sound'),('undergrowth','under growth'),('uppercase','upper case'),('volleyball','volley ball'),('walnut','wal nut'),('watchdog','watch dog'),('woodchips','wood chips'),('worksite','work site'),('wristwatch','wrist watch'),('backpack','back pack'),('bedroll','bed roll'),('firewood','fire wood'),('meltwater','melt water'),('iceberg','ice berg'),('checkmate','check mate'),('endgame','end game'),('tightrope','tight rope'),('handlebar','handle bar'),('passport','pass port'),('runway','run way'),('taxiway','taxi way'),('windsock','wind sock'),('waterproof','water proof'),('worktop','work top'),('windward','wind ward'),('downbeat','down beat'),('darkroom','dark room'),('fireplace','fire place'),('headlight','head light'),('moonlight','moon light'),('sunlight','sun light'),('lightbulb','light bulb'),('lightweight','light weight'),('raincoat','rain coat'),('snowball','snow ball'),('waterfall','water fall'),('doorbell','door bell'),('seashell','sea shell'),('starlight','star light'),('sunflower','sun flower'),('newsroom','news room')) v(w,parts))
 select array(select distinct term from (select w term from tokens union all select unnest(string_to_array(v.parts,' ')) from tokens t join compounds v on t.w=v.w or t.w=v.w||'s' or t.w=v.w||'es') expanded)
$terms$;
CREATE OR REPLACE FUNCTION ascent_game.is_displayed_clue(clues text[], guess text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with normalized as (select btrim(regexp_replace(lower(regexp_replace(coalesce(guess,''),'[’'']','','g')),'[[:space:]‐‑–—-]+',' ','g')) g),
forms as (select btrim(regexp_replace(g,'[.!?]+$','','g')) g from normalized),
clean as (select regexp_replace(g,'^(a|an|the) +','','i') g from forms)
select exists(select 1 from clean cross join unnest(clues) c where
 (' '||lower(regexp_replace(c,'[^a-zA-Z0-9]+',' ','g'))||' ') like ('% '||replace(replace(g,'%','\\%'),'_','\\_')||' %') or
 exists(select 1 from unnest(ascent_game.clue_terms(c)) token where g=token or (length(token)>2 and g=token||'s') or (length(g)>2 and token=g||'s')) or
 g=c or g=regexp_replace(c,'^(a|an|the) +','','i') or
 exists(select 1 from ascent_game.equivalent_answers a join ascent_game.equivalent_answers b using(group_key) where a.group_key like 'inflection:%' and a.word=g and b.word=c))
$function$
;
CREATE OR REPLACE FUNCTION ascent_game.llm_complete(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if not coalesce(enabled_flag,false) then return known||ascent_game.semantic_fallback(array(select x from unnest(clues) x where not known ? x),guess,ticket);end if;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '^(not|unrelated|none|except|without)($| )' or guess ~ '(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 missing:=array(select x from unnest(clues) x where not result ? x and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=x and k.version='llama70b-r3' and not k.accepted and k.created_at>now()-interval '1 day'));
 -- Known, cached and vector-backed matches are ready to score locally.
 if cardinality(missing)=0 or result<>'{}'::jsonb then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'llama70b-r3' or jsonb_typeof(reply->'matches') is distinct from 'object' then
   -- Quota exhaustion is an immediate refusal, not a slow model call.
   if v is null and reply->>'status'='429' and clock_timestamp()-statement_timestamp()<interval '250 milliseconds' then
    return result||ascent_game.semantic_fallback(array(select x from unnest(clues) x where not result ? x),guess,ticket);
   end if;
   -- Never stack a second model request on a slow or timed-out request.
   return result;
 end if;
 if exists(select 1 from jsonb_each(reply->'matches') e where e.key<>all(missing) or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}') not between 4 and 150) then return result;end if;
 foreach c in array missing loop
  explanation:=reply->'matches'->>c;
  insert into ascent_game.llm_pair_cache(guess,clue,version,accepted,reason) values(guess,c,'llama70b-r3',explanation is not null,coalesce(explanation,'')) on conflict on constraint llm_pair_cache_pkey do update set accepted=excluded.accepted,reason=excluded.reason,created_at=now();
  if explanation is not null then result:=result||jsonb_build_object(c,explanation||' — AI relationship');end if;
 end loop;
 return result;
exception when others then return result;
end;$function$
;
CREATE OR REPLACE FUNCTION ascent_game.semantic_complete_guess(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare normalized text; corrected text; missing text[]; more jsonb; result jsonb;
begin
 normalized:=lower(btrim(regexp_replace(regexp_replace(coalesce(guess,''),'[’'']','','g'),'[[:space:]‐‑–—-]+',' ','g')));
 normalized:=btrim(regexp_replace(normalized,'[.!?]+$','','g'));
 if ascent_game.is_displayed_clue(clues,normalized) then return '{}'::jsonb;end if;
 if normalized=any(clues) or (select count(*) from jsonb_object_keys(known))=cardinality(clues) then return ascent_game.filter_rejected_associations(normalized,known);end if;
 corrected:=normalized;
 known:=ascent_game.knowledge_matches(clues,normalized,known);
 if known='{}'::jsonb then
  corrected:=ascent_game.correct_spelling(normalized);
  if ascent_game.is_displayed_clue(clues,corrected) then return '{}'::jsonb;end if;
  if corrected<>normalized then known:=ascent_game.match_guess(7,clues,corrected);end if;
 end if;
 known:=ascent_game.complete_equivalent_answers(clues,corrected,known);
 if corrected<>normalized then known:=ascent_game.knowledge_matches(clues,corrected,known);end if;
 missing:=array(select c from unnest(clues) c where not known ? c);
 if cardinality(missing)>0 then result:=ascent_game.llm_complete(clues,corrected,ticket,known);else result:=known;end if;
 result:=ascent_game.filter_rejected_associations(corrected,result);
 if corrected<>normalized and result<>'{}'::jsonb then
  select jsonb_object_agg(key,'Interpreted as “'||corrected||'” — '||value) into result from jsonb_each_text(result);
 end if;
 return result;
exception when others then return known;
end;$function$
;
do $update$ declare definition text; begin
 select pg_get_functiondef(p.oid) into strict definition from pg_proc p where p.pronamespace='ascent_game'::regnamespace and proname='llm_request';
 execute replace(definition,'''7000''','''2200''');
end;$update$;