-- CRILO 346 badge release: server-authoritative Daily gate.
-- PRELAUNCH ONLY. Deploy AFTER game.js server-spin browser smoke tests pass.
-- Does not change or delete historical runs, badges, awards or drawings.
-- This assumes existing zy_crilo_verify_attached_spin_session remains enabled.

DO $prereq$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgname='zy_crilo_verify_attached_spin_session'
    AND tgrelid='public.daily_runs'::regclass AND tgenabled IN ('O','A')
 ) THEN
  RAISE EXCEPTION 'Cannot require proof: verified spin-session trigger missing/disabled';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_trigger
  WHERE tgname='z_enforce_crilo_run_mode_trigger'
    AND tgrelid='public.daily_runs'::regclass AND tgenabled IN ('O','A')
 ) THEN
  RAISE EXCEPTION 'Cannot require proof: run-mode trigger missing/disabled';
 END IF;
END
$prereq$;

CREATE OR REPLACE FUNCTION public.crilo_require_authoritative_official_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $gate$
BEGIN
 -- z_enforce_crilo_run_mode_trigger has already set is_test by trigger-name order.
 IF COALESCE(NEW.is_test,false)=false THEN
  IF NEW.verified_spin_session_id IS NULL THEN
   RAISE EXCEPTION 'Official Daily must come from verified server spins'
    USING ERRCODE='23514';
  END IF;
  -- A user cannot self-assign a finalized rank during INSERT.
  -- The trusted period finalizer sets this field after the period has ended.
  NEW.final_rank:=NULL;
 END IF;
 RETURN NEW;
END;
$gate$;

DROP TRIGGER IF EXISTS zx_crilo_require_authoritative_official_daily
 ON public.daily_runs;

CREATE TRIGGER zx_crilo_require_authoritative_official_daily
BEFORE INSERT ON public.daily_runs
FOR EACH ROW EXECUTE FUNCTION public.crilo_require_authoritative_official_daily();

REVOKE ALL ON FUNCTION public.crilo_require_authoritative_official_daily() FROM PUBLIC;
-- A trigger executes with the permissions of its calling session; the trigger
-- function itself requires no direct Data API EXECUTE grant.
COMMENT ON FUNCTION public.crilo_require_authoritative_official_daily()
 IS 'Requires authenticated official Daily inserts to include server-spin proof and prevents client-supplied finalized ranks.';
