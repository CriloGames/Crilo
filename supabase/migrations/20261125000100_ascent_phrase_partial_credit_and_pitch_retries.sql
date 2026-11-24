insert into ascent_game.circuit_lexicon(edition,clue,links)
select 6,old.clue,old.links||coalesce(extra.links,'{}'::jsonb)
from ascent_game.circuit_lexicon old
left join (
 select clue,jsonb_object_agg(a.word,a.why) links
 from jsonb_to_recordset($phrases$[{"word":"baggage claim","clues":["arrival","baggage","terminal","luggage carousel"],"why":"Arriving passengers collect checked bags at the carousel in the terminal."},{"word":"air traffic control","clues":["tower","runway","landing","taxiway","departure"],"why":"Controllers coordinate movements on the ground and clear aircraft to take off or land."},{"word":"deep space","clues":["galaxy","nebula","pulsar","supernova","light years","spiral arms"],"why":"These objects lie far beyond our solar system."},{"word":"orbital motion","clues":["orbit","transit","eclipse","shadow on the moon","rings of saturn"],"why":"An orbit changes the apparent positions of planets, moons and smaller bodies."},{"word":"bread dough","clues":["yeast","knead","proof","sourdough","flour","floured worktop","dough doubled in size"],"why":"Yeast raises the dough, and kneading develops its structure before it proofs."},{"word":"cake decorating","clues":["icing","glaze","pastry","wire cooling rack"],"why":"A cooled baked surface can take an even layer of icing or glaze."},{"word":"honey harvest","clues":["extractor","comb","wax","frame of capped cells","jar of raw honey"],"why":"The wax caps are removed so an extractor can spin honey from the comb."},{"word":"hive inspection","clues":["smoker","veil","brood","queen","white mesh hood","puffs of cool smoke"],"why":"A beekeeper opens the colony to check brood and look for the queen."},{"word":"campfire cooking","clues":["firewood","kindling","tinder","ring of stones"],"why":"Dry tinder and kindling start the fire that heats a camp meal."},{"word":"sleeping outdoors","clues":["bedroll","bivouac","hammock","tent","rolled sleeping pad","waterproof ground sheet"],"why":"These give a camper shelter, support or insulation overnight."},{"word":"map reading","clues":["legend","scale","contour","grid","north arrow","scale bar","dashed boundary"],"why":"These markings let a reader interpret direction, distances and features."},{"word":"survey work","clues":["elevation","coordinate","boundary","terrain","lines of latitude"],"why":"Surveyors establish positions, boundaries and heights on the ground."},{"word":"king safety","clues":["castling","checkmate","king","back rank","queenside castle"],"why":"Sheltering the king and leaving escape squares can prevent mate."},{"word":"time pressure","clues":["clock","tournament","endgame","fallen flag"],"why":"A player must finish the moves before the clock runs out."},{"word":"aerial act","clues":["acrobat","trapeze","tightrope","balance","suspended safety net"],"why":"Performers work high above the ring, where balance and a safety net matter."},{"word":"clown act","clues":["clown","costume","unicycle","painted smile","three spinning clubs"],"why":"A clown may use face paint, juggling and a one-wheeled cycle in the ring."},{"word":"bicycle repair","clues":["tire","spoke","chain","derailleur","brake","flat inner tube","chain grease"],"why":"A mechanic repairs punctures, adjusts gears and services the chain and brakes."},{"word":"road race","clues":["peloton","sprint","cadence","jersey","bunch sprint","clipless pedals"],"why":"Riders manage their pedaling pace in a pack before the sprint finish."},{"word":"soil care","clues":["compost","mulch","fertilizer","soil","turned compost heap","bed of mulch"],"why":"Organic matter and mulch nourish soil and help it hold water."},{"word":"young plants","clues":["seedling","transplant","root","greenhouse","tray of seedlings","stakes and twine"],"why":"New plants need space for roots and sometimes shelter or support."},{"word":"glacial erosion","clues":["valley","erosion","moraine","boulder","glacial flour","u shaped valley"],"why":"Moving ice carves valleys and carries away material from rock flour to boulders."},{"word":"melting ice","clues":["meltwater","retreat","runoff","terminus","stream of meltwater"],"why":"Melting feeds runoff and can cause the end of a glacier to retreat."},{"word":"book lending","clues":["loan","borrower","checkout","librarian","date due slip","interlibrary loan"],"why":"A borrower checks out a book through the library and returns it by its due date."},{"word":"finding a book","clues":["catalog","index","shelf","reference","call number"],"why":"A catalog entry or index points the reader toward a particular book or subject."},{"word":"string section","clues":["violin","viola","cello","harp","bowed strings","tuning note"],"why":"These string players tune their instruments before the performance."},{"word":"rehearsal cue","clues":["baton","conductor","score","raised baton","sheet music"],"why":"The conductor follows the score and signals when players should enter."},{"word":"fossil excavation","clues":["quarry","excavation","specimen","bone","fossil bed","plaster field jacket"],"why":"Field crews expose and protect remains before removing them from a fossil bed."},{"word":"trace fossil","clues":["imprint","sediment","track in stone","fossil bed"],"why":"A mark in sediment can preserve evidence of an animal’s movement."},{"word":"long exposure","clues":["exposure","shutter","tripod","slow shutter speed","aperture"],"why":"A long shutter opening admits light over time, often with the camera on a tripod."},{"word":"film development","clues":["film","negative","darkroom","contact sheet","roll of film"],"why":"Exposed film becomes a negative that can be printed onto a contact sheet."},{"word":"wheel throwing","clues":["wheel","clay","bowl","vessel","foot ring","potters wheel"],"why":"A potter centers clay on the wheel and shapes the spinning vessel."},{"word":"kiln firing","clues":["kiln","firing","stoneware","porcelain","glaze test tile","kiln shelf"],"why":"Controlled heat hardens ceramic bodies and melts glaze on the shelf."},{"word":"passenger service","clues":["platform","timetable","conductor","sleeper","dining car","departure whistle"],"why":"Passengers consult a timetable, board from a platform and use the train’s facilities."},{"word":"track switching","clues":["switch","junction","siding","signal","points lever"],"why":"Points direct a train onto another track, often under signal control."},{"word":"sail trim","clues":["jib","tack","boom","spinnaker","telltales on the jib","spinnaker pole"],"why":"The crew adjusts the sail’s angle and shape to the wind."},{"word":"tying up","clues":["knot","marina","bow","stern","coiled mooring line"],"why":"Bow and stern lines secure a boat alongside a dock."},{"word":"pattern cutting","clues":["pattern","scissors","fabric","paper pattern","pinking shears"],"why":"A pattern guides the shape cut from fabric."},{"word":"machine stitching","clues":["bobbin","needle","spool","seam","threaded bobbin","pressed seam"],"why":"Upper and bobbin threads interlock to form a stitched seam."},{"word":"stage rehearsal","clues":["understudy","cast","script","monologue","rehearsal","spike tape","dog eared script"],"why":"Actors practice lines and learn where to stand before the performance."},{"word":"backstage crew","clues":["wings","curtain","scenery","prop","costume change","spike tape"],"why":"The crew works in the wings to prepare scenery, props and quick changes."},{"word":"molten rock","clues":["magma","lava","basalt","obsidian","river of lava","black glass fragments"],"why":"Magma becomes lava at the surface and cools into igneous rock."},{"word":"volcanic plume","clues":["ash","plume","eruption","vent","column of ash","steaming fissure"],"why":"Ash or volcanic gases rise above a vent."},{"word":"loom setup","clues":["loom","warp","heddle","tension","warp threads","raised heddles"],"why":"The weaver threads the heddles and tensions the warp before weaving."},{"word":"weft insertion","clues":["weft","shuttle","loom","heddle","flying shuttle","raised heddles"],"why":"The shuttle carries weft through the gap opened by the heddles."}]$phrases$::jsonb) as a(word text,clues text[],why text)
 cross join lateral unnest(a.clues) clue group by clue
) extra on extra.clue=old.clue where old.edition=5;
create function ascent_game.match_guess(dictionary_version int,clues text[],answer text) returns jsonb language plpgsql stable set search_path='' as $match$
declare candidates text[];canonical text;links jsonb:='{}';
begin
   if length(answer)<=48 and answer ~ '^[a-z]+( [a-z]+){0,5}$' and answer<>all(clues) then
    -- Prefer the exact word. Accept common plural endings when their singular connects.
    candidates:=array[answer];
    if length(answer)>3 and right(answer,3)='ies' then candidates:=array_append(candidates,left(answer,-3)||'y'); end if;
    if answer ~ '(ch|sh|s|x|z)es$' then candidates:=array_append(candidates,left(answer,-2)); end if;
    if length(answer)>2 and right(answer,1)='s' and right(answer,2)<>'ss' then candidates:=array_append(candidates,left(answer,-1)); end if;
    foreach canonical in array candidates loop
      if canonical=any(clues) then continue; end if;
      select coalesce(jsonb_object_agg(l.clue,l.links->canonical),'{}') into links
      from ascent_game.circuit_lexicon l where l.edition=dictionary_version and l.clue=any(clues) and l.links ? canonical;
      exit when links<>'{}'::jsonb;
    end loop;
   end if;

 return links;
