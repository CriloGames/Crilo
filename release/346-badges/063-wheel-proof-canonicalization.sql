-- Crilo authoritative Daily Wheel audit, 2026-10-11.
-- 1. No owner Test Runs in leaderboard/official table, including legacy RPC paths.
-- 2. Canonical score history, best-roll label and odds from saved server spins.
-- Existing sessions, completed runs, scores, badges and owner Test Runs are unchanged.
CREATE OR REPLACE FUNCTION public.enforce_crilo_run_mode()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_is_owner boolean := false;
  v_has_official_run boolean := false;
begin

  -- A user may only submit a run as themselves.
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Invalid run owner.';
  end if;

  -- Check whether this account is the Crilo Owner.
  select coalesce(p.is_owner, false)
  into v_is_owner
  from public.profiles p
  where p.id = auth.uid();

  -- Determine whether this player already has an official
  -- run for the Daily period being submitted.
  select exists (
    select 1
    from public.daily_runs r
    where r.user_id = auth.uid()
      and r.daily_period = new.daily_period
      and r.is_test = false
  )
  into v_has_official_run;

  -- Official Dailies are always stored once in daily_runs. Owner Test Runs
  -- must use owner_test_runs through crilo_save_owner_test_run instead.
  if v_has_official_run then
    raise exception 'Official Daily already submitted for this period'
      using errcode='23514';
  end if;
  new.is_test := false;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.crilo_verify_attached_spin_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.crilo_spin_sessions%ROWTYPE; i integer; a jsonb; b jsonb;
BEGIN
 IF NEW.verified_spin_session_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO s FROM public.crilo_spin_sessions WHERE id=NEW.verified_spin_session_id AND user_id=NEW.user_id FOR UPDATE;
 IF NOT FOUND OR s.finished_at IS NULL OR s.remaining_spins<>0 OR s.daily_period IS DISTINCT FROM NEW.daily_period THEN
   RAISE EXCEPTION 'Verified spin session not finished or not owned' USING ERRCODE='23514';
 END IF;
 IF NEW.results IS NULL OR jsonb_typeof(NEW.results)<>'array'
 OR s.score<>NEW.score OR s.spin_count<>NEW.spins OR s.upgrades<>coalesce(NEW.upgrades,0)
 OR s.doubles<>coalesce(NEW.doubles,0) OR s.ducks<>coalesce(NEW.ducks,0)
 OR s.numbers_landed<>coalesce(NEW.numbers_landed,0) OR s.extra_spins<>coalesce(NEW.extra_spins,0)
 OR jsonb_array_length(s.results)<>jsonb_array_length(NEW.results) THEN
   RAISE EXCEPTION 'Daily counters mismatch verified server spins' USING ERRCODE='23514';
 END IF;
 FOR i IN 0..jsonb_array_length(s.results)-1 LOOP
   a:=s.results->i;b:=NEW.results->i;
   IF a->>'type' IS DISTINCT FROM b->>'type'
     OR a->>'base' IS DISTINCT FROM b->>'base'
     OR a->>'points' IS DISTINCT FROM b->>'points'
     OR a->>'segments' IS DISTINCT FROM b->>'segments'
     OR jsonb_typeof(b->'probability') IS DISTINCT FROM 'number' THEN
     RAISE EXCEPTION 'Daily result differs from verified server spin' USING ERRCODE='23514';
   END IF;
   -- The exact authoritative probability comes from the saved server spin,
   -- not a browser float that may have rounded a repeating fraction.
   NEW.results:=jsonb_set(NEW.results,ARRAY[i::text,'probability'],a->'probability',true);
 END LOOP;
 -- Completely discard any untrusted extra JSON keys (including forged
 -- badge metadata, event labels, or client-supplied probability values).
 -- The canonical evidence is the immutable sequence issued by server spins.
 NEW.results := s.results;

 -- Persist the run probability using the server's exact recorded fractions.
 NEW.rarity_score := 1;
 FOR i IN 0..jsonb_array_length(s.results)-1 LOOP
  NEW.rarity_score := NEW.rarity_score * (s.results->i->>'probability')::numeric;
 END LOOP;

 -- Compute the highest individual point gain and its label from the
 -- authoritative result; never accept a browser-authored best-roll label.
 SELECT COALESCE((item.val->>'points')::bigint,0),
        CASE WHEN item.val->>'type'='double' THEN '×2'
             WHEN item.val->>'type'='num' THEN '+' || (item.val->>'points')
             ELSE '' END
 INTO NEW.best_roll_points,NEW.best_roll_label
 FROM jsonb_array_elements(s.results) WITH ORDINALITY AS item(val,ord)
 ORDER BY (item.val->>'points')::bigint DESC, item.ord ASC LIMIT 1;
 RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.enforce_crilo_run_mode() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.crilo_verify_attached_spin_session() FROM PUBLIC,anon,authenticated;
