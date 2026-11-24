create table ascent_game.phrase_themes(target text primary key,alias text not null);
create table ascent_game.phrase_holds(clue text primary key,target text not null references ascent_game.phrase_themes(target));
alter table ascent_game.phrase_themes enable row level security;
alter table ascent_game.phrase_holds enable row level security;
insert into ascent_game.phrase_themes values
('airport','air travel'),
('astronomy','observational astronomy'),
('baking','home baking'),
('beekeeping','keeping bees'),
('camping','camping trip'),
('cartography','map making'),
('chess','chess game'),
('circus','circus performance'),
('cycling','bicycle riding'),
('gardening','tending a garden'),
('glacier','glacial ice'),
('library','library services'),
('orchestra','orchestral music'),
('paleontology','fossil hunting'),
('photography','taking photographs'),
('pottery','ceramic arts'),
('railroad','rail transport'),
('sailing','under sail'),
('sewing','garment making'),
('theater','stage production'),
('volcano','volcanic activity'),
('weaving','textile weaving');
insert into ascent_game.circuit_lexicon(edition,clue,links)
select 5,l.clue,l.links||coalesce((select jsonb_object_agg(t.alias,l.links->t.target) from ascent_game.phrase_themes t where l.links ? t.target and exists(select 1 from ascent_game.theme_catalog_v4 cat where cat.target=t.target and l.clue=any(cat.clues))),'{}')
from ascent_game.circuit_lexicon l where edition=4;
create temporary table new_holds on commit drop as select * from jsonb_to_recordset($holds$[{"target":"airport","clue":"luggage carousel","words":["airport","baggage","luggage","suitcase","arrival","conveyor belt","air travel"]},{"target":"airport","clue":"boarding pass","words":["airport","travel","passenger","gate","ticket","seat assignment","air travel"]},{"target":"airport","clue":"windsock on a pole","words":["airport","wind","pilot","runway","wind direction","air travel"]},{"target":"airport","clue":"departure board","words":["airport","flight","schedule","delay","terminal","gate number","air travel"]},{"target":"airport","clue":"tray of loose change","words":["airport","security","screening","coins","metal detector","air travel"]},{"target":"astronomy","clue":"rings of saturn","words":["astronomy","planet","telescope","orbit","space","gas giant","observational astronomy"]},{"target":"astronomy","clue":"red giant","words":["astronomy","star","stellar","evolution","stellar evolution","observational astronomy"]},{"target":"astronomy","clue":"spiral arms","words":["astronomy","galaxy","stars","space","milky way","observational astronomy"]},{"target":"astronomy","clue":"shadow on the moon","words":["astronomy","eclipse","earth","orbit","lunar eclipse","observational astronomy"]},{"target":"astronomy","clue":"light years","words":["astronomy","distance","space","stars","galaxy","deep space","observational astronomy"]},{"target":"baking","clue":"folded egg whites","words":["baking","meringue","batter","whisk","foam","sponge cake","home baking"]},{"target":"baking","clue":"dough doubled in size","words":["baking","yeast","fermentation","bread","proof","bread dough","home baking"]},{"target":"baking","clue":"greased tin","words":["baking","cake","oven","batter","butter","cake pan","home baking"]},{"target":"baking","clue":"floured worktop","words":["baking","dough","pastry","bread","rolling pin","home baking"]},{"target":"baking","clue":"wire cooling rack","words":["baking","bread","cake","cookies","oven","baked goods","home baking"]},{"target":"beekeeping","clue":"frame of capped cells","words":["beekeeping","hive","wax","honey","honey harvest","keeping bees"]},{"target":"beekeeping","clue":"white mesh hood","words":["beekeeping","veil","protection","swarm","bee suit","keeping bees"]},{"target":"beekeeping","clue":"jar of raw honey","words":["beekeeping","honey","nectar","harvest","honey production","keeping bees"]},{"target":"beekeeping","clue":"puffs of cool smoke","words":["beekeeping","smoker","hive","smoke","colony inspection","keeping bees"]},{"target":"beekeeping","clue":"returning pollen gatherers","words":["beekeeping","pollen","forager","flowers","nectar","worker bees","keeping bees"]},{"target":"camping","clue":"guy lines","words":["camping","shelter","tent","tarp","tent stakes","camping trip"]},{"target":"camping","clue":"rolled sleeping pad","words":["camping","sleep","insulation","backpack","sleeping bag","camping trip"]},{"target":"camping","clue":"ring of stones","words":["camping","campfire","firewood","embers","fire pit","camping trip"]},{"target":"camping","clue":"waterproof ground sheet","words":["camping","tent","shelter","tarp","damp ground","camping trip"]},{"target":"camping","clue":"folding camp stove","words":["camping","fuel","cooking","flame","outdoor cooking","camping trip"]},{"target":"cartography","clue":"contour intervals","words":["cartography","elevation","terrain","height","contour lines","map making"]},{"target":"cartography","clue":"north arrow","words":["cartography","direction","compass","orientation","true north","map making"]},{"target":"cartography","clue":"scale bar","words":["cartography","distance","measurement","map scale","map making"]},{"target":"cartography","clue":"dashed boundary","words":["cartography","border","territory","map legend","map making"]},{"target":"cartography","clue":"lines of latitude","words":["cartography","globe","equator","coordinates","north pole","map making"]},{"target":"chess","clue":"forked king and rook","words":["chess","knight","attack","tactic","double attack","chess game"]},{"target":"chess","clue":"back rank","words":["chess","king","rook","mate","back","back rank mate","chess game"]},{"target":"chess","clue":"fallen flag","words":["chess","clock","time","tournament","time control","chess game"]},{"target":"chess","clue":"passed pawn","words":["chess","promotion","endgame","board","pawn structure","chess game"]},{"target":"chess","clue":"queenside castle","words":["chess","king","rook","safety","king safety","chess game"]},{"target":"circus","clue":"sawdust ring","words":["circus","arena","performance","circus ring","circus performance"]},{"target":"circus","clue":"suspended safety net","words":["circus","acrobat","trapeze","fall","high wire","circus performance"]},{"target":"circus","clue":"painted smile","words":["circus","clown","makeup","costume","stage makeup","circus performance"]},{"target":"circus","clue":"three spinning clubs","words":["circus","juggler","balance","timing","juggling act","circus performance"]},{"target":"circus","clue":"striped big top","words":["circus","tent","audience","performance","tent poles","circus performance"]},{"target":"cycling","clue":"clipless pedals","words":["cycling","shoe","cleat","crank","pedal stroke","bicycle riding"]},{"target":"cycling","clue":"flat inner tube","words":["cycling","wheel","tire","pump","puncture repair","bicycle riding"]},{"target":"cycling","clue":"bunch sprint","words":["cycling","race","peloton","finish","finish line","bicycle riding"]},{"target":"cycling","clue":"chain grease","words":["cycling","chain","gear","maintenance","drive train","bicycle riding"]},{"target":"cycling","clue":"banked wooden track","words":["cycling","velodrome","race","speed","track racing","bicycle riding"]},{"target":"gardening","clue":"tray of seedlings","words":["gardening","seed","greenhouse","transplant","potting soil","tending a garden"]},{"target":"gardening","clue":"turned compost heap","words":["gardening","compost","decay","soil","organic matter","tending a garden"]},{"target":"gardening","clue":"drip line","words":["gardening","water","irrigation","roots","water supply","tending a garden"]},{"target":"gardening","clue":"stakes and twine","words":["gardening","vine","support","tomato","climbing plant","tending a garden"]},{"target":"gardening","clue":"bed of mulch","words":["gardening","soil","moisture","weeds","wood chips","tending a garden"]},{"target":"glacier","clue":"blue ice wall","words":["glacier","ice","crevasse","cold","compressed snow","glacial ice"]},{"target":"glacier","clue":"glacial flour","words":["glacier","sediment","erosion","meltwater","rock dust","glacial ice"]},{"target":"glacier","clue":"stranded boulder","words":["glacier","rock","transport","moraine","ice age","glacial ice"]},{"target":"glacier","clue":"stream of meltwater","words":["glacier","water","runoff","summer","melting ice","glacial ice"]},{"target":"glacier","clue":"u shaped valley","words":["glacier","erosion","ice","mountains","moving ice","glacial ice"]},{"target":"library","clue":"date due slip","words":["library","loan","return","borrower","circulation desk","library services"]},{"target":"library","clue":"call number","words":["library","catalog","shelf","classification","book spine","library services"]},{"target":"library","clue":"quiet reading room","words":["library","books","study","reference","public library","library services"]},{"target":"library","clue":"interlibrary loan","words":["library","borrower","request","books","lending library","library services"]},{"target":"library","clue":"bound back issues","words":["library","periodical","journal","archive","magazine collection","library services"]},{"target":"orchestra","clue":"raised baton","words":["orchestra","conductor","tempo","musical cue","orchestral music"]},{"target":"orchestra","clue":"tuning note","words":["orchestra","oboe","pitch","strings","concert pitch","orchestral music"]},{"target":"orchestra","clue":"sheet music","words":["orchestra","score","notes","conductor","music stand","orchestral music"]},{"target":"orchestra","clue":"bowed strings","words":["orchestra","violin","cello","viola","string section","orchestral music"]},{"target":"orchestra","clue":"kettle drums","words":["orchestra","timpani","percussion","mallets","percussion section","orchestral music"]},{"target":"paleontology","clue":"plaster field jacket","words":["paleontology","fossil","transport","specimen","field work","fossil hunting"]},{"target":"paleontology","clue":"petrified wood","words":["paleontology","fossil","plant","minerals","ancient forest","fossil hunting"]},{"target":"paleontology","clue":"track in stone","words":["paleontology","imprint","footprint","dinosaur","trace fossil","fossil hunting"]},{"target":"paleontology","clue":"fossil bed","words":["paleontology","sediment","quarry","excavation","sedimentary rock","fossil hunting"]},{"target":"paleontology","clue":"curled ammonite shell","words":["paleontology","ammonite","fossil","ocean","marine life","fossil hunting"]},{"target":"photography","clue":"contact sheet","words":["photography","negative","film","exposure","dark room","taking photographs"]},{"target":"photography","clue":"slow shutter speed","words":["photography","exposure","motion","tripod","motion blur","taking photographs"]},{"target":"photography","clue":"wide open aperture","words":["photography","lens","light","focus","shallow focus","taking photographs"]},{"target":"photography","clue":"roll of film","words":["photography","negative","exposure","camera","dark room","taking photographs"]},{"target":"photography","clue":"catchlight in the eye","words":["photography","portrait","flash","light","studio lighting","taking photographs"]},{"target":"pottery","clue":"foot ring","words":["pottery","bowl","clay","trimming","potters wheel","ceramic arts"]},{"target":"pottery","clue":"glaze test tile","words":["pottery","color","firing","kiln","ceramic glaze","ceramic arts"]},{"target":"pottery","clue":"leather hard clay","words":["pottery","clay","carving","handle","drying clay","ceramic arts"]},{"target":"pottery","clue":"potters wheel","words":["pottery","clay","bowl","throwing","wet clay","ceramic arts"]},{"target":"pottery","clue":"kiln shelf","words":["pottery","firing","glaze","heat","ceramic firing","ceramic arts"]},{"target":"railroad","clue":"points lever","words":["railroad","switch","junction","track","signal box","rail transport"]},{"target":"railroad","clue":"departure whistle","words":["railroad","platform","conductor","train","passenger train","rail transport"]},{"target":"railroad","clue":"wooden sleepers","words":["railroad","rail","ballast","track","railway line","rail transport"]},{"target":"railroad","clue":"level crossing","words":["railroad","barrier","signal","road","crossing gate","rail transport"]},{"target":"railroad","clue":"dining car","words":["railroad","passenger","travel","carriage","passenger train","rail transport"]},{"target":"sailing","clue":"coiled mooring line","words":["sailing","rope","dock","marina","bow line","under sail"]},{"target":"sailing","clue":"telltales on the jib","words":["sailing","wind","trim","sail","wind direction","under sail"]},{"target":"sailing","clue":"wake behind the stern","words":["sailing","water","speed","rudder","boat speed","under sail"]},{"target":"sailing","clue":"spinnaker pole","words":["sailing","sail","wind","mast","downwind sailing","under sail"]},{"target":"sailing","clue":"anchor chain","words":["sailing","anchor","seabed","bow","holding ground","under sail"]},{"target":"sewing","clue":"paper pattern","words":["sewing","cutting","fabric","tailor","seam allowance","garment making"]},{"target":"sewing","clue":"pinking shears","words":["sewing","scissors","fabric","edge","cut edge","garment making"]},{"target":"sewing","clue":"pressed seam","words":["sewing","iron","garment","stitch","seam allowance","garment making"]},{"target":"sewing","clue":"buttonhole stitch","words":["sewing","button","thread","needle","hand sewing","garment making"]},{"target":"sewing","clue":"threaded bobbin","words":["sewing","thread","stitch","spool","sewing machine","garment making"]},{"target":"theater","clue":"curtain call","words":["theater","applause","cast","stage","final bow","stage production"]},{"target":"theater","clue":"dog eared script","words":["theater","rehearsal","dialogue","cast","stage directions","stage production"]},{"target":"theater","clue":"spike tape","words":["theater","mark","scenery","stage","set change","stage production"]},{"target":"theater","clue":"empty prompt chair","words":["theater","rehearsal","script","cue","missed line","stage production"]},{"target":"theater","clue":"costume change","words":["theater","wings","cast","wardrobe","dressing room","stage production"]},{"target":"volcano","clue":"river of lava","words":["volcano","heat","eruption","basalt","molten rock","volcanic activity"]},{"target":"volcano","clue":"column of ash","words":["volcano","plume","eruption","sky","volcanic ash","volcanic activity"]},{"target":"volcano","clue":"steaming fissure","words":["volcano","vent","gas","heat","water vapor","volcanic activity"]},{"target":"volcano","clue":"collapsed summit","words":["volcano","caldera","crater","eruption","magma chamber","volcanic activity"]},{"target":"volcano","clue":"black glass fragments","words":["volcano","obsidian","lava","cooling","molten rock","volcanic activity"]},{"target":"weaving","clue":"warp threads","words":["weaving","loom","tension","yarn","warp beam","textile weaving"]},{"target":"weaving","clue":"flying shuttle","words":["weaving","weft","loom","yarn","loom shuttle","textile weaving"]},{"target":"weaving","clue":"woven border","words":["weaving","selvage","fringe","cloth","fabric edge","textile weaving"]},{"target":"weaving","clue":"raised heddles","words":["weaving","warp","loom","shed","warp threads","textile weaving"]},{"target":"weaving","clue":"tapestry on a loom","words":["weaving","yarn","pattern","textile","woven cloth","textile weaving"]}]$holds$::jsonb) as p(target text,clue text,words jsonb);
insert into ascent_game.phrase_holds select clue,target from new_holds;
insert into ascent_game.circuit_lexicon(edition,clue,links)
select 5,clue,jsonb_object_agg(word,clue||' · '||word) from new_holds cross join lateral jsonb_array_elements_text(words) word group by clue;
CREATE OR REPLACE FUNCTION ascent_game.generate_theme_climb(seed text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare theme record; holds text[]; pitches jsonb:='[]'; candidate_signature text; signatures text[]:='{}'; candidate int; bank_size int; perfect int; partials int; strong int; tiers int; best_tiers int; best_pitch jsonb; best_signature text; qualified int;
 phrase_count int;
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
   select count(*),count(*) filter(where hits=6),count(*) filter(where hits between 3 and 5),count(*) filter(where hits in (4,5)),count(distinct hits)
   into bank_size,perfect,partials,strong,tiers from (
    select word,count(*) hits from ascent_game.circuit_lexicon l cross join lateral jsonb_object_keys(l.links) word
    where l.edition=5 and l.clue=any(holds) and word<>all(holds) group by word
   ) matches;
   if bank_size<100 or perfect not between 1 and 2 or partials<6 or strong<2 then continue;end if;
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
 if p_ticket is null or p_action is null or p_action not in ('read','start','guess') then raise exception 'Invalid request'; end if;
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
    pitches:=ascent_game.generate_theme_climb(route_key);dictionary_version:=5;
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
   if not expired and length(answer)<=48 and answer ~ '^[a-z]+( [a-z]+){0,5}$' and answer<>all(b.clues) then
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