end;$match$;
CREATE OR REPLACE FUNCTION ascent_game.generate_theme_climb(seed text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare theme record; holds text[]; pitches jsonb:='[]'; candidate_signature text; signatures text[]:='{}'; candidate int; bank_size int; perfect int; partials int; strong int; tiers int; best_tiers int; best_pitch jsonb; best_signature text; qualified int;
 phrase_count int; phrase_paths int;
begin
 for theme in select * from ascent_game.theme_catalog_v4 order by md5(seed||target),target loop
  best_tiers:=-1; best_pitch:=null; qualified:=0;
  phrase_count:=2+case when jsonb_array_length(pitches)=mod(get_byte(decode(md5(seed),'hex'),1),5)
   and mod(get_byte(decode(md5(seed),'hex'),0),2)=1 then 1 else 0 end;
  for candidate in 1..100 loop
   holds:=array(select clue from (
    (select c clue from unnest(theme.clues) c order by md5(seed||theme.target||candidate||c),c limit (6-phrase_count))
    union all
    (select p.clue from ascent_game.phrase_holds p where p.target=theme.target order by md5(seed||candidate||p.clue),p.clue limit phrase_count)
   ) chosen order by md5(seed||candidate||'position'||clue),clue);
   candidate_signature:=ascent_game.pitch_signature(jsonb_build_object('clues',holds));
   if candidate_signature=any(signatures) or (seed like 'daily:%' and exists (
     select 1 from ascent_game.published_pitches p where p.signature=candidate_signature
   )) then continue;end if;
   if exists(select 1 from jsonb_array_elements(pitches) prev where (select count(*) from jsonb_array_elements_text(prev->'clues') clue where clue=any(holds))>1) then continue;end if;
   select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 3 and 5),count(*) filter(where hits in (4,5)),count(distinct hits),count(*) filter(where hits between 2 and 5 and word like '% %')
   into bank_size,perfect,partials,strong,tiers,phrase_paths from (
    select word,count(*) hits from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) word
    where l.edition=6 and l.clue=any(holds) and word<>all(holds) group by word
   ) matches;
   if bank_size<100 or perfect not between 1 and 2 or partials<6 or strong<2 or phrase_paths<2 then continue;end if;
   qualified:=qualified+1;
   if tiers>best_tiers then
    best_tiers:=tiers;
    best_pitch:=jsonb_build_object('target',case when mod(jsonb_array_length(pitches)+get_byte(decode(md5(seed),'hex'),2),5)<1+case when mod(get_byte(decode(md5(seed),'hex'),3),4)>0 then 1 else 0 end then (select alias from ascent_game.phrase_themes where target=theme.target) else theme.target end,'clues',holds,'partial_paths',partials,'strong_paths',strong);
    best_signature:=candidate_signature;
   end if;
   exit when tiers=6 or qualified>=8;
  end loop;
  if best_pitch is not null then
   pitches:=pitches||jsonb_build_array(best_pitch);
   signatures:=array_append(signatures,best_signature);
  end if;
  if jsonb_array_length(pitches)=5 then
   return (select jsonb_agg(p-'partial_paths'-'strong_paths' order by (p->>'strong_paths')::int desc,(p->>'partial_paths')::int desc,i) from jsonb_array_elements(pitches) with ordinality e(p,i));
  end if;
 end loop;
 raise exception 'Could not find five unused semantic pitches';
