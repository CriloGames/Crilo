insert into ascent_game.association_scores_v7(clue,word,strength,reason) select x.clue,x.word,85,x.reason from jsonb_to_recordset('[{"clue":"compass needle","word":"bearing","reason":"A compass needle indicates a magnetic bearing."},{"clue":"compass needle","word":"orientation","reason":"A compass needle helps determine orientation."},{"clue":"compass needle","word":"pointer","reason":"The compass needle acts as a pointer."},{"clue":"compass needle","word":"magnetism","reason":"Magnetism aligns a compass needle."},{"clue":"compass needle","word":"travel","reason":"A compass needle helps travelers navigate."},{"clue":"ballet","word":"dancer","reason":"A ballet dancer performs ballet."},{"clue":"ballet","word":"choreography","reason":"Ballet performances are choreographed."},{"clue":"ballet","word":"rhythm","reason":"Ballet movement follows musical rhythm."},{"clue":"ballet","word":"footwork","reason":"Ballet requires precise footwork."},{"clue":"ballet","word":"theater","reason":"Ballet is commonly performed in theaters."},{"clue":"ballet","word":"toes","reason":"Pointe ballet dancers balance on their toes."},{"clue":"score","word":"result","reason":"A score records a competitive result."},{"clue":"score","word":"sheet music","reason":"A written musical score is sheet music."},{"clue":"score","word":"notation","reason":"A musical score uses notation."},{"clue":"score","word":"tally","reason":"A score is a tally of points."},{"clue":"score","word":"judge","reason":"Judges award scores in evaluated events."},{"clue":"score","word":"goal","reason":"A goal changes the score in many sports."},{"clue":"debate","word":"reasoning","reason":"Debaters present reasoning for their positions."},{"clue":"debate","word":"rhetoric","reason":"Debate relies on persuasive rhetoric."},{"clue":"debate","word":"judgment","reason":"Judges evaluate competitive debates."},{"clue":"debate","word":"politics","reason":"Political candidates participate in debates."},{"clue":"debate","word":"evidence","reason":"Debaters use evidence to support claims."},{"clue":"debate","word":"persuasion","reason":"Debaters try to persuade an audience."},{"clue":"fountain pen","word":"handwriting","reason":"Fountain pens are used for handwriting."},{"clue":"fountain pen","word":"calligraphy","reason":"Fountain pens are used in some forms of calligraphy."},{"clue":"fountain pen","word":"signature","reason":"A fountain pen can be used to sign documents."},{"clue":"fountain pen","word":"tip","reason":"A fountain pen has a writing tip."},{"clue":"fountain pen","word":"refill","reason":"Refillable fountain pens use ink cartridges or reservoirs."},{"clue":"fountain pen","word":"letter","reason":"A fountain pen can write a handwritten letter."},{"clue":"needle","word":"tip","reason":"Many needles have a pointed tip."},{"clue":"needle","word":"pin","reason":"A sewing pin and needle are both slender pointed tools."},{"clue":"needle","word":"craft","reason":"Needles are used in sewing and other crafts."},{"clue":"needle","word":"medicine","reason":"Medical needles deliver drugs or collect samples."},{"clue":"needle","word":"fabric","reason":"Sewing needles pass through fabric."},{"clue":"needle","word":"stitching","reason":"Needles are used to make stitches."},{"clue":"hoist","word":"lift","reason":"A hoist lifts loads."},{"clue":"hoist","word":"crane","reason":"Many cranes use a hoist."},{"clue":"hoist","word":"construction equipment","reason":"Hoists lift materials on construction sites."},{"clue":"hoist","word":"pulley","reason":"Many hoists employ pulleys."},{"clue":"hoist","word":"rope","reason":"Some hoists use wire rope."},{"clue":"building skeleton","word":"frame","reason":"A building skeleton is its structural frame."},{"clue":"building skeleton","word":"steel","reason":"Steel can form the skeleton of a building."},{"clue":"building skeleton","word":"beam","reason":"Beams form part of a structural skeleton."},{"clue":"building skeleton","word":"column","reason":"Columns support a building frame."},{"clue":"building skeleton","word":"structure","reason":"The skeleton is the load-bearing structure."},{"clue":"plaster","word":"wall","reason":"Plaster is applied to walls."},{"clue":"plaster","word":"ceiling","reason":"Plaster can finish ceilings."},{"clue":"plaster","word":"gypsum","reason":"Gypsum is a common plaster ingredient."},{"clue":"plaster","word":"masonry","reason":"Plaster is applied over masonry surfaces."},{"clue":"plaster","word":"coating","reason":"Plaster is a protective or decorative coating."},{"clue":"granite","word":"stone","reason":"Granite is a natural stone."},{"clue":"granite","word":"rock","reason":"Granite is an igneous rock."},{"clue":"granite","word":"countertop","reason":"Granite is commonly used for countertops."},{"clue":"granite","word":"quarry","reason":"Granite is extracted from quarries."},{"clue":"granite","word":"mineral","reason":"Granite contains minerals such as quartz and feldspar."},{"clue":"building site","word":"worker","reason":"Construction workers work at building sites."},{"clue":"building site","word":"crane","reason":"Cranes lift loads at building sites."},{"clue":"building site","word":"excavation","reason":"Building sites may require excavation."},{"clue":"building site","word":"safety","reason":"Safety procedures are essential on building sites."},{"clue":"building site","word":"architecture","reason":"Building sites are where architectural designs are constructed."},{"clue":"plank","word":"wood","reason":"Many planks are made of wood."},{"clue":"plank","word":"timber","reason":"A plank is a length of sawn timber."},{"clue":"plank","word":"floor","reason":"Wooden floors may be made of planks."},{"clue":"plank","word":"board","reason":"A plank is a long, flat board."},{"clue":"plank","word":"exercise","reason":"A plank is also an isometric exercise."},{"clue":"strait","word":"water","reason":"A strait is a narrow passage of water."},{"clue":"strait","word":"navigation","reason":"Ships navigate through straits."},{"clue":"strait","word":"sea","reason":"A strait can connect two seas."},{"clue":"strait","word":"shipping","reason":"Straits are important shipping passages."},{"clue":"strait","word":"geography","reason":"Straits are geographic water features."},{"clue":"shipping lane","word":"ship","reason":"Ships travel along shipping lanes."},{"clue":"shipping lane","word":"trade","reason":"Shipping lanes carry international trade."},{"clue":"shipping lane","word":"navigation","reason":"Shipping lanes guide maritime navigation."},{"clue":"shipping lane","word":"route","reason":"A shipping lane is a designated maritime route."},{"clue":"shipping lane","word":"ocean","reason":"Shipping lanes cross oceans."},{"clue":"canal","word":"water","reason":"A canal carries water."},{"clue":"canal","word":"boat","reason":"Boats travel through navigable canals."},{"clue":"canal","word":"lock","reason":"Canal locks raise or lower boats between water levels."},{"clue":"canal","word":"shipping","reason":"Shipping canals shorten maritime routes."},{"clue":"canal","word":"irrigation","reason":"Canals can carry water for irrigation."},{"clue":"antenna","word":"signal","reason":"An antenna transmits or receives signals."},{"clue":"antenna","word":"radio","reason":"Radios use antennas."},{"clue":"antenna","word":"broadcast","reason":"Broadcast transmitters use antennas."},{"clue":"antenna","word":"frequency","reason":"Antennas are designed for particular frequencies."},{"clue":"antenna","word":"reception","reason":"Antennas receive electromagnetic waves."},{"clue":"television","word":"broadcast","reason":"Television programs can be broadcast."},{"clue":"television","word":"screen","reason":"A television displays images on a screen."},{"clue":"television","word":"signal","reason":"A television can receive a broadcast signal."},{"clue":"television","word":"program","reason":"Television stations show programs."},{"clue":"television","word":"media","reason":"Television is a form of mass media."},{"clue":"radio station","word":"broadcast","reason":"A radio station broadcasts programming."},{"clue":"radio station","word":"frequency","reason":"Radio stations transmit on assigned frequencies."},{"clue":"radio station","word":"music","reason":"Many radio stations broadcast music."},{"clue":"radio station","word":"signal","reason":"A radio station transmits a radio signal."},{"clue":"radio station","word":"media","reason":"Radio stations are broadcast media."},{"clue":"square number","word":"math","reason":"Square numbers are a mathematical concept."},{"clue":"square number","word":"multiplication","reason":"A square number is obtained by multiplying an integer by itself."},{"clue":"square number","word":"integer","reason":"A square number is the square of an integer."},{"clue":"square number","word":"arithmetic","reason":"Calculating squares is an arithmetic operation."},{"clue":"square number","word":"exponent","reason":"A square raises a number to exponent two."},{"clue":"garden soil","word":"dirt","reason":"Garden soil is commonly called garden dirt."},{"clue":"garden soil","word":"compost","reason":"Compost improves garden soil."},{"clue":"garden soil","word":"nutrients","reason":"Garden soil supplies nutrients to plants."},{"clue":"garden soil","word":"planting","reason":"Garden soil is used for planting."},{"clue":"garden soil","word":"earth","reason":"Garden soil is cultivated earth."},{"clue":"equation","word":"math","reason":"An equation states a mathematical equality."},{"clue":"equation","word":"algebra","reason":"Algebra includes solving equations."},{"clue":"equation","word":"variable","reason":"Equations can contain variables."},{"clue":"equation","word":"solution","reason":"A solution satisfies an equation."},{"clue":"equation","word":"formula","reason":"Many formulas are expressed as equations."},{"clue":"family history","word":"ancestry","reason":"Family history records ancestry."},{"clue":"family history","word":"genealogy","reason":"Genealogy is the study of family history."},{"clue":"family history","word":"heritage","reason":"Family history can document inherited heritage."},{"clue":"family history","word":"relatives","reason":"Family history records relationships among relatives."},{"clue":"family history","word":"generation","reason":"Family history traces generations."},{"clue":"tree","word":"wood","reason":"Trees are a source of wood."},{"clue":"tree","word":"trunk","reason":"A tree has a trunk."},{"clue":"tree","word":"branch","reason":"Most trees have branches."},{"clue":"tree","word":"forest","reason":"Forests contain trees."},{"clue":"tree","word":"leaf","reason":"Many trees grow leaves."},{"clue":"carrot","word":"vegetable","reason":"A carrot is a root vegetable."},{"clue":"carrot","word":"food","reason":"Carrots are edible food."},{"clue":"carrot","word":"orange","reason":"Many carrots are orange."},{"clue":"carrot","word":"garden","reason":"Carrots are grown in gardens."},{"clue":"carrot","word":"crop","reason":"Carrots are cultivated as a crop."},{"clue":"presentation","word":"speech","reason":"A presentation may include a prepared speech."},{"clue":"presentation","word":"audience","reason":"Presentations are delivered to an audience."},{"clue":"presentation","word":"slides","reason":"Presentations often use slides."},{"clue":"presentation","word":"speaker","reason":"A speaker delivers a presentation."},{"clue":"presentation","word":"communication","reason":"Presentations communicate information."},{"clue":"sales call","word":"customer","reason":"A sales call contacts a prospective customer."},{"clue":"sales call","word":"business","reason":"Sales calls are a business activity."},{"clue":"sales call","word":"persuasion","reason":"A sales call aims to persuade a customer."},{"clue":"sales call","word":"telephone","reason":"Sales calls are commonly conducted by telephone."},{"clue":"sales call","word":"marketing","reason":"Sales calls support direct marketing."},{"clue":"slope","word":"incline","reason":"A slope is an incline."},{"clue":"slope","word":"angle","reason":"An angle can describe the steepness of a slope."},{"clue":"slope","word":"gradient","reason":"Gradient measures slope."},{"clue":"slope","word":"hill","reason":"A hill has sloping terrain."},{"clue":"slope","word":"steepness","reason":"Slope measures steepness."},{"clue":"tar","word":"roof","reason":"Tar-based products have been used in roofing."},{"clue":"tar","word":"sticky","reason":"Tar is a sticky material."},{"clue":"tar","word":"road","reason":"Tar has historically been used in road surfacing."},{"clue":"tar","word":"coating","reason":"Tar can be applied as a protective coating."},{"clue":"baseball","word":"sport","reason":"Baseball is a sport."},{"clue":"baseball","word":"bat","reason":"Baseball players use bats."},{"clue":"baseball","word":"game","reason":"Baseball is a competitive game."},{"clue":"baseball","word":"throw","reason":"Baseball players throw the ball."},{"clue":"baseball","word":"team","reason":"Baseball is played by two teams."},{"clue":"camping tent","word":"shelter","reason":"A camping tent provides shelter."},{"clue":"camping tent","word":"outdoors","reason":"Camping tents are used outdoors."},{"clue":"camping tent","word":"fabric","reason":"Tent walls are typically fabric."},{"clue":"camping tent","word":"pole","reason":"Many camping tents use poles for support."},{"clue":"camping tent","word":"campsite","reason":"A camping tent is erected at a campsite."},{"clue":"red pepper","word":"spice","reason":"Dried red peppers are used as a spice."},{"clue":"red pepper","word":"vegetable","reason":"Fresh red peppers are used as vegetables."},{"clue":"red pepper","word":"capsaicin","reason":"Hot red peppers contain capsaicin."},{"clue":"red pepper","word":"cooking","reason":"Red peppers are ingredients in cooking."},{"clue":"red pepper","word":"heat","reason":"Hot red peppers produce a sensation of heat."},{"clue":"bullet","word":"ammunition","reason":"A bullet is the projectile component of many cartridges."},{"clue":"bullet","word":"projectile","reason":"A bullet is a projectile."},{"clue":"bullet","word":"metal","reason":"Many bullets are made of metal."},{"clue":"bullet","word":"list","reason":"A bullet marks an item in a bulleted list."},{"clue":"bullet","word":"target","reason":"Bullets may be fired at targets."},{"clue":"kiln","word":"pottery","reason":"Pottery is fired in a kiln."},{"clue":"kiln","word":"ceramics","reason":"Kilns fire ceramics."},{"clue":"kiln","word":"heat","reason":"A kiln uses high heat."},{"clue":"kiln","word":"oven","reason":"A kiln is a specialized high-temperature oven."},{"clue":"kiln","word":"clay","reason":"Clay objects can be fired in kilns."},{"clue":"candle","word":"wax","reason":"Many candles are made of wax."},{"clue":"candle","word":"wick","reason":"A candle burns at its wick."},{"clue":"candle","word":"light","reason":"A lit candle produces light."},{"clue":"candle","word":"flame","reason":"A burning candle produces a flame."},{"clue":"candle","word":"heat","reason":"A candle flame gives off heat."},{"clue":"smoke alarm","word":"safety","reason":"Smoke alarms are safety devices."},{"clue":"smoke alarm","word":"detector","reason":"A smoke alarm detects smoke."},{"clue":"smoke alarm","word":"warning","reason":"A smoke alarm gives an audible warning."},{"clue":"smoke alarm","word":"battery","reason":"Many smoke alarms use batteries."},{"clue":"smoke alarm","word":"sound","reason":"Smoke alarms produce a loud sound."},{"clue":"dismissal","word":"termination","reason":"Dismissal can mean termination of employment."},{"clue":"dismissal","word":"job","reason":"A dismissal can end a job."},{"clue":"dismissal","word":"school","reason":"School dismissal ends the school day."},{"clue":"dismissal","word":"court","reason":"A court may order dismissal of a case."},{"clue":"dismissal","word":"rejection","reason":"Dismissal may mean rejection of an argument."}]'::jsonb) x(clue text,word text,reason text) where not exists(select 1 from ascent_game.rejected_associations r where r.clue=x.clue and r.word=x.word) on conflict(clue,word) do nothing;

