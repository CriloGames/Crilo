-- Cosmetic wheel looks: account-saved, server-authorized, noncompetitive.
-- Unlock via existing verified Challenge Stars or legitimate unique badges.
-- Never updates server spin sessions, scores, badges or drawings.
BEGIN;
CREATE TABLE IF NOT EXISTS public.crilo_wheel_look_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 look_key text NOT NULL DEFAULT 'classic' CHECK (
  look_key IN ('classic','pond','dusk','aurora','blossom','starlight')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.crilo_wheel_look_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crilo_wheel_look_preferences FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crilo_wheel_looks(
 p_action text DEFAULT 'status',p_look text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 uid uuid:=auth.uid();
 stars_count integer:=0;
 badges_count integer:=0;
 requested text:=nullif(btrim(coalesce(p_look,'')),'');
 equipped text:='classic';
 allowed boolean:=false;
BEGIN
 IF uid IS NULL OR auth.role()<>'authenticated' THEN
  RAISE EXCEPTION 'Sign in to unlock Wheel Looks' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM auth.users a JOIN public.profiles p ON p.id=a.id
  WHERE a.id=uid AND a.is_anonymous IS FALSE
    AND a.email IS NOT NULL AND a.email_confirmed_at IS NOT NULL
    AND (a.banned_until IS NULL OR a.banned_until<=clock_timestamp())
    AND NOT EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=uid)
 ) THEN
  RAISE EXCEPTION 'An active, verified Crilo account is required'
   USING ERRCODE='42501';
 END IF;
 IF p_action NOT IN ('status','equip') OR p_action IS NULL THEN
  RAISE EXCEPTION 'Unsupported Wheel Looks action' USING ERRCODE='22023';
 END IF;
 -- Existing stars penalized for rule violations do not unlock cosmetic looks.
 SELECT count(*)::integer INTO stars_count
 FROM public.crilo_daily_challenge_stars a
 WHERE a.user_id=uid AND NOT EXISTS (
  SELECT 1 FROM public.crilo_daily_penalties penalty
  WHERE penalty.user_id=uid AND penalty.daily_period=a.daily_period
 );
 -- Match the existing Bonus Daily's legitimate unique badge counting.
 SELECT count(DISTINCT ub.badge_id)::integer INTO badges_count
 FROM public.user_badges ub JOIN public.badges b ON b.id=ub.badge_id
 WHERE ub.user_id=uid AND b.is_active=true AND b.is_earnable=true
   AND (ub.run_id IS NULL OR EXISTS (
    SELECT 1 FROM public.daily_runs d
    WHERE d.id=ub.run_id AND d.user_id=uid AND d.is_test=false
     AND d.verified_spin_session_id IS NOT NULL
   ));
 SELECT coalesce(w.look_key,'classic') INTO equipped
 FROM public.crilo_wheel_look_preferences w WHERE w.user_id=uid;
 equipped:=coalesce(equipped,'classic');
 IF p_action='equip' THEN
  PERFORM public.crilo_wheel_assert_unique_email();
  IF requested NOT IN ('classic','pond','dusk','aurora','blossom','starlight')
    OR requested IS NULL THEN
   RAISE EXCEPTION 'Unrecognized wheel look' USING ERRCODE='22023';
  END IF;
  allowed:=CASE requested
   WHEN 'classic' THEN true
   WHEN 'pond' THEN stars_count>=12
   WHEN 'dusk' THEN stars_count>=36
   WHEN 'aurora' THEN stars_count>=90
   WHEN 'blossom' THEN badges_count>=50
   WHEN 'starlight' THEN badges_count>=100
   ELSE false END;
  IF NOT allowed THEN
   RAISE EXCEPTION 'That wheel look is still locked' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.crilo_wheel_look_preferences(user_id,look_key)
  VALUES(uid,requested)
  ON CONFLICT(user_id) DO UPDATE
    SET look_key=excluded.look_key,updated_at=clock_timestamp();
  equipped:=requested;
 ELSE
  -- If badge/Star eligibility was revoked, do not show the locked look.
  allowed:=CASE equipped
   WHEN 'classic' THEN true
   WHEN 'pond' THEN stars_count>=12
   WHEN 'dusk' THEN stars_count>=36
   WHEN 'aurora' THEN stars_count>=90
   WHEN 'blossom' THEN badges_count>=50
   WHEN 'starlight' THEN badges_count>=100
   ELSE false END;
  IF NOT allowed THEN equipped:='classic';END IF;
 END IF;
 RETURN jsonb_build_object(
  'equipped',equipped,'challenge_stars',stars_count,
  'unique_badges',badges_count,
  'looks',jsonb_build_array(
   jsonb_build_object('key','classic','name','Classic Pastel','unlocked',true,'requirement','Included'),
   jsonb_build_object('key','pond','name','Duck Pond','unlocked',stars_count>=12,'requirement','12 Challenge Stars'),
   jsonb_build_object('key','dusk','name','Dreamy Dusk','unlocked',stars_count>=36,'requirement','36 Challenge Stars'),
   jsonb_build_object('key','aurora','name','Aurora','unlocked',stars_count>=90,'requirement','90 Challenge Stars'),
   jsonb_build_object('key','blossom','name','Blossom','unlocked',badges_count>=50,'requirement','50 unique badges'),
   jsonb_build_object('key','starlight','name','Starlight','unlocked',badges_count>=100,'requirement','100 unique badges')
  )
 );
END $function$;
REVOKE ALL ON FUNCTION public.crilo_wheel_looks(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crilo_wheel_looks(text,text) TO authenticated;
COMMENT ON FUNCTION public.crilo_wheel_looks(text,text) IS
'Verified account-only, cosmetic wheel palette unlocks. Only changes account preference; cannot modify outcomes or competitive scores.';
COMMIT;