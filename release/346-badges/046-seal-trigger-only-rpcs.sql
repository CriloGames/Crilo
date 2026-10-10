-- Remove direct API execute privileges from trigger-only functions.
-- Triggers still run; arbitrary users cannot call SECURITY DEFINER triggers as RPCs.
DO $$
DECLARE f record;
BEGIN
 FOR f IN
  SELECT p.oid, n.nspname AS schema_name,p.proname,
   pg_get_function_identity_arguments(p.oid) AS arguments
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prorettype='pg_catalog.trigger'::regtype
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC,anon,authenticated',
    f.schema_name,f.proname,f.arguments);
 END LOOP;
END $$;