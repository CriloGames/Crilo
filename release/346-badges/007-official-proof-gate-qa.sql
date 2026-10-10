-- Isolated verification of planned official-run gate; never alters live daily_runs.
CREATE TABLE IF NOT EXISTS crilo_badge_prelaunch.qa_official_proof_tests(
 id bigint generated always as identity primary key,
 is_test boolean not null default false,
 verified_spin_session_id uuid,
 final_rank integer
);
REVOKE ALL ON crilo_badge_prelaunch.qa_official_proof_tests FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION crilo_badge_prelaunch.qa_require_authoritative_official_daily()
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


REVOKE ALL ON FUNCTION crilo_badge_prelaunch.qa_require_authoritative_official_daily() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zx_crilo_require_authoritative_official_daily_qa
  ON crilo_badge_prelaunch.qa_official_proof_tests;
CREATE TRIGGER zx_crilo_require_authoritative_official_daily_qa
BEFORE INSERT ON crilo_badge_prelaunch.qa_official_proof_tests
FOR EACH ROW EXECUTE FUNCTION crilo_badge_prelaunch.qa_require_authoritative_official_daily();
DO $qa$
DECLARE idn bigint; verified uuid:='00000000-0000-4000-8000-000000000042';s record; rejected boolean:=false;
BEGIN
 TRUNCATE crilo_badge_prelaunch.qa_official_proof_tests;
 BEGIN
  INSERT INTO crilo_badge_prelaunch.qa_official_proof_tests(is_test,verified_spin_session_id,final_rank)
  VALUES (false,null,1);
 EXCEPTION WHEN check_violation THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Missing server evidence was allowed for official run';END IF;
 INSERT INTO crilo_badge_prelaunch.qa_official_proof_tests(is_test,verified_spin_session_id,final_rank)
 VALUES (true,null,1) RETURNING * INTO s;
 IF s.final_rank<>1 OR s.is_test<>true THEN RAISE EXCEPTION 'Private Test Run unexpectedly modified';END IF;
 INSERT INTO crilo_badge_prelaunch.qa_official_proof_tests(is_test,verified_spin_session_id,final_rank)
 VALUES (false,verified,1) RETURNING * INTO s;
 IF s.final_rank IS NOT NULL OR s.verified_spin_session_id<>verified THEN
  RAISE EXCEPTION 'Official server proof rank stamping failed';
 END IF;
 TRUNCATE crilo_badge_prelaunch.qa_official_proof_tests;
 RAISE NOTICE 'PASS: official proof required, client-rank scrubbed, owner Test Run permitted; no production changes';
END;
$qa$;