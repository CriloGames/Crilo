create temporary table phrase_route_sources on commit drop as select * from jsonb_to_recordset($items$[{"target":"chain reaction","sense":"chemistry","clue":"neutron","reason":"One fission event can release neutrons that trigger further events."},{"target":"chain reaction","sense":"chemistry","clue":"reactor","reason":"One fission event can release neutrons that trigger further events."},{"target":"chain reaction","sense":"chemistry","clue":"nuclear fission","reason":"One fission event can release neutrons that trigger further events."},{"target":"chain reaction","sense":"mechanics","clue":"dominoes","reason":"One moving object sets the next in motion."},{"target":"chain reaction","sense":"mechanics","clue":"mousetrap","reason":"One moving object sets the next in motion."},{"target":"chain reaction","sense":"mechanics","clue":"falling tiles","reason":"One moving object sets the next in motion."},{"target":"chain reaction","sense":"everyday consequences","clue":"gridlock","reason":"A single disruption can set off a succession of further problems."},{"target":"chain reaction","sense":"everyday consequences","clue":"shortage","reason":"A single disruption can set off a succession of further problems."},{"target":"chain reaction","sense":"everyday consequences","clue":"traffic pileup","reason":"A single disruption can set off a succession of further problems."},{"target":"blind spot","sense":"vision","clue":"retina","reason":"The optic nerve leaves a small region of the retina without receptors."},{"target":"blind spot","sense":"vision","clue":"optic nerve","reason":"The optic nerve leaves a small region of the retina without receptors."},{"target":"blind spot","sense":"vision","clue":"eye exam","reason":"The optic nerve leaves a small region of the retina without receptors."},{"target":"blind spot","sense":"driving","clue":"mirror","reason":"A cyclist can disappear from a driver's mirrors alongside the vehicle."},{"target":"blind spot","sense":"driving","clue":"cyclist","reason":"A cyclist can disappear from a driver's mirrors alongside the vehicle."},{"target":"blind spot","sense":"driving","clue":"shoulder check","reason":"A cyclist can disappear from a driver's mirrors alongside the vehicle."},{"target":"blind spot","sense":"judgment","clue":"bias","reason":"An assumption can hide a weakness in someone's reasoning."},{"target":"blind spot","sense":"judgment","clue":"oversight","reason":"An assumption can hide a weakness in someone's reasoning."},{"target":"blind spot","sense":"judgment","clue":"missed detail","reason":"An assumption can hide a weakness in someone's reasoning."},{"target":"turning point","sense":"stories","clue":"climax","reason":"A pivotal event sends the story in a new direction."},{"target":"turning point","sense":"stories","clue":"revelation","reason":"A pivotal event sends the story in a new direction."},{"target":"turning point","sense":"stories","clue":"plot twist","reason":"A pivotal event sends the story in a new direction."},{"target":"turning point","sense":"sport","clue":"comeback","reason":"A single play can change the course of a contest."},{"target":"turning point","sense":"sport","clue":"interception","reason":"A single play can change the course of a contest."},{"target":"turning point","sense":"sport","clue":"match point","reason":"A single play can change the course of a contest."},{"target":"turning point","sense":"history","clue":"revolution","reason":"One event can mark a lasting change in history."},{"target":"turning point","sense":"history","clue":"treaty","reason":"One event can mark a lasting change in history."},{"target":"turning point","sense":"history","clue":"decisive battle","reason":"One event can mark a lasting change in history."},{"target":"common ground","sense":"negotiation","clue":"compromise","reason":"Negotiators start with an interest both sides share."},{"target":"common ground","sense":"negotiation","clue":"truce","reason":"Negotiators start with an interest both sides share."},{"target":"common ground","sense":"negotiation","clue":"shared interest","reason":"Negotiators start with an interest both sides share."},{"target":"common ground","sense":"land","clue":"pasture","reason":"Residents can share use of a common piece of land."},{"target":"common ground","sense":"land","clue":"commons","reason":"Residents can share use of a common piece of land."},{"target":"common ground","sense":"land","clue":"village green","reason":"Residents can share use of a common piece of land."},{"target":"common ground","sense":"electricity","clue":"circuit","reason":"Connected components can share one electrical reference point."},{"target":"common ground","sense":"electricity","clue":"terminal","reason":"Connected components can share one electrical reference point."},{"target":"common ground","sense":"electricity","clue":"reference voltage","reason":"Connected components can share one electrical reference point."},{"target":"feedback loop","sense":"audio","clue":"microphone","reason":"A microphone can pick up its own amplified sound and feed it back."},{"target":"feedback loop","sense":"audio","clue":"speaker","reason":"A microphone can pick up its own amplified sound and feed it back."},{"target":"feedback loop","sense":"audio","clue":"stage monitor","reason":"A microphone can pick up its own amplified sound and feed it back."},{"target":"feedback loop","sense":"control","clue":"thermostat","reason":"The measured output guides the next adjustment."},{"target":"feedback loop","sense":"control","clue":"sensor","reason":"The measured output guides the next adjustment."},{"target":"feedback loop","sense":"control","clue":"cruise control","reason":"The measured output guides the next adjustment."},{"target":"feedback loop","sense":"biology","clue":"hormone","reason":"Changes in the body signal a response that changes the measured level."},{"target":"feedback loop","sense":"biology","clue":"insulin","reason":"Changes in the body signal a response that changes the measured level."},{"target":"feedback loop","sense":"biology","clue":"blood sugar","reason":"Changes in the body signal a response that changes the measured level."},{"target":"first impression","sense":"social","clue":"handshake","reason":"An initial meeting shapes how someone is perceived."},{"target":"first impression","sense":"social","clue":"introduction","reason":"An initial meeting shapes how someone is perceived."},{"target":"first impression","sense":"social","clue":"job interview","reason":"An initial meeting shapes how someone is perceived."},{"target":"first impression","sense":"printing","clue":"proof","reason":"An impression is a print made from a prepared surface or type."},{"target":"first impression","sense":"printing","clue":"ink","reason":"An impression is a print made from a prepared surface or type."},{"target":"first impression","sense":"printing","clue":"first edition","reason":"An impression is a print made from a prepared surface or type."},{"target":"first impression","sense":"perception","clue":"glimpse","reason":"An early sight or phrase can shape an initial judgment."},{"target":"first impression","sense":"perception","clue":"silhouette","reason":"An early sight or phrase can shape an initial judgment."},{"target":"first impression","sense":"perception","clue":"opening line","reason":"An early sight or phrase can shape an initial judgment."},{"target":"pressure point","sense":"body","clue":"thumb","reason":"Pressure applied at a small site can produce a focused physical response."},{"target":"pressure point","sense":"body","clue":"nerve","reason":"Pressure applied at a small site can produce a focused physical response."},{"target":"pressure point","sense":"body","clue":"massage therapist","reason":"Pressure applied at a small site can produce a focused physical response."},{"target":"pressure point","sense":"negotiation","clue":"leverage","reason":"A negotiator looks for a vulnerability that can influence the outcome."},{"target":"pressure point","sense":"negotiation","clue":"deadline","reason":"A negotiator looks for a vulnerability that can influence the outcome."},{"target":"pressure point","sense":"negotiation","clue":"bargaining chip","reason":"A negotiator looks for a vulnerability that can influence the outcome."},{"target":"pressure point","sense":"mechanics","clue":"dent","reason":"A concentrated force puts pressure on a particular point of contact."},{"target":"pressure point","sense":"mechanics","clue":"contact patch","reason":"A concentrated force puts pressure on a particular point of contact."},{"target":"pressure point","sense":"mechanics","clue":"load bearing surface","reason":"A concentrated force puts pressure on a particular point of contact."},{"target":"balance sheet","sense":"assets","clue":"inventory","reason":"Resources owned by a business appear as assets."},{"target":"balance sheet","sense":"assets","clue":"cash","reason":"Resources owned by a business appear as assets."},{"target":"balance sheet","sense":"assets","clue":"accounts receivable","reason":"Resources owned by a business appear as assets."},{"target":"balance sheet","sense":"liabilities","clue":"loan","reason":"Obligations owed appear on the liabilities side."},{"target":"balance sheet","sense":"liabilities","clue":"mortgage","reason":"Obligations owed appear on the liabilities side."},{"target":"balance sheet","sense":"liabilities","clue":"accounts payable","reason":"Obligations owed appear on the liabilities side."},{"target":"balance sheet","sense":"equity","clue":"shares","reason":"Equity records the owners' residual interest."},{"target":"balance sheet","sense":"equity","clue":"capital","reason":"Equity records the owners' residual interest."},{"target":"balance sheet","sense":"equity","clue":"retained earnings","reason":"Equity records the owners' residual interest."},{"target":"supply chain","sense":"inputs","clue":"mine","reason":"Materials begin their path at sources such as farms or mines."},{"target":"supply chain","sense":"inputs","clue":"farm","reason":"Materials begin their path at sources such as farms or mines."},{"target":"supply chain","sense":"inputs","clue":"raw materials","reason":"Materials begin their path at sources such as farms or mines."},{"target":"supply chain","sense":"production","clue":"factory","reason":"Manufacturers turn inputs into finished products."},{"target":"supply chain","sense":"production","clue":"assembly","reason":"Manufacturers turn inputs into finished products."},{"target":"supply chain","sense":"production","clue":"production line","reason":"Manufacturers turn inputs into finished products."},{"target":"supply chain","sense":"distribution","clue":"warehouse","reason":"Distribution moves goods from storage to their destination."},{"target":"supply chain","sense":"distribution","clue":"freight","reason":"Distribution moves goods from storage to their destination."},{"target":"supply chain","sense":"distribution","clue":"delivery truck","reason":"Distribution moves goods from storage to their destination."},{"target":"dress rehearsal","sense":"performers","clue":"cast","reason":"Performers practice under conditions close to the opening performance."},{"target":"dress rehearsal","sense":"performers","clue":"understudy","reason":"Performers practice under conditions close to the opening performance."},{"target":"dress rehearsal","sense":"performers","clue":"stage makeup","reason":"Performers practice under conditions close to the opening performance."},{"target":"dress rehearsal","sense":"technical crew","clue":"spotlight","reason":"The crew runs lighting, scenery and sound in sequence."},{"target":"dress rehearsal","sense":"technical crew","clue":"curtain","reason":"The crew runs lighting, scenery and sound in sequence."},{"target":"dress rehearsal","sense":"technical crew","clue":"sound cue","reason":"The crew runs lighting, scenery and sound in sequence."},{"target":"dress rehearsal","sense":"preparation","clue":"simulation","reason":"A full trial finds problems before an important event."},{"target":"dress rehearsal","sense":"preparation","clue":"walkthrough","reason":"A full trial finds problems before an important event."},{"target":"dress rehearsal","sense":"preparation","clue":"practice run","reason":"A full trial finds problems before an important event."}]$items$::jsonb) as a(target text,sense text,clue text,reason text);
insert into ascent_game.association_scores_v7(clue,word,strength,reason) select clue,target,100,reason from phrase_route_sources on conflict do nothing;
insert into ascent_game.association_scores_v7(clue,word,strength,reason) select distinct on(clue,sense) clue,sense,85,reason from phrase_route_sources where sense<>clue order by clue,sense,target on conflict do nothing;
insert into ascent_game.ascent_target_clues select target,sense,clue from phrase_route_sources on conflict do nothing;
insert into ascent_game.ascent_target_clues select target,'opening theme',clue from phrase_route_sources where target in ('supply chain','balance sheet','dress rehearsal') on conflict do nothing;
CREATE OR REPLACE FUNCTION public.ascent_circuit(p_ticket uuid, p_action text DEFAULT 'read'::text, p_day date DEFAULT NULL::date, p_round integer DEFAULT NULL::integer, p_guess text DEFAULT NULL::text, p_archive date DEFAULT NULL::date, p_seed uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
declare
 received timestamptz:=statement_timestamp();
 d date:=(received at time zone 'America/Los_Angeles')::date;
 local_today date:=d;
 run_scope text:='daily';
 route_key text;
 pitches jsonb;
 dictionary_version int:=4; pitch_seconds int:=20;
 h jsonb; total_points integer; until_at timestamptz; ix integer;
 b ascent_game.boards%rowtype; answer text; canonical text; candidates text[]; links jsonb:='{}'; solution jsonb;
 decoy_word text; decoy_links jsonb; hits integer; pairs integer; points integer; expired boolean; auto_submitted boolean:=false; rejected boolean:=false; crowd jsonb;
begin
 if p_archive is not null and (p_seed is not null or p_archive<date '2026-11-24' or p_archive>=local_today) then
  raise exception 'Only past published climbs can be replayed'; end if;
 if p_archive is not null then d:=p_archive;run_scope:='replay';end if;
 if p_seed is not null then d:=date '2026-11-24';run_scope:='practice:'||p_seed;end if;
 route_key:=case when p_seed is null then 'daily:'||to_char(d,'YYYY-MM-DD') else run_scope end;
 if p_ticket is null or p_action is null or p_action not in ('read','start','guess','retry_pitch','auto_guess') then raise exception 'Invalid request'; end if;
 if p_action='retry_pitch' then
   select r.history->(p_round-1),c.lex_version into h,dictionary_version
   from ascent_game.runs r join ascent_game.circuits c on c.route_id=route_key
   where r.day=d and r.scope=run_scope and r.ticket=p_ticket and p_day=d
     and p_round between 1 and jsonb_array_length(r.history);
   if h is null then raise exception 'Finish this pitch first';end if;
   b.clues:=array(select jsonb_array_elements_text(h->'clues'));
   answer:=lower(btrim(regexp_replace(coalesce(p_guess,''),'[[:space:]]+',' ','g')));
   if ascent_game.is_displayed_clue(b.clues,answer) then return jsonb_build_object('links','{}'::jsonb,'points',0,'rejected',true,'clueGuess',true);end if;
   links:=ascent_game.match_guess(dictionary_version,b.clues,answer);
   if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;

   if length(answer) between 1 and 120 and answer ~ '^[a-z0-9]+( [a-z0-9]+){0,15}$' and (select count(*) from ascent_game.connection_retry_evidence e where e.day=d and e.ticket=p_ticket and e.scope=run_scope and e.pitch=p_round)<30 then
    insert into ascent_game.connection_retry_evidence(day,ticket,scope,pitch,guess,links) values(d,p_ticket,run_scope,p_round,answer,links) on conflict(day,ticket,scope,pitch,guess) do update set links=excluded.links;
   end if;
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
    perform pg_advisory_xact_lock(hashtextextended('ascent-route-generation',0)); select c.boards,c.lex_version into pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key; if pitches is null then pitches:=ascent_game.generate_misdirection_climb(route_key,p_ticket);dictionary_version:=7; end if;
    insert into ascent_game.circuits(route_id,boards,lex_version) values(route_key,pitches,dictionary_version) on conflict do nothing;
    select c.boards,c.lex_version into strict pitches,dictionary_version from ascent_game.circuits c where c.route_id=route_key;
   end if;
   if pitches->(ix-1) ? 'contexts' then pitch_seconds:=(array[20,21,22,24,25])[ix];end if;
   b.target:=pitches->(ix-1)->>'target';
   b.clues:=array(select jsonb_array_elements_text(pitches->(ix-1)->'clues'));
  end if;
  if p_action='start' and p_day=d and p_round=ix and until_at is null then
   until_at:=clock_timestamp()+make_interval(secs=>pitch_seconds);
   update ascent_game.runs set deadline=until_at where day=d and ticket=p_ticket and scope=run_scope;
  end if;
  expired:=until_at is not null and received>=until_at;
  -- Allow only a short network delivery window for the answer frozen by the client at zero.
  auto_submitted:=coalesce(p_action='auto_guess' and p_day=d and p_round=ix
   and until_at is not null and received>=until_at-interval '250 milliseconds'
   and received<=until_at+interval '2 seconds'
   and length(btrim(coalesce(p_guess,''))) between 1 and 120,false);
  if (p_action='read' or (p_day=d and p_round=ix)) and (expired or auto_submitted or (until_at is not null and p_action='guess' and p_day=d and p_round=ix)) then
   answer:=lower(btrim(regexp_replace(coalesce(p_guess,''),'[[:space:]]+',' ','g')));
   if ascent_game.is_displayed_clue(b.clues,answer) then answer:='';end if;
   if (not expired or auto_submitted) and answer<>'' then links:=ascent_game.match_guess(dictionary_version,b.clues,answer);
   if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;end if;
   if expired or auto_submitted or links<>'{}'::jsonb then
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;
    if dictionary_version>=6 then solution:=ascent_game.match_guess(dictionary_version,b.clues,b.target); else select jsonb_object_agg(l.clue,l.links->b.target) into solution from ascent_game.circuit_lexicon l where l.edition=dictionary_version and l.clue=any(b.clues); end if;
    if dictionary_version=7 then
     select m.bait into decoy_word from ascent_game.misdirection_boards m where m.verified and m.target=b.target and m.clues @> b.clues and b.clues @> m.clues limit 1;
     if decoy_word is not null and not ascent_game.is_displayed_clue(b.clues,decoy_word) then decoy_links:=ascent_game.preview_registered_guess(b.clues,decoy_word);
      if (select count(*) from jsonb_object_keys(decoy_links)) not between 2 and 4 then decoy_word:=null;decoy_links:=null;end if;
     end if;
    end if;
    h:=h||jsonb_build_array(jsonb_build_object('guess',case when expired and not auto_submitted then '' else answer end,'timedOut',expired and not auto_submitted,'autoSubmitted',auto_submitted,'clues',b.clues,'links',links,'points',points,'target',b.target,'solution',solution,'decoy',decoy_word,'decoyLinks',decoy_links));
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
 return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',coalesce(dictionary_version>=3,true),'deadline',until_at,'pitchSeconds',pitch_seconds,'contexts',case when until_at is not null then pitches->(ix-1)->'contexts' end,'serverTime',clock_timestamp(),'clues',case when until_at is not null then b.clues end,'rejected',rejected);
end;
$function$
;