end;$function$
;
CREATE OR REPLACE FUNCTION public.ascent_circuit(p_ticket uuid, p_action text DEFAULT 'read'::text, p_day date DEFAULT NULL::date, p_round integer DEFAULT NULL::integer, p_guess text DEFAULT NULL::text, p_archive date DEFAULT NULL::date, p_seed uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 received timestamptz:=statement_timestamp();
 d date:=(received at time zone 'America/Los_Angeles')::date;
 local_today date:=d;
 run_scope text:='daily';
 route_key text;
 pitches jsonb;
 dictionary_version int:=4;
 h jsonb; total_points integer; until_at timestamptz; ix integer;
 b ascent_game.boards%rowtype; answer text; canonical text; candidates text[]; links jsonb:='{}'; solution jsonb;
 hits integer; pairs integer; points integer; expired boolean; rejected boolean:=false; crowd jsonb;
begin
 if p_archive is not null and (p_seed is not null or p_archive<date '2026-11-24' or p_archive>=local_today) then
  raise exception 'Only past published climbs can be replayed'; end if;
 if p_archive is not null then d:=p_archive;run_scope:='replay';end if;
 if p_seed is not null then d:=date '2026-11-24';run_scope:='practice:'||p_seed;end if;
 route_key:=case when p_seed is null then 'daily:'||to_char(d,'YYYY-MM-DD') else run_scope end;
 if p_ticket is null or p_action is null or p_action not in ('read','start','guess','retry_pitch') then raise exception 'Invalid request'; end if;
 if p_action='retry_pitch' then
   select r.history->(p_round-1),c.lex_version into h,dictionary_version
   from ascent_game.runs r join ascent_game.circuits c on c.route_id=route_key
   where r.day=d and r.scope=run_scope and r.ticket=p_ticket and p_day=d
     and p_round between 1 and jsonb_array_length(r.history);
   if h is null then raise exception 'Finish this pitch first';end if;
   b.clues:=array(select jsonb_array_elements_text(h->'clues'));
   answer:=lower(btrim(regexp_replace(coalesce(p_guess,''),'[[:space:]]+',' ','g')));
   links:=ascent_game.match_guess(dictionary_version,b.clues,answer);
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;

   return jsonb_build_object('links',links,'points',points,'rejected',hits=0);
 end if;
 if p_action='start' and p_day=d and p_round=1 then
  insert into ascent_game.runs(day,ticket,scope) values(d,p_ticket,run_scope) on conflict do nothing;
 end if;
 select history,total,deadline into h,total_points,until_at from ascent_game.runs where day=d and ticket=p_ticket and scope=run_scope for update;
 h:=coalesce(h,'[]'); total_points:=coalesce(total_points,0); ix:=jsonb_array_length(h)+1;
 select coalesce((select lex_version from ascent_game.circuits where route_id=route_key),4) into dictionary_version;
 if ix<=5 then
  if until_at is not null or (p_action='start' and p_day=d and p_round=ix) then
   select c.boards,c.lex_version into pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key;
   if pitches is null then
    pitches:=ascent_game.generate_theme_climb(route_key);dictionary_version:=6;
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
   answer:=lower(btrim(regexp_replace(coalesce(p_guess,''),'[[:space:]]+',' ','g')));
   if not expired then links:=ascent_game.match_guess(dictionary_version,b.clues,answer);end if;
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
  select lex_version into dictionary_version from ascent_game.circuits where route_id=route_key;
  if p_seed is not null then
   return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',dictionary_version>=3,'results',jsonb_build_object('score',total_points,'average',null,'players',0));
  end if;
  select jsonb_build_object('average',round(avg(total)),'players',count(*)) into crowd from ascent_game.runs
  where day=d and scope='daily' and (jsonb_array_length(history)=5 or (jsonb_array_length(history)=4 and deadline<=received));
  return jsonb_build_object('day',d,'history',h,'results',crowd||jsonb_build_object('score',total_points));
 end if;
 return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',coalesce(dictionary_version>=3,true),'deadline',until_at,'serverTime',clock_timestamp(),'clues',case when until_at is not null then b.clues end,'rejected',rejected);
end;
$function$
;