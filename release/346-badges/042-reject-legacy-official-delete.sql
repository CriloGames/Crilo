-- The moderated official Daily removal contract requires a reason, flag,
-- streak reset, badge revocation, notice and per-day replay lock in ONE RPC.
-- Old owner-only deletion RPCs were silent bypasses for those side effects.
CREATE OR REPLACE FUNCTION public.crilo_owner_delete_profile_run(p_user uuid, p_run_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_owner=true
  ) THEN
    RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501';
  END IF;
  RAISE EXCEPTION 'Official Daily deletion requires a violation reason. Use crilo_owner_penalize_daily(p_run_id,p_reason).' USING ERRCODE='22023';
END
$$;

CREATE OR REPLACE FUNCTION public.crilo_owner_moderate_run(p_id uuid,p_source text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_owner=true
  ) THEN
    RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501';
  END IF;
  IF p_source='official' THEN
    RAISE EXCEPTION 'Official Daily deletion requires a violation reason. Use crilo_owner_penalize_daily(p_run_id,p_reason).' USING ERRCODE='22023';
  ELSIF p_source='test' THEN
    DELETE FROM public.owner_test_runs WHERE id=p_id;
  ELSE
    RAISE EXCEPTION 'Invalid run source' USING ERRCODE='22023';
  END IF;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END
$$;