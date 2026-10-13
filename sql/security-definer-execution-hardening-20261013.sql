-- Crilo public RPC least-privilege audit, 2026-10-13.
-- Applied to Supabase project mqozqigwkobnhijvvboy.
-- Only remove external EXECUTE from privileged internal helpers;
-- SECURITY DEFINER wrappers/triggers retain owner execution rights.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.crilo_require_owner_mfa()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crilo_warning_current_streak(uuid)
  FROM PUBLIC, anon, authenticated;

-- These functions exclusively use schema-qualified application tables and
-- pg_catalog built-ins, so a caller-influenced public search_path is unnecessary.
ALTER FUNCTION public.crilo_profile_metrics(uuid) SET search_path = '';
ALTER FUNCTION public.crilo_public_owner_runs() SET search_path = '';
ALTER FUNCTION public.crilo_owner_test_runs() SET search_path = '';
ALTER FUNCTION public.crilo_save_owner_test_run(jsonb) SET search_path = '';
ALTER FUNCTION public.crilo_delete_owner_test_runs(uuid[]) SET search_path = '';

COMMIT;
