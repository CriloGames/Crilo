-- Applied to production Supabase on 2026-10-10.
-- Prevent ordinary signed-in players from granting themselves is_owner,
-- which otherwise permits use of owner-only Daily penalties and bans.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM authenticated;
GRANT INSERT (id, username, name_color, account_code, theme, sound_enabled, username_changed_at)
 ON TABLE public.profiles TO authenticated;
GRANT UPDATE (username, name_color, account_code, theme, sound_enabled, username_changed_at)
 ON TABLE public.profiles TO authenticated;

-- Defense in depth if a future table grant becomes broader again.
CREATE OR REPLACE FUNCTION public.crilo_reject_owner_role_self_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF current_user='authenticated' THEN
  IF TG_OP='INSERT' AND coalesce(NEW.is_owner,false) THEN
   RAISE EXCEPTION 'Only authorized administrators can assign owner privileges' USING ERRCODE='42501';
  ELSIF TG_OP='UPDATE' AND NEW.is_owner IS DISTINCT FROM OLD.is_owner THEN
   RAISE EXCEPTION 'Owner privileges cannot be changed through player settings' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS crilo_lock_owner_role ON public.profiles;
CREATE TRIGGER crilo_lock_owner_role BEFORE INSERT OR UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.crilo_reject_owner_role_self_change();

-- Old official-Daily review APIs should no longer silently apply the generic
-- 'other' reason. New UIs require an owner-selected, specific policy category
-- in crilo_owner_penalize_daily(run_id,reason).
CREATE OR REPLACE FUNCTION public.crilo_owner_drawing_decision(p_run_id bigint, p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_uid uuid; v_review text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_owner=true
 ) THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE='42501'; END IF;
 IF p_action='remove' THEN
  RAISE EXCEPTION 'Choose a reason using crilo_owner_penalize_daily before removing an official Daily'
   USING ERRCODE='22023';
 END IF;
 IF p_action<>'approve' THEN RAISE EXCEPTION 'Invalid action' USING ERRCODE='22023'; END IF;
 SELECT d.user_id INTO v_uid FROM public.daily_runs d
  WHERE d.id=p_run_id AND d.drawing IS NOT NULL AND coalesce(d.is_test,false)=false
  FOR UPDATE;
 IF v_uid IS NULL THEN RETURN false; END IF;
 SELECT r.status INTO v_review FROM public.crilo_drawing_reviews r
  WHERE r.run_id=p_run_id FOR UPDATE;
 IF v_review IS NOT NULL AND v_review<>'pending' THEN RETURN false; END IF;
 INSERT INTO public.crilo_drawing_reviews(run_id,user_id,status,reason,created_at,reviewed_at,reviewed_by)
 VALUES(p_run_id,v_uid,'approved','Owner manual drawing feed',now(),now(),auth.uid())
 ON CONFLICT(run_id) DO UPDATE SET status='approved',reviewed_at=now(),
  reviewed_by=auth.uid(),reason='Owner manual drawing feed';
 RETURN true;
END $fn$;
