-- Crilo Owner MFA: database-enforced TOTP assurance for moderation writes.
-- FAIL CLOSED until the owner completes TOTP enrollment. Player Daily
-- gameplay, owner test-run creation and all public views remain available.
CREATE OR REPLACE FUNCTION public.crilo_require_owner_mfa()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_owner IS TRUE
 ) THEN
  RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501';
 END IF;
 IF auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' THEN
  RAISE EXCEPTION 'Owner MFA required. Go to Settings > Two-factor authentication and verify your authenticator.'
   USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=auth.uid()
   AND f.status='verified' AND f.factor_type='totp'
 ) THEN
  RAISE EXCEPTION 'A verified owner authenticator factor is required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.crilo_require_owner_mfa() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_require_owner_mfa() TO authenticated;

-- Preserve all existing function bodies/permissions; add the MFA gate as
-- the first executable statement inside each mutation-capable owner RPC.
-- This also covers callers that bypass the website and invoke RPCs manually.
DO $$
DECLARE f record; before text; after text; target_names text[]:=ARRAY[
 'crilo_owner_penalize_daily',
 'crilo_owner_drawing_decision',
 'crilo_owner_review_action',
 'crilo_owner_moderate_run',
 'crilo_owner_delete_profile_run',
 'crilo_owner_delete_test_run',
 'crilo_delete_owner_test_runs',
 'crilo_owner_manual_flag',
 'crilo_owner_example_delete',
 'crilo_owner_example_save',
 'crilo_owner_finish_ocr',
 'crilo_owner_finish_visual',
 'crilo_owner_local_scan_retry',
 'crilo_owner_local_scan_save',
 'crilo_owner_local_scan_save_v4',
 'crilo_owner_local_scan_save_v5',
 'crilo_owner_local_scan_save_v6',
 'crilo_owner_local_scan_save_v7',
 'crilo_owner_saved_test_ocr_finish',
 'crilo_owner_visual_result'
];
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=ANY(target_names))<>array_length(target_names,1) THEN
  RAISE EXCEPTION 'Owner MFA migration aborted: missing owner RPCs';
 END IF;
 FOR f IN
  SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=ANY(target_names)
 LOOP
  before:=pg_get_functiondef(f.oid);
  IF before LIKE '%PERFORM public.crilo_require_owner_mfa();%' THEN CONTINUE;END IF;
  after:=regexp_replace(before,'(\mbegin\M)', E'\\1\n PERFORM public.crilo_require_owner_mfa();','i');
  IF after=before THEN RAISE EXCEPTION 'Cannot apply owner MFA gate to %',f.proname;END IF;
  EXECUTE after;
 END LOOP;
END $$;