with mono as (select word,min(synset) synset from ascent_game.wordnet_members group by word having count(*)=1), candidates as (
select distinct on (a.clue,m.word) a.clue,m.word,a.word evidence,a.reason
from ascent_game.association_scores_v7 a join mono s on s.word=a.word join mono m on m.synset=s.synset and m.word<>s.word
where a.strength>=85 and a.reason not like 'Semantic link via %' and a.reason not like 'Shared meaning%' and a.reason not like 'Related through%' and m.word<>a.clue and length(m.word)>2
and not exists(select 1 from ascent_game.association_scores_v7 x where x.clue=a.clue and x.word=m.word)
and not exists(select 1 from ascent_game.knowledge_edges k where k.clue=a.clue and k.word=m.word)
and not exists(select 1 from ascent_game.rejected_associations x where x.clue=a.clue and x.word in (m.word,a.word))
order by a.clue,m.word,a.strength desc,a.word)
insert into ascent_game.knowledge_edges(clue,word,relation,source,evidence,strength) select clue,word,'synonym_of_association','Open English WordNet',evidence||' ('||reason||')',85 from candidates on conflict do nothing;

CREATE OR REPLACE FUNCTION ascent_game.generate_misdirection_climb(seed text, player uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
 pitches jsonb:='[]'; used_targets text[]:='{}'; used_clues text[]:='{}';
 target_row record; pool record; holds text[]; stage int; attempt int; phrase_goal int;
 hits6 int; partials int; answer_count int; strong_decoys int; near_decoys int; distinct_patterns int; candidate_signature text; found_board boolean;
 prior jsonb; issued text[]; issued_by_player text[];
begin
 select coalesce(jsonb_agg(p),'[]') into prior from ascent_game.circuits c
 cross join lateral jsonb_array_elements(c.boards) p
 where c.route_id<>seed and (case when seed like 'daily:%' then c.route_id like 'daily:%' else
 exists(select 1 from ascent_game.runs r where r.ticket=player and c.route_id=case when r.scope like 'practice:%' or r.scope like 'superseded:%' then r.scope else 'daily:'||to_char(r.day,'YYYY-MM-DD') end) end);
 select coalesce(array_agg(ascent_game.pitch_signature(p)),'{}') into issued_by_player from jsonb_array_elements(prior)p;
 select coalesce(array_agg(ascent_game.pitch_signature(p)),'{}') into issued from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)p;
 for stage in 1..5 loop
  found_board:=false;
  phrase_goal:=2+case when mod(get_byte(decode(md5(seed),'hex'),0),2)=1 and stage=1+mod(get_byte(decode(md5(seed),'hex'),1),5) then 1 else 0 end;
  for target_row in
   with possible as (
    select t.target from ascent_game.ascent_target_clues t where (t.context_name='opening theme')=(stage=1) and t.target<>all(used_targets)
    group by t.target having count(distinct context_name)>=stage and count(distinct clue)>=6
   ), frequency as (
    select p->>'target' answer,count(*) uses from jsonb_array_elements(prior)p group by 1
   ), exposure as (
    select p->>'target' answer,count(*) uses from ascent_game.circuits c cross join lateral jsonb_array_elements(c.boards)p
    where (seed not like 'daily:%' or c.route_id like 'daily:%') group by 1
   )
   select x.target from possible x left join frequency f on f.answer=x.target left join exposure g on g.answer=x.target
   order by coalesce(f.uses,0),coalesce(g.uses,0),md5(seed||stage||x.target)
  loop
   select array_agg(t.clue order by t.clue) clues,array_agg(t.context_name order by t.clue) senses
   into pool from ascent_game.ascent_target_clues t
   where t.target=target_row.target and (t.context_name='opening theme')=(stage=1)
    and not ascent_game.is_displayed_clue(array[t.clue],t.target) and t.clue<>all(used_clues);
   for attempt in 1..40 loop
    with available as (
     select * from unnest(pool.clues,pool.senses) t(clue,sense)
    ), senses as (
     select sense from available group by sense order by md5(seed||stage||attempt||sense) limit stage
    ), sample as (
     select clue,sense,row_number() over(partition by (position(' ' in clue)>0) order by md5(seed||stage||attempt||clue)) rn
     from available join senses using(sense)
    )
    select array_agg(clue order by md5(seed||stage||'pos'||clue)) into holds from sample
    where rn<=case when position(' ' in clue)>0 then phrase_goal else 6-phrase_goal end
    having count(*)=6 and count(distinct sense)=stage;
    if holds is null then continue;end if;
    candidate_signature:=ascent_game.pitch_signature(jsonb_build_object('clues',holds));
    if candidate_signature=any(issued) or candidate_signature=any(issued_by_player) or exists(select 1 from ascent_game.published_pitches p where p.signature=candidate_signature) then continue;end if;
    select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 2 and 5),count(*) filter(where hits between 3 and 5),count(*) filter(where hits in (4,5)),count(distinct pattern) filter(where hits between 2 and 5)
     into answer_count,hits6,partials,strong_decoys,near_decoys,distinct_patterns from (
      select a.word,count(*) hits,array_agg(a.clue order by a.clue) pattern from ascent_game.association_scores_v7 a where a.clue=any(holds) and a.strength>=65 and a.word<>all(holds) group by a.word
     ) matches;
    if hits6 not between 1 and 2 or (stage>=2 and hits6<>1) or partials<5 or answer_count<75 or distinct_patterns<4 or (stage>=2 and strong_decoys<2) or (stage>=4 and (strong_decoys<3 or near_decoys<1)) or (select count(*) from jsonb_object_keys(ascent_game.match_guess(7,holds,target_row.target)))<>6 then continue;end if;
    pitches:=pitches||jsonb_build_array(jsonb_build_object('target',target_row.target,'clues',holds,'contexts',stage));
    used_targets:=array_append(used_targets,target_row.target);used_clues:=used_clues||holds;
    found_board:=true;exit;
   end loop;
   exit when found_board;
  end loop;
  if not found_board then return ascent_game.generate_varied_climb(seed,player);end if;
 end loop;
 return pitches;
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_request(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare resp extensions.http_response;token text;
begin
 select secret into token from ascent_game.semantic_config where singleton;
 perform set_config('http.curlopt_timeout_msec','1100',true);
 perform set_config('http.curlopt_connecttimeout_msec','500',true);
 select * into resp from extensions.http(('POST','https://mqozqigwkobnhijvvboy.supabase.co/functions/v1/ascent-reasoning',array[extensions.http_header('x-ascent-token',token)],'application/json',payload::text)::extensions.http_request);
 if resp.status=200 then return resp.content::jsonb;end if;
 return jsonb_build_object('error','reasoning unavailable','status',resp.status);
 exception when others then return jsonb_build_object('error','reasoning request failed','state',sqlstate);
end;$function$;

CREATE OR REPLACE FUNCTION ascent_game.llm_complete(clues text[], guess text, ticket uuid, known jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb:=known; missing text[]; reply jsonb; c text; explanation text; enabled_flag boolean; v extensions.vector(384);
begin
 select enabled into enabled_flag from ascent_game.llm_config where singleton;
 if not coalesce(enabled_flag,false) then return known;end if;
 if guess is null or length(guess)>100 or guess !~ '^[a-z0-9]+( [a-z0-9]+){0,9}$' or guess=any(clues) or guess ~ '^(not|unrelated|none|except|without)($| )' or guess ~ '(^| )(or|ignore previous|ignore instructions|system prompt|award points|accept all|match all|give me points|all six clues)( |$)' then return known;end if;
 -- Preserve all previously supported deterministic semantic matches.
 select embedding into v from ascent_game.semantic_word_vectors where word=guess;
 if v is null then select embedding into v from ascent_game.semantic_guess_cache where key=md5('gte-small-v1:'||guess) and created_at>now()-interval '14 days';end if;
 if v is not null then result:=result||ascent_game.vector_clue_matches(array(select x from unnest(clues) x where not result ? x),guess,v);end if;
 result:=ascent_game.llm_cached_matches(clues,guess,result);
 missing:=array(select x from unnest(clues) x where not result ? x and not exists(select 1 from ascent_game.llm_pair_cache k where k.guess=$2 and k.clue=x and k.version='llama70b-r3' and not k.accepted and k.created_at>now()-interval '1 day'));
 -- Known, cached and vector-backed matches are ready to score locally.
 if cardinality(missing)=0 or result<>'{}'::jsonb then return result;end if;
 -- Obvious keyboard noise cannot form a conventional relationship.
 if guess !~ '[aeiouy]' and length(guess)>=4 or guess ~ '([a-z])\1\1\1' then return result;end if;
 -- No player identifiers are forwarded to Cloudflare; the ticket is used internally for quota enforcement.
 reply:=ascent_game.llm_request(jsonb_build_object('ticket',ticket,'guess',guess,'clues',missing));
 if reply->>'version' is distinct from 'llama70b-r3' or jsonb_typeof(reply->'matches') is distinct from 'object' then
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
end;$function$;
