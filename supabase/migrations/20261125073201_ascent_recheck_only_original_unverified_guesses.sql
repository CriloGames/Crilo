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
 decoy_word text; decoy_links jsonb; hits integer; pairs integer; points integer; expired boolean; auto_submitted boolean:=false; rejected boolean:=false; crowd jsonb; original jsonb;
begin
 perform set_config('ascent.match_incomplete','false',true);
 if p_archive is not null and (p_seed is not null or p_archive<date '2026-11-24' or p_archive>=local_today) then
  raise exception 'Only past published climbs can be replayed'; end if;
 if p_archive is not null then d:=p_archive;run_scope:='replay';end if;
 if p_seed is not null then d:=date '2026-11-24';run_scope:='practice:'||p_seed;end if;
 route_key:=case when p_seed is null then 'daily:'||to_char(d,'YYYY-MM-DD') else run_scope end;
 if p_ticket is null or p_action is null or p_action not in ('read','start','guess','retry_pitch','auto_guess','recheck_pitch') then raise exception 'Invalid request'; end if;
 if p_seed is not null and not exists(select 1 from ascent_game.circuits where route_id=route_key) then
  if p_action='read' then return jsonb_build_object('needsGeneration',true,'day',d,'history','[]'::jsonb,'deadline',null,'serverTime',clock_timestamp());end if;
  raise exception 'Generate the practice route before starting';
 end if;
 if p_action='recheck_pitch' then
  select r.history,r.total,c.lex_version,c.boards into h,total_points,dictionary_version,pitches
  from ascent_game.runs r join ascent_game.circuits c on c.route_id=route_key
  where r.day=d and r.scope=run_scope and r.ticket=p_ticket and p_day=d
    and p_round between 1 and jsonb_array_length(r.history)
  for update of r;
  if h is null then raise exception 'Finish this pitch first';end if;
  original:=h->(p_round-1);
  -- Only the frozen original answer can be reconsidered. Practice guesses cannot alter scores.
  if original->>'checkIncomplete' is distinct from 'true' or coalesce(original->>'guess','')='' or p_guess is not null then
    return jsonb_build_object('record',original,'total',total_points,'checkIncomplete',coalesce(original->>'checkIncomplete'='true',false));
  end if;
  b.clues:=array(select jsonb_array_elements_text(original->'clues'));
  answer:=original->>'guess';
  links:=coalesce(original->'links','{}'::jsonb)||ascent_game.match_guess(dictionary_version,b.clues,answer);
  if p_seed is not null then links:=links||ascent_game.generated_links(pitches->(p_round-1),answer);end if;
  if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;
  -- Preserve credit already awarded; only add newly verified connections.
  links:=coalesce(original->'links','{}'::jsonb)||links;
  select count(*) into hits from jsonb_object_keys(links);
  select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
  points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;
  total_points:=total_points+points-coalesce((original->>'points')::integer,0);
  original:=original||jsonb_build_object('links',links,'points',points,'checkIncomplete',hits<6 and coalesce(current_setting('ascent.match_incomplete',true)='true',false));
  h:=jsonb_set(h,array[(p_round-1)::text],original);
  update ascent_game.runs set history=h,total=total_points where day=d and ticket=p_ticket and scope=run_scope;
  return jsonb_build_object('record',original,'total',total_points,'checkIncomplete',original->'checkIncomplete');
 end if;
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
   if p_seed is not null then links:=links||ascent_game.generated_links((select c.boards->(p_round-1) from ascent_game.circuits c where c.route_id=route_key),answer);end if;
   if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;

   if length(answer) between 1 and 120 and answer ~ '^[a-z0-9]+( [a-z0-9]+){0,15}$' and (select count(*) from ascent_game.connection_retry_evidence e where e.day=d and e.ticket=p_ticket and e.scope=run_scope and e.pitch=p_round)<30 then
    insert into ascent_game.connection_retry_evidence(day,ticket,scope,pitch,guess,links) values(d,p_ticket,run_scope,p_round,answer,links) on conflict(day,ticket,scope,pitch,guess) do update set links=excluded.links;
   end if;
   return jsonb_build_object('links',links,'points',points,'rejected',hits=0,'checkIncomplete',coalesce(current_setting('ascent.match_incomplete',true)='true',false));
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
   if p_seed is not null then links:=links||ascent_game.generated_links((select c.boards->(p_round-1) from ascent_game.circuits c where c.route_id=route_key),answer);end if;
   if dictionary_version=7 then links:=ascent_game.semantic_complete_guess(b.clues,answer,p_ticket,links);end if;end if;
   if expired or auto_submitted or links<>'{}'::jsonb then
    select count(*) into hits from jsonb_object_keys(links);
    select count(*) into pairs from generate_series(1,3) i where links ? b.clues[i] and links ? b.clues[i+3];
    points:=case when hits=6 then 200 else 10*(hits*(hits+1)/2+pairs) end;
    if dictionary_version>=6 then solution:=ascent_game.match_guess(dictionary_version,b.clues,b.target); else select jsonb_object_agg(l.clue,l.links->b.target) into solution from ascent_game.circuit_lexicon l where l.edition=dictionary_version and l.clue=any(b.clues); end if;
    if p_seed is not null and pitches->(ix-1) ? 'answers' then
     solution:=ascent_game.generated_links(pitches->(ix-1),b.target);
     decoy_word:=pitches->(ix-1)->'answers'->1->>'word';
     decoy_links:=ascent_game.generated_links(pitches->(ix-1),decoy_word);
    elsif dictionary_version=7 then
     select m.bait into decoy_word from ascent_game.misdirection_boards m where m.verified and m.target=b.target and m.clues @> b.clues and b.clues @> m.clues limit 1;
     if decoy_word is not null and not ascent_game.is_displayed_clue(b.clues,decoy_word) then decoy_links:=ascent_game.preview_registered_guess(b.clues,decoy_word);
      if (select count(*) from jsonb_object_keys(decoy_links)) not between 2 and 4 then decoy_word:=null;decoy_links:=null;end if;
     end if;
    end if;
    h:=h||jsonb_build_array(jsonb_build_object('guess',case when expired and not auto_submitted then '' else answer end,'timedOut',expired and not auto_submitted,'autoSubmitted',auto_submitted,'clues',b.clues,'links',links,'points',points,'checkIncomplete',coalesce(current_setting('ascent.match_incomplete',true)='true',false),'target',b.target,'solution',solution,'decoy',decoy_word,'decoyLinks',decoy_links));
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
  select jsonb_build_object(
    'average',round(sum(score_sum)/nullif(sum(n),0)),
    'players',coalesce(sum(n),0),
    'finishBands',case when sum(n)>=10 then jsonb_object_agg(band,n) end
  ) into crowd
  from (
    select least(total/100,9) as band,count(*) as n,sum(total) as score_sum
    from ascent_game.runs
    where day=d and scope='daily' and (jsonb_array_length(history)=5 or (jsonb_array_length(history)=4 and deadline<=received))
    group by 1
  ) as bins;
  return jsonb_build_object('day',d,'history',h,'results',crowd||jsonb_build_object('score',total_points));
 end if;
 return jsonb_build_object('day',d,'history',h,'fullBank',dictionary_version<>3,'semantic',coalesce(dictionary_version>=3,true),'deadline',until_at,'pitchSeconds',pitch_seconds,'contexts',case when until_at is not null then pitches->(ix-1)->'contexts' end,'serverTime',clock_timestamp(),'clues',case when until_at is not null then b.clues end,'rejected',rejected,'checkIncomplete',coalesce(current_setting('ascent.match_incomplete',true)='true',false));
end;
$function$

