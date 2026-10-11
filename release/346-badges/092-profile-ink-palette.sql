-- Versioned profile icon palette, with independent ink color. Existing
-- clients using the original two-argument RPC remain compatible.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_ink text NOT NULL DEFAULT '#17191E';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS crilo_avatar_ink_allowed;
ALTER TABLE public.profiles ADD CONSTRAINT crilo_avatar_ink_allowed CHECK(
 avatar_ink IN ('#17191E','#2D567F','#28654A','#7F4FA1','#B54860',
  '#A65B2E','#FFFFFF','#FFF0A8'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS crilo_avatar_ink_contrast;
ALTER TABLE public.profiles ADD CONSTRAINT crilo_avatar_ink_contrast CHECK (avatar_ink<>avatar_background);

CREATE OR REPLACE FUNCTION public.crilo_update_profile_icon_v2(
 p_symbol text,p_background text,p_ink text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $icon$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
    AND u.email_confirmed_at IS NOT NULL AND u.is_anonymous IS FALSE)
 THEN RAISE EXCEPTION 'A verified account is required.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.crilo_banned_accounts b WHERE b.user_id=auth.uid())
 THEN RAISE EXCEPTION 'Account suspended.' USING ERRCODE='42501'; END IF;
 IF p_symbol IS NOT NULL AND p_symbol !~ '^[A-Z0-9]$'
  AND p_symbol NOT IN ('icon:star','icon:duck','icon:flower','icon:bolt',
    'icon:heart','icon:moon','icon:dice','icon:wave','icon:sun')
 THEN RAISE EXCEPTION 'Choose a permitted letter or icon.' USING ERRCODE='22023'; END IF;
 IF p_background IS NULL OR p_background NOT IN
  ('#FFF0A8','#DDF3E2','#DFECFF','#F1E6FF','#FFDDE6',
   '#FFE8D0','#E0F5F2','#F2F0E9')
 THEN RAISE EXCEPTION 'Choose a permitted background color.' USING ERRCODE='22023'; END IF;
 IF p_ink IS NULL OR p_ink NOT IN
  ('#17191E','#2D567F','#28654A','#7F4FA1','#B54860',
   '#A65B2E','#FFFFFF','#FFF0A8')
 THEN RAISE EXCEPTION 'Choose a permitted line color.' USING ERRCODE='22023'; END IF;
 IF p_background=p_ink
 THEN RAISE EXCEPTION 'The line and background colors must be different.' USING ERRCODE='22023'; END IF;
 UPDATE public.profiles SET avatar_symbol=p_symbol,
  avatar_background=p_background,avatar_ink=p_ink
 WHERE id=auth.uid()
 RETURNING jsonb_build_object('avatar_symbol',avatar_symbol,
    'avatar_background',avatar_background,'avatar_ink',avatar_ink) INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Profile not found.' USING ERRCODE='P0002'; END IF;
 RETURN result;
END;
$icon$;
REVOKE ALL ON FUNCTION public.crilo_update_profile_icon_v2(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crilo_update_profile_icon_v2(text,text,text) TO authenticated,service_role;
