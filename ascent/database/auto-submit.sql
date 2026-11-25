-- Applied to production; apply after progressive-difficulty.sql.
-- 20261125000903
do $patch$
declare d text; n text;
begin
select pg_get_functiondef('public.ascent_circuit(uuid,text,date,integer,text,date,uuid)'::regprocedure) into d;
n:=replace(d,'expired boolean; rejected','expired boolean; auto_submitted boolean:=false; rejected');
n:=replace(n,'''read'',''start'',''guess'',''retry_pitch''','''read'',''start'',''guess'',''retry_pitch'',''auto_guess''');
n:=replace(n,'  if expired or (until_at is not null and p_action=''guess'' and p_day=d and p_round=ix) then','  -- Allow only a short network delivery window for the answer frozen by the client at zero.
  auto_submitted:=coalesce(p_action=''auto_guess'' and p_day=d and p_round=ix
   and until_at is not null and received>=until_at-interval ''250 milliseconds''
   and received<=until_at+interval ''2 seconds''
   and length(btrim(coalesce(p_guess,''''))) between 1 and 120,false);
  if expired or auto_submitted or (until_at is not null and p_action=''guess'' and p_day=d and p_round=ix) then');
n:=replace(n,'   if not expired then links:=ascent_game.match_guess(dictionary_version,b.clues,answer);end if;','   if not expired or auto_submitted then links:=ascent_game.match_guess(dictionary_version,b.clues,answer);end if;');
n:=replace(n,'   if expired or links<>''{}''::jsonb then','   if expired or auto_submitted or links<>''{}''::jsonb then');
n:=replace(n,'''guess'',case when expired then '''' else answer end,''timedOut'',expired,','''guess'',case when expired and not auto_submitted then '''' else answer end,''timedOut'',expired and not auto_submitted,''autoSubmitted'',auto_submitted,');
if n=d or n not like '%autoSubmitted%' or n not like '%interval ''2 seconds''%' or n not like '%if not expired or auto_submitted%' then raise exception 'Auto-submit patch mismatch';end if;
execute n;
end;$patch$;