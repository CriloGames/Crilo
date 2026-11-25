-- 20261125020903 ascent_prevent_ai_timeout_and_stale_retry
-- Only Ascent RPCs get longer statement budgets; other endpoints retain existing limits.
alter function public.ascent_circuit(uuid,text,date,integer,text,date,uuid) set statement_timeout='15s';
alter function public.ascent_pitch(uuid,text,date,integer,text) set statement_timeout='15s';
alter function public.ascent_top_answers(uuid,date,date,uuid,integer) set statement_timeout='15s';
do $patch$ declare d text;n text;begin
select pg_get_functiondef('ascent_game.llm_complete(text[],text,uuid,jsonb)'::regprocedure) into d;
n:=replace(d,'if v is not null or reply ? ''state'' or reply->>''error''=''reasoning_timeout_or_unavailable'' then return result;end if;
   return result||ascent_game.semantic_fallback(array(select x from unnest(clues) x where not result ? x),guess,ticket);','return result;');
if n=d then raise exception 'Fallback patch mismatch';end if;execute n;
select pg_get_functiondef('public.ascent_circuit(uuid,text,date,integer,text,date,uuid)'::regprocedure) into d;
n:=replace(d,'if expired or auto_submitted or (until_at is not null and p_action=''guess'' and p_day=d and p_round=ix) then','if (p_action=''read'' or (p_day=d and p_round=ix)) and (expired or auto_submitted or (until_at is not null and p_action=''guess'' and p_day=d and p_round=ix)) then');
if n=d then raise exception 'Stale submission guard patch mismatch';end if;execute n;
end;$patch$;
notify pgrst,'reload schema';
notify pgrst,'reload config';

-- 20261125020959 ascent_preserve_fast_quota_fallback
do $patch$ declare d text;n text;begin
select pg_get_functiondef('ascent_game.llm_complete(text[],text,uuid,jsonb)'::regprocedure) into d;
n:=replace(d,'-- Avoid a second network round trip on timeout; keep established matches.
   return result;','-- Quota exhaustion is an immediate refusal, not a slow model call.
   if v is null and reply->>''status''=''429'' and clock_timestamp()-statement_timestamp()<interval ''2 seconds'' then
    return result||ascent_game.semantic_fallback(array(select x from unnest(clues) x where not result ? x),guess,ticket);
   end if;
   -- Never stack a second model request on a slow or timed-out request.
   return result;');
if n=d then raise exception 'Quota fallback patch mismatch';end if;execute n;
end;$patch